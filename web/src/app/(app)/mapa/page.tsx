import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { MapaAoVivo, type FastVivo, type PontoVivo } from "@/components/mapa-ao-vivo";
import { AoVivo } from "@/components/ao-vivo";
import { STATUS_ROTULO, fmtData, hojeISO } from "@/lib/formato";
import { agoraMs } from "@/lib/rastreio";

export const metadata = { title: "Mapa do dia" };

/**
 * RF-51 / RF-38 — Mapa do dia ao vivo: trilha e posição de cada Fast como num app de corrida.
 * Dados pelas RPCs auditadas `mapa_do_dia` (jobs + última posição) e `trajeto_do_dia` (trilha);
 * ambas registram uma única consulta por janela de 10 min (ADR-0005). O Realtime (job.atualizado_em
 * é tocado a cada posição) recarrega esta página; o cliente anima a diferença.
 */
export default async function MapaPage(props: PageProps<"/mapa">) {
  await exigirGestao();
  const sp = await props.searchParams;
  const data = typeof sp.data === "string" ? sp.data : hojeISO();
  const supabase = await criarClienteServidor();
  const [{ data: linhas, error }, { data: trajeto, error: erroTrajeto }] = await Promise.all([
    supabase.rpc("mapa_do_dia", { p_data: data }),
    supabase.rpc("trajeto_do_dia", { p_data: data }),
  ]);

  const porJob = new Map<string, PontoVivo[]>();
  for (const p of trajeto ?? []) {
    const lista = porJob.get(p.job_id) ?? [];
    lista.push({ lat: p.lat, lng: p.lng, capturadoEm: p.capturado_em, tipo: p.tipo, precisaoM: Number(p.precisao_m), dentroGeofence: p.dentro_geofence });
    porJob.set(p.job_id, lista);
  }
  const fasts: FastVivo[] = (linhas ?? []).map((l) => ({
    jobId: l.job_id,
    codigo: l.codigo,
    cliente: l.cliente,
    fastNome: l.fast_nome,
    cor: l.cor,
    status: l.status,
    statusRotulo: STATUS_ROTULO[l.status],
    job: l.job_lat != null && l.job_lng != null ? { lat: l.job_lat, lng: l.job_lng, raioM: l.raio_geofence_m } : null,
    trilha: porJob.get(l.job_id) ?? [],
  }));
  const erro = error?.message ?? erroTrajeto?.message;

  return (
    <div className="space-y-2">
      {erro && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
      <MapaAoVivo
        fasts={fasts}
        agoraInicial={agoraMs()}
        cabecalho={
          <>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">Mapa do dia</h1>
              <p className="truncate text-xs text-muted">{fmtData(data, "EEEE, dd/MM/yyyy")} · consulta auditada · <AoVivo tabelas={["job", "alerta"]} intervaloMs={30_000} canal="mapa" /></p>
            </div>
            <form className="flex gap-2">
              <input type="date" name="data" defaultValue={data} className="input min-h-10 w-auto" aria-label="Data" />
              <button className="btn-outline min-h-10 px-3">Ver</button>
            </form>
          </>
        }
      />
      <p className="text-xs text-muted">
        Entre o check-in e o check-out, com o app aberto na tela do job, o Fast compartilha a posição a cada ~30 s (RF-38, ADR-0005, termo 2.0); a trilha mostra só esse período. Distância e chegada estimada são calculadas em linha reta no próprio app, sem enviar posições a serviços externos.
      </p>
    </div>
  );
}
