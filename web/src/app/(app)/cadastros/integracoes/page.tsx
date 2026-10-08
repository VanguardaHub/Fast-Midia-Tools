import { exigirGestao } from "@/lib/sessao";
import { fmtDataHora } from "@/lib/formato";
import type { Database } from "@/lib/database.types";
import { adminDisponivel, clienteAdmin } from "@/lib/supabase/admin";
import { credencialOAuth, oauthClienteConfigurado, origemGoogle } from "@/lib/integracoes/google-auth";

export const metadata = { title: "Integrações" };

const MENSAGENS: Record<string, string> = {
  conectada: "Conta Google conectada. Calendar e Drive passam a usar essa conta.",
  desconectada: "Conta Google desconectada.",
  recusado: "Autorização recusada no Google.",
  sem_refresh: "O Google não devolveu o token de atualização. Remova o acesso do app em myaccount.google.com/permissions e conecte de novo.",
  estado_invalido: "Sessão de autorização inválida ou expirada. Tente de novo.",
  sem_permissao: "Apenas Admin conecta a conta Google.",
  sem_cliente: "GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET não estão configurados no Vercel.",
};

/** RNF-07 / RNF-08 — estado das integrações, conexão da conta Google e visibilidade da fila (outbox). */
export default async function IntegracoesPage(props: PageProps<"/cadastros/integracoes">) {
  const s = await exigirGestao();
  const sp = await props.searchParams;
  const aviso = typeof sp.google === "string" ? sp.google : null;
  const [origem, conta] = await Promise.all([origemGoogle(), credencialOAuth()]);

  const configuradas = {
    [`Google Calendar (${origem === "oauth" ? "conta conectada" : origem === "conta_servico" ? "conta de serviço" : "espelho opcional"})`]: origem !== null,
    [`Google Drive (${origem === "oauth" ? "conta conectada" : origem === "conta_servico" ? "conta de serviço" : "pasta de ingest"})`]: origem !== null,
    "Apps Script (alternativa)": Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN),
    "Notion (espelho)": Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID),
    "WhatsApp Cloud API": Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    "E-mail (Resend)": Boolean(process.env.RESEND_API_KEY),
    "Worker (CRON_SECRET)": Boolean(process.env.CRON_SECRET),
  };

  let fila: Database["public"]["Tables"]["fila_integracao"]["Row"][] = [];
  if (adminDisponivel()) {
    const { data } = await clienteAdmin().from("fila_integracao").select("*").order("criado_em", { ascending: false }).limit(100);
    fila = data ?? [];
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Integrações</h1>

      {aviso && (
        <p className={`rounded-xl p-3 text-sm ${aviso === "conectada" || aviso === "desconectada" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {MENSAGENS[aviso] ?? (aviso.startsWith("erro:") ? `Erro ao conectar: ${decodeURIComponent(aviso.slice(5))}` : aviso)}
        </p>
      )}

      <section className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Conta Google das integrações</h2>
            <p className="text-sm text-muted">
              {conta
                ? <>Conectada: <strong>{conta.conta_email}</strong> · desde {fmtDataHora(conta.atualizado_em)} · escopos: {conta.escopos.filter((e) => e.includes("googleapis")).map((e) => e.split("/").pop()).join(", ") || "—"}</>
                : origem === "conta_servico"
                  ? "Usando conta de serviço (variável GOOGLE_SERVICE_ACCOUNT_JSON). Conectar uma conta Google por aqui passa a ter prioridade."
                  : "Nenhuma conta conectada. Calendar (espelho dos jobs) e Drive (pasta de ingest) ficam pendentes."}
            </p>
          </div>
          {s.ehAdmin && (
            <div className="flex gap-2">
              <a href="/api/google/conectar" className="btn-primary">{conta ? "Reconectar" : "Conectar conta Google"}</a>
              {conta && (
                <form action="/api/google/desconectar" method="post">
                  <button className="btn-outline">Desconectar</button>
                </form>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted">
          A conta conectada precisa ter acesso de edição às pastas dos clientes no Drive. Os eventos de gravação são criados no calendário dessa conta com o Fast como convidado.
          {!oauthClienteConfigurado() && " Pré-requisito: GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no Vercel e o URI de retorno cadastrado no Google Cloud."}
        </p>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(configuradas).map(([k, v]) => (
          <div key={k} className="card py-3 text-sm"><p className="text-muted">{k}</p><p className={`font-semibold ${v ? "text-success" : "text-warning"}`}>{v ? "configurada" : "pendente"}</p></div>
        ))}
      </div>
      <p className="text-xs text-muted">Sem credenciais, a fila acumula itens e o sistema continua operando (degradação graciosa). Ao configurar, o worker processa o backlog a cada 10 minutos.</p>
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
