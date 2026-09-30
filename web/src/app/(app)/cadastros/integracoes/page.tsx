import { createClient } from "@supabase/supabase-js";
import { exigirGestao } from "@/lib/sessao";
import { fmtDataHora } from "@/lib/formato";
import type { Database } from "@/lib/database.types";
import { googleCalendarConfigurado } from "@/lib/integracoes/google-calendar";

export const metadata = { title: "Integrações" };

/** RNF-07 / RNF-08 — visibilidade da fila (outbox) de Notion, Calendar/Drive, WhatsApp e e-mail. */
export default async function IntegracoesPage() {
  await exigirGestao();
  const configuradas = {
    [`Google Calendar (API${process.env.GOOGLE_CALENDAR_ID ? ", calendário compartilhado" : ", conta de serviço"})`]: googleCalendarConfigurado(),
    "Apps Script (Drive; Calendar alternativo)": Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN),
    "Notion (espelho)": Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID),
    "WhatsApp Cloud API": Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    "E-mail (Resend)": Boolean(process.env.RESEND_API_KEY),
    "Worker (CRON_SECRET)": Boolean(process.env.CRON_SECRET),
  };

  // A fila é acessível apenas ao service_role; a página é restrita à gestão.
  let fila: Database["public"]["Tables"]["fila_integracao"]["Row"][] = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data } = await admin.from("fila_integracao").select("*").order("criado_em", { ascending: false }).limit(100);
    fila = data ?? [];
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Integrações</h1>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(configuradas).map(([k, v]) => (
          <div key={k} className="card py-3 text-sm"><p className="text-muted">{k}</p><p className={`font-semibold ${v ? "text-success" : "text-warning"}`}>{v ? "configurada" : "pendente"}</p></div>
        ))}
      </div>
      <p className="text-xs text-muted">Sem credenciais, a fila acumula itens e o sistema continua operando (degradação graciosa). Configure as variáveis no Vercel e o worker processa o backlog.</p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-xs">
          <thead><tr className="border-b border-border text-left"><th className="p-2">Tipo</th><th className="p-2">Chave</th><th className="p-2">Status</th><th className="p-2">Tentativas</th><th className="p-2">Próxima</th><th className="p-2">Erro</th></tr></thead>
          <tbody>
            {fila.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <td className="p-2">{f.tipo}</td><td className="p-2 font-mono">{f.chave_idempotencia}</td>
                <td className="p-2">{f.status}</td><td className="p-2">{f.tentativas}/{f.max_tentativas}</td>
                <td className="p-2">{fmtDataHora(f.proximo_em)}</td><td className="p-2 text-danger">{f.ultimo_erro?.slice(0, 120)}</td>
              </tr>
            ))}
            {fila.length === 0 && <tr><td colSpan={6} className="p-3 text-muted">Fila vazia ou SUPABASE_SERVICE_ROLE_KEY não configurada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
