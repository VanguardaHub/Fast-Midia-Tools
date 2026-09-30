import { criarClienteServidor } from "@/lib/supabase/server";
import { FormFast } from "./form-fast";

export const metadata = { title: "Fasts" };

/** RF-03 — cadastro de Fasts por interface (substitui CONFIG.FASTS do Apps Script). */
export default async function FastsPage() {
  const supabase = await criarClienteServidor();
  const { data: fasts } = await supabase.from("fast").select("*, perfil:perfil_id(email)").order("nome");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fasts</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-border text-left"><th className="p-2">Nome</th><th className="p-2">E-mail (Calendar)</th><th className="p-2">WhatsApp</th><th className="p-2">Conta</th><th className="p-2">Ativo</th></tr></thead>
              <tbody>
                {(fasts ?? []).map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="p-2"><span className="mr-2 inline-block size-3 rounded-full" style={{ background: f.cor }} />{f.nome}</td>
                    <td className="p-2">{f.email_calendario}</td>
                    <td className="p-2">{f.telefone ?? "—"}</td>
                    <td className="p-2">{f.perfil?.email ? "✅ vinculada" : "⏳ sem login"}</td>
                    <td className="p-2">{f.ativo ? "sim" : "não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">O Fast entra no app com o mesmo e-mail do calendário (permitido mesmo fora do domínio corporativo) e é vinculado automaticamente.</p>
        </div>
        <FormFast fasts={(fasts ?? []).map((f) => ({ id: f.id, nome: f.nome, emailCalendario: f.email_calendario, telefone: f.telefone ?? "", cor: f.cor, nomeNotion: f.nome_notion ?? "", ativo: f.ativo }))} />
      </div>
    </div>
  );
}
