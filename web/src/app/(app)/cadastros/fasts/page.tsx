import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { AcoesLinha } from "../acoes-linha";
import { FormFast, type FastForm } from "./form-fast";

export const metadata = { title: "Fasts" };

/** RF-03 — cadastro de Fasts por interface (listar, criar, editar, vincular login, desativar, excluir). */
export default async function FastsPage(props: PageProps<"/cadastros/fasts">) {
  const s = await exigirGestao();
  const sp = await props.searchParams;
  const mostrarInativos = sp.inativos === "1";
  const editarId = typeof sp.editar === "string" ? sp.editar : "";
  const supabase = await criarClienteServidor();
  let consulta = supabase.from("fast").select("*, perfil:perfil_id(email, ativo), jobs:job(count)").order("nome");
  if (!mostrarInativos) consulta = consulta.eq("ativo", true);
  const [{ data: fasts }, { data: emEdicao }, { data: contasFast }, { data: vinculados }] = await Promise.all([
    consulta,
    editarId ? supabase.from("fast").select("*").eq("id", editarId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("perfil").select("id, nome, email").eq("perfil", "fast").eq("ativo", true).order("nome"),
    supabase.from("fast").select("perfil_id").not("perfil_id", "is", null),
  ]);
  const jaVinculados = new Set((vinculados ?? []).map((v) => v.perfil_id).filter((x) => x !== emEdicao?.perfil_id));
  const contas = (contasFast ?? []).filter((c) => !jaVinculados.has(c.id));
  const inicial: FastForm | null = emEdicao
    ? { id: emEdicao.id, nome: emEdicao.nome, emailCalendario: emEdicao.email_calendario, telefone: emEdicao.telefone ?? "", cor: emEdicao.cor, nomeNotion: emEdicao.nome_notion ?? "", ativo: emEdicao.ativo, perfilId: emEdicao.perfil_id ?? "" }
    : null;
  const base = mostrarInativos ? "/cadastros/fasts?inativos=1" : "/cadastros/fasts";
  const hrefEditar = (id: string) => `${base}${base.includes("?") ? "&" : "?"}editar=${id}`;
  const jobsDe = (f: { jobs: unknown }) => (f.jobs as { count: number }[] | null)?.[0]?.count ?? 0;

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
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">E-mail (Calendar e login)</th><th className="p-2">WhatsApp</th><th className="p-2">Conta</th><th className="p-2 text-right">Jobs</th><th className="p-2">Ativo</th><th className="p-2 text-right">Ações</th></tr></thead>
              <tbody>
                {(fasts ?? []).map((f) => (
                  <tr key={f.id} className={`border-b border-border last:border-0 ${f.id === editarId ? "bg-primary/5" : ""} ${!f.ativo ? "opacity-60" : ""}`}>
                    <td className="p-2 font-medium"><span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ background: f.cor }} />{f.nome}</td>
                    <td className="p-2">{f.email_calendario}</td>
                    <td className="p-2">{f.telefone ?? "—"}</td>
                    <td className="p-2">{f.perfil ? <span className="badge bg-success/15 text-success" title={f.perfil.email}>vinculada</span> : <span className="badge bg-warning/15 text-warning">sem login</span>}</td>
                    <td className="p-2 text-right">{jobsDe(f)}</td>
                    <td className="p-2">{f.ativo ? "sim" : "não"}</td>
                    <td className="p-2"><AcoesLinha tabela="fast" id={f.id} nome={f.nome} ativo={f.ativo} jobs={jobsDe(f)} ehAdmin={s.ehAdmin} hrefEditar={hrefEditar(f.id)} /></td>
                  </tr>
                ))}
                {!fasts?.length && <tr><td colSpan={7} className="p-4 text-center text-muted">Nenhum Fast cadastrado. Use o formulário ao lado.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            O Fast entra no app com o mesmo e-mail do calendário (aceito mesmo fora do domínio corporativo) e é vinculado automaticamente ao cadastro no primeiro login. Também é possível vincular uma conta já existente no formulário. Só então consegue fazer check-in. “Desativar” preserva o histórico; “Excluir” só para Fasts sem jobs (Admin).
          </p>
        </div>
        <FormFast key={inicial?.id ?? "novo"} inicial={inicial} contas={contas} hrefNovo={base} />
      </div>
    </div>
  );
}
