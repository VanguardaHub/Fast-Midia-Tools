import { criarClienteServidor } from "@/lib/supabase/server";
import { FormCliente } from "./form-cliente";

export const metadata = { title: "Clientes" };

/** RF-16 — clientes e mapeamento da pasta CRIAÇÃO/[ANO]/[CLIENTE] no Drive. */
export default async function ClientesPage() {
  const supabase = await criarClienteServidor();
  const { data: clientes } = await supabase.from("cliente").select("*").order("nome");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card lg:col-span-2">
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">Grupo</th><th className="p-2">Pasta Drive</th><th className="p-2">Contato</th><th className="p-2">Ativo</th></tr></thead>
            <tbody>
              {(clientes ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-2">{c.nome}</td>
                  <td className="p-2">{c.grupo ?? "—"}</td>
                  <td className="p-2">{c.pasta_drive_url ? <a className="text-primary underline" href={c.pasta_drive_url} target="_blank" rel="noreferrer">abrir</a> : c.pasta_drive_id ?? "—"}</td>
                  <td className="p-2">{c.contato_nome ?? "—"}{c.contato_whatsapp ? ` · ${c.contato_whatsapp}` : ""}</td>
                  <td className="p-2">{c.ativo ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormCliente clientes={(clientes ?? []).map((c) => ({ id: c.id, nome: c.nome, grupo: c.grupo ?? "", pastaDriveId: c.pasta_drive_id ?? "", pastaDriveUrl: c.pasta_drive_url ?? "", contatoNome: c.contato_nome ?? "", contatoWhatsapp: c.contato_whatsapp ?? "", ativo: c.ativo }))} />
      </div>
    </div>
  );
}
