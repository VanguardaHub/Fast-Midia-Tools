import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { SLOT_ROTULO, fmtData, hojeISO } from "@/lib/formato";

export const metadata = { title: "Histórico" };

export default async function HistoricoPage() {
  await obterSessao();
  const supabase = await criarClienteServidor();
  const { data: jobs } = await supabase
    .from("job")
    .select("id, codigo, data, slot, status, duracao_real_min, precisa_99, cliente:cliente_id(nome)")
    .lt("data", hojeISO())
    .order("data", { ascending: false })
    .limit(60);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Histórico</h1>
      <p className="text-sm text-muted">Seus jobs anteriores. O histórico de localização fica disponível por 90 dias.</p>
      <ul className="space-y-2">
        {(jobs ?? []).map((j) => (
          <li key={j.id}>
            <Link href={`/campo/jobs/${j.id}`} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{j.cliente?.nome}</p>
                <p className="text-sm text-muted">
                  {fmtData(j.data)} · {SLOT_ROTULO[j.slot]}{j.duracao_real_min != null ? ` · ${j.duracao_real_min} min gravados` : ""}
                </p>
              </div>
              <StatusBadge status={j.status} />
            </Link>
          </li>
        ))}
        {!jobs?.length && <li className="card text-center text-muted">Nenhum job anterior.</li>}
      </ul>
    </div>
  );
}
