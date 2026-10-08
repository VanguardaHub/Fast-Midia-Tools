import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { SLOT_ROTULO, fmtData, hojeISO } from "@/lib/formato";
import { SincronizarOffline } from "./sincronizar-offline";
import { AoVivo } from "@/components/ao-vivo";
import { MinhaDisponibilidade } from "./minha-disponibilidade";

export const metadata = { title: "Jobs de hoje" };

export default async function CampoPage() {
  const s = await obterSessao();
  if (!s.fastId && !s.ehGestao) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold">Sem vínculo de Fast</h1>
        <p className="mt-2 text-muted">Seu usuário ainda não está vinculado a um cadastro de Fast. Peça à supervisora para cadastrar seu e-mail.</p>
      </div>
    );
  }
  if (!s.consentiu) redirect("/consentimento?next=/campo");

  const supabase = await criarClienteServidor();
  const hoje = hojeISO();
  const { data: jobs } = await supabase
    .from("job")
    .select("id, codigo, data, slot, status, endereco, precisa_99, pasta_ingest_url, cliente:cliente_id(nome), briefing(id)")
    .gte("data", hoje)
    .neq("status", "cancelado")
    .order("data")
    .order("inicio")
    .limit(30);

  const { data: indisponibilidades } = s.fastId
    ? await supabase.from("indisponibilidade").select("id, data, slot, motivo").eq("fast_id", s.fastId).gte("data", hoje).order("data").limit(30)
    : { data: [] as { id: string; data: string; slot: "manha" | "tarde" | null; motivo: string | null }[] };
  const deHoje = (jobs ?? []).filter((j) => j.data === hoje);
  const proximos = (jobs ?? []).filter((j) => j.data > hoje);

  return (
    <div className="space-y-6">
      <SincronizarOffline />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hoje</h1>
          <p className="text-sm text-muted">{fmtData(hoje, "EEEE, dd 'de' MMMM")} · <AoVivo tabelas={["job", "briefing"]} canal="campo" /></p>
        </div>
      </header>

      {deHoje.length === 0 ? (
        <div className="card text-center text-muted">Nenhum job para hoje.</div>
      ) : (
        <ul className="space-y-3">
          {deHoje.map((j) => (
            <li key={j.id}>
              <Link href={`/campo/jobs/${j.id}`} className="card block active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{j.cliente?.nome}</p>
                    <p className="text-sm text-muted">{SLOT_ROTULO[j.slot]} · Job #{j.codigo}</p>
                    {j.endereco && <p className="mt-1 text-sm">{j.endereco}</p>}
                  </div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {!j.briefing ? <span className="badge bg-danger/15 text-danger">Sem briefing</span> : <span className="badge bg-success/15 text-success">Briefing ok</span>}
                  {j.precisa_99 && <span className="badge bg-warning/15 text-warning">Precisa de 99</span>}
                  {j.pasta_ingest_url && <span className="badge bg-info/15 text-info">Pasta de ingest</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {s.fastId && <MinhaDisponibilidade itens={indisponibilidades ?? []} />}

      {proximos.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Próximos</h2>
          <ul className="space-y-2">
            {proximos.map((j) => (
              <li key={j.id}>
                <Link href={`/campo/jobs/${j.id}`} className="card flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{j.cliente?.nome}</p>
                    <p className="text-sm text-muted">{fmtData(j.data, "EEE dd/MM")} · {SLOT_ROTULO[j.slot]}</p>
                  </div>
                  <StatusBadge status={j.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
