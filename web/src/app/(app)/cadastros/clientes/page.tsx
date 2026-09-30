import { criarClienteServidor } from "@/lib/supabase/server";
import { FormCliente } from "./form-cliente";

export const metadata = { title: "Clientes" };

/** RF-16 — clientes e mapeamento da pasta CRIAÇÃO/[ANO]/[CLIENTE] no Drive. */
export default async function ClientesPage(props: PageProps<"/cadastros/clientes">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const mostrarInativos = sp.inativos === "1";
  const supabase = await criarClienteServidor();
  let consulta = supabase.from("cliente").select("*, jobs:job(count)").order("nome");
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,grupo.ilike.%${q}%`);
  if (!mostrarInativos) consulta = consulta.eq("ativo", true);
  const { data: clientes } = await consulta;
  const { data: todos } = await supabase.from("cliente").select("id, nome, grupo, pasta_drive_id, pasta_drive_url, contato_nome, contato_whatsapp, ativo").order("nome");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted">{clientes?.length ?? 0} cliente(s){q ? ` para "${q}"` : ""}</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar por nome ou grupo" className="input w-56" />
          <label className="flex items-center gap-1 text-sm text-muted"><input type="checkbox" name="inativos" value="1" defaultChecked={mostrarInativos} /> inativos</label>
          <button className="btn-outline">Filtrar</button>
        </form>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card lg:col-span-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">Grupo</th><th className="p-2">Pasta Drive</th><th className="p-2">Contato</th><th className="p-2 text-right">Jobs</th><th className="p-2">Ativo</th></tr></thead>
            <tbody>
              {(clientes ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-2 font-medium">{c.nome}</td>
                  <td className="p-2">{c.grupo ?? "—"}</td>
                  <td className="p-2">
                    {c.pasta_drive_url ? <a className="text-primary underline" href={c.pasta_drive_url} target="_blank" rel="noreferrer">abrir</a> : c.pasta_drive_id ? <span className="font-mono text-xs">{c.pasta_drive_id.slice(0, 10)}…</span> : <span className="badge bg-warning/15 text-warning">sem pasta</span>}
                  </td>
                  <td className="p-2">{c.contato_nome ?? "—"}{c.contato_whatsapp ? ` · ${c.contato_whatsapp}` : ""}</td>
                  <td className="p-2 text-right">{(c.jobs as unknown as { count: number }[])?.[0]?.count ?? 0}</td>
                  <td className="p-2">{c.ativo ? "sim" : "não"}</td>
                </tr>
              ))}
              {!clientes?.length && <tr><td colSpan={6} className="p-4 text-center text-muted">Nenhum cliente. Cadastre ao lado ou crie direto ao agendar um job.</td></tr>}
            </tbody>
          </table>
        </div>
        <FormCliente clientes={(todos ?? []).map((c) => ({ id: c.id, nome: c.nome, grupo: c.grupo ?? "", pastaDriveId: c.pasta_drive_id ?? "", pastaDriveUrl: c.pasta_drive_url ?? "", contatoNome: c.contato_nome ?? "", contatoWhatsapp: c.contato_whatsapp ?? "", ativo: c.ativo }))} />
      </div>
      <p className="text-xs text-muted">
        O nome deve ser idêntico ao da pasta no Drive (CRIAÇÃO/[ANO]/[CLIENTE]). Clientes de pastas de grupo usam o campo Grupo. A verificação automática da pasta ocorre ao criar o job, quando a integração com o Apps Script estiver configurada.
      </p>
    </div>
  );
}
