import { criarClienteServidor } from "@/lib/supabase/server";
import { FormFast } from "./form-fast";

export const metadata = { title: "Fasts" };

/** RF-03 — cadastro de Fasts por interface (substitui CONFIG.FASTS do Apps Script). */
export default async function FastsPage(props: PageProps<"/cadastros/fasts">) {
  const sp = await props.searchParams;
  const mostrarInativos = sp.inativos === "1";
  const supabase = await criarClienteServidor();
  let consulta = supabase.from("fast").select("*, perfil:perfil_id(email, ativo), jobs:job(count)").order("nome");
  if (!mostrarInativos) consulta = consulta.eq("ativo", true);
  const { data: fasts } = await consulta;
  const { data: todos } = await supabase.from("fast").select("id, nome, email_calendario, telefone, cor, nome_notion, ativo").order("nome");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fasts</h1>
          <p className="text-sm text-muted">{fasts?.length ?? 0} Fast(s) · {fasts?.filter((f) => !f.perfil).length ?? 0} ainda sem login</p>
        </div>
        <form className="flex gap-2">
          <label className="flex items-center gap-1 text-sm text-muted"><input type="checkbox" name="inativos" value="1" defaultChecked={mostrarInativos} /> mostrar inativos</label>
          <button className="btn-outline">Aplicar</button>
        </form>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">E-mail (Calendar e login)</th><th className="p-2">WhatsApp</th><th className="p-2">Conta</th><th className="p-2 text-right">Jobs</th><th className="p-2">Ativo</th></tr></thead>
              <tbody>
                {(fasts ?? []).map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="p-2 font-medium"><span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ background: f.cor }} />{f.nome}</td>
                    <td className="p-2">{f.email_calendario}</td>
                    <td className="p-2">{f.telefone ?? "—"}</td>
                    <td className="p-2">{f.perfil ? <span className="badge bg-success/15 text-success">vinculada</span> : <span className="badge bg-warning/15 text-warning">sem login</span>}</td>
                    <td className="p-2 text-right">{(f.jobs as unknown as { count: number }[])?.[0]?.count ?? 0}</td>
                    <td className="p-2">{f.ativo ? "sim" : "não"}</td>
                  </tr>
                ))}
                {!fasts?.length && <tr><td colSpan={6} className="p-4 text-center text-muted">Nenhum Fast cadastrado. Use o formulário ao lado.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            O Fast entra no app com o mesmo e-mail do calendário (aceito mesmo fora do domínio corporativo) e é vinculado automaticamente ao cadastro no primeiro login. Só então consegue fazer check-in.
          </p>
        </div>
        <FormFast fasts={(todos ?? []).map((f) => ({ id: f.id, nome: f.nome, emailCalendario: f.email_calendario, telefone: f.telefone ?? "", cor: f.cor, nomeNotion: f.nome_notion ?? "", ativo: f.ativo }))} />
      </div>
    </div>
  );
}
