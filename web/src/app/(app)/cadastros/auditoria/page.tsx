import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/sessao";
import { fmtDataHora } from "@/lib/formato";

export const metadata = { title: "Auditoria" };

/** RNF-12 — trilha de auditoria, incluindo consultas de posição (RNF-04). */
export default async function AuditoriaPage(props: PageProps<"/cadastros/auditoria">) {
  await exigirAdmin();
  const sp = await props.searchParams;
  const acao = typeof sp.acao === "string" ? sp.acao : "";
  const supabase = await criarClienteServidor();
  let q = supabase.from("auditoria").select("*").order("criado_em", { ascending: false }).limit(200);
  if (acao) q = q.eq("acao", acao);
  const { data: linhas } = await q;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Auditoria</h1>
      <form className="flex gap-2">
        <select name="acao" defaultValue={acao} className="input w-56">
          <option value="">Todas as ações</option>
          <option value="insert">insert</option><option value="update">update</option><option value="delete">delete</option>
          <option value="consulta_posicao">consulta_posicao</option><option value="expurgo_retencao">expurgo_retencao</option>
        </select>
        <button className="btn-outline">Filtrar</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[800px] text-xs">
          <thead><tr className="border-b border-border text-left"><th className="p-2">Quando</th><th className="p-2">Quem</th><th className="p-2">Ação</th><th className="p-2">Entidade</th><th className="p-2">Dados</th></tr></thead>
          <tbody>
            {(linhas ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border align-top last:border-0">
                <td className="p-2 whitespace-nowrap">{fmtDataHora(l.criado_em)}</td>
                <td className="p-2">{l.usuario_email ?? "sistema"}</td>
                <td className="p-2">{l.acao}</td>
                <td className="p-2">{l.entidade}<br /><span className="text-muted">{l.entidade_id?.slice(0, 8)}</span></td>
                <td className="p-2"><pre className="max-h-24 max-w-md overflow-auto whitespace-pre-wrap">{JSON.stringify(l.dados)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
