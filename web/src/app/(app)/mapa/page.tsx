import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { Mapa } from "@/components/mapa";
import { STATUS_ROTULO, fmtData, fmtHora, hojeISO } from "@/lib/formato";

export const metadata = { title: "Mapa do dia" };

/** RF-51 — mapa do dia com o último check-in de cada Fast. Consulta auditada (RNF-04). */
export default async function MapaPage(props: PageProps<"/mapa">) {
  await exigirGestao();
  const sp = await props.searchParams;
  const data = typeof sp.data === "string" ? sp.data : hojeISO();
  const supabase = await criarClienteServidor();
  const { data: linhas, error } = await supabase.rpc("mapa_do_dia", { p_data: data });

  const marcadores = (linhas ?? []).flatMap((l) => {
    const m: { id: string; lat: number; lng: number; cor?: string; rotulo?: string; raioM?: number }[] = [];
    if (l.job_lat != null && l.job_lng != null) m.push({ id: `job-${l.job_id}`, lat: l.job_lat, lng: l.job_lng, cor: "#9f1239", rotulo: `Job #${l.codigo} · ${l.cliente}`, raioM: l.raio_geofence_m });
    if (l.lat != null && l.lng != null) m.push({ id: `fast-${l.job_id}-${l.tipo}`, lat: l.lat, lng: l.lng, cor: l.cor, rotulo: `${l.fast_nome} · ${l.tipo} ${fmtHora(l.capturado_em)}${l.dentro_geofence === false ? " (fora)" : ""}` });
    return m;
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mapa do dia</h1>
          <p className="text-sm text-muted">{fmtData(data, "EEEE, dd/MM/yyyy")} · consulta registrada na auditoria</p>
        </div>
        <form className="flex gap-2">
          <input type="date" name="data" defaultValue={data} className="input" />
          <button className="btn-outline">Ver</button>
        </form>
      </header>
      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error.message}</p>}
      <Mapa marcadores={marcadores} altura="60vh" zoom={12} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(linhas ?? []).map((l) => (
          <Link key={l.job_id} href={`/jobs/${l.job_id}`} className="card py-3 text-sm">
            <p className="font-medium"><span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: l.cor }} />{l.fast_nome} · {l.cliente}</p>
            <p className="text-xs text-muted">
              {STATUS_ROTULO[l.status]} · {l.tipo ? `último evento: ${l.tipo} ${fmtHora(l.capturado_em)} (${Math.round(l.precisao_m)} m)` : "sem check-in"}
              {l.dentro_geofence === false && <span className="text-danger"> · fora da geofence</span>}
              {l.job_lat == null && <span className="text-warning"> · sem ponto do job</span>}
            </p>
          </Link>
        ))}
        {!linhas?.length && <p className="text-sm text-muted">Nenhum job nesta data.</p>}
      </div>
    </div>
  );
}
