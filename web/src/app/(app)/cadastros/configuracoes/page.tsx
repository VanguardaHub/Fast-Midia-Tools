import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/sessao";
import { FormConfig } from "./form-config";

export const metadata = { title: "Configurações" };

/** Parâmetros operacionais (RF-33 raio, RNF-04 retenção, RNF-06 precisão, buffer 2h). */
export default async function ConfiguracoesPage() {
  await exigirAdmin();
  const supabase = await criarClienteServidor();
  const { data: cfg } = await supabase.from("configuracao").select("*").order("chave");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configurações operacionais</h1>
      <p className="text-sm text-muted">Toda alteração é auditada. Mudanças no prazo de retenção ou na finalidade da coleta exigem nova avaliação do DPO (seção 8, gatilho de revisão).</p>
      <FormConfig itens={(cfg ?? []).map((c) => ({ chave: c.chave, valor: JSON.stringify(c.valor), descricao: c.descricao ?? "" }))} />
    </div>
  );
}
