import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { fmtDataHora } from "@/lib/formato";
import { BotaoReenviar, FormConvite, LinhaPerfil } from "./form-acessos";

export const metadata = { title: "Acessos" };

/** RF-01 / RF-02 — perfis e convites. */
export default async function AcessosPage() {
  const s = await exigirGestao();
  const supabase = await criarClienteServidor();
  const [{ data: perfis }, { data: convites }, { data: cfg }] = await Promise.all([
    supabase.from("perfil").select("*").order("nome"),
    supabase.from("convite").select("*").order("criado_em", { ascending: false }),
    supabase.from("configuracao").select("valor").eq("chave", "dominios_email_permitidos").single(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Acessos e perfis</h1>
      <p className="text-sm text-muted">Convites geram um link de uso único e, com o Resend configurado, enviam e-mail automaticamente. Domínios com login automático: {Array.isArray(cfg?.valor) ? (cfg.valor as string[]).join(", ") : "—"}. Outros e-mails precisam de convite ou de cadastro como Fast.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card lg:col-span-2">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Telefone</th><th className="p-2">Perfil</th><th className="p-2">Ativo</th><th className="p-2 text-right">Ações</th></tr></thead>
            <tbody>
              {(perfis ?? []).map((p) => <LinhaPerfil key={p.id} perfil={{ id: p.id, nome: p.nome, email: p.email, telefone: p.telefone ?? "", perfil: p.perfil, ativo: p.ativo }} podeEditar={s.ehAdmin} />)}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <FormConvite ehAdmin={s.ehAdmin} />
          <section className="card">
            <h2 className="mb-2 font-semibold">Convites</h2>
            <ul className="space-y-1 text-sm">
              {(convites ?? []).map((c) => (
                <li key={c.email} className="border-b border-border py-1.5 last:border-0">
                  <span className="font-medium">{c.email}</span> · {c.perfil} · {c.usado_em ? `conta criada ${fmtDataHora(c.usado_em)}` : <span className="text-warning">link não gerado</span>}
                  <div className="mt-1"><BotaoReenviar email={c.email} /></div>
                </li>
              ))}
              {!convites?.length && <li className="text-muted">Nenhum convite.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
