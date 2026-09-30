import { notFound, redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { SLOT_ROTULO, fmtData, fmtDataHora } from "@/lib/formato";
import { CheckinPanel } from "./checkin-panel";
import { Comprovantes99 } from "./comprovantes-99";
import { MaterialEntregue } from "./material-entregue";

export default async function JobCampoPage(props: PageProps<"/campo/jobs/[id]">) {
  const { id } = await props.params;
  const s = await obterSessao();
  if (!s.consentiu && !s.ehGestao) redirect(`/consentimento?next=/campo/jobs/${id}`);

  const supabase = await criarClienteServidor();
  const [{ data: job }, { data: coords }, { data: eventos }, { data: corridas }, { data: cfg }] = await Promise.all([
    supabase.from("job").select("*, cliente:cliente_id(nome, pasta_drive_url), briefing(*)").eq("id", id).maybeSingle(),
    supabase.rpc("job_coordenadas", { p_job_id: id }),
    supabase.rpc("consultar_localizacoes_job", { p_job_id: id }),
    supabase.from("corrida_99").select("*").eq("job_id", id),
    supabase.from("configuracao").select("chave, valor").in("chave", ["precisao_maxima_m", "janela_checkin_antes_min", "janela_checkin_depois_min"]),
  ]);
  if (!job) notFound();

  const c = coords?.[0];
  const geofence = c?.lat != null && c?.lng != null ? { lat: c.lat, lng: c.lng, raioM: c.raio_geofence_m, confirmado: c.ponto_confirmado } : null;
  const chegada = eventos?.find((e) => e.tipo === "chegada") ?? null;
  const saida = eventos?.find((e) => e.tipo === "saida") ?? null;
  const cfgMap = Object.fromEntries((cfg ?? []).map((x) => [x.chave, Number(x.valor)]));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{job.cliente?.nome}</h1>
            <p className="text-sm text-muted">{fmtData(job.data, "EEE dd/MM")} · {SLOT_ROTULO[job.slot]} · Job #{job.codigo}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>
        {job.pasta_ingest_url && (
          <a href={job.pasta_ingest_url} target="_blank" rel="noreferrer" className="btn-outline mt-3 w-full">📁 Abrir pasta de ingest</a>
        )}
        {job.prazo_material && <p className="mt-2 text-sm">⏰ Prazo do material bruto: <strong>{fmtData(job.prazo_material)}</strong></p>}
      </header>

      <section className="card space-y-2">
        <h2 className="font-semibold">Briefing</h2>
        {job.briefing ? (
          <>
            <p><span className="text-muted">📍 Local:</span> {job.briefing.local}</p>
            <p className="whitespace-pre-line"><span className="text-muted">📝 Roteiro:</span> {job.briefing.roteiro}</p>
            {job.briefing.observacoes && <p className="whitespace-pre-line"><span className="text-muted">💬 Obs:</span> {job.briefing.observacoes}</p>}
            <p><span className="text-muted">🚗 Precisa de 99:</span> {job.briefing.precisa_99 ? "Sim" : "Não"}</p>
            {job.briefing.referencia_visual_path && <ReferenciaVisual path={job.briefing.referencia_visual_path} />}
          </>
        ) : (
          <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            Sem briefing. Nenhuma gravação começa sem briefing — chame a supervisora (Processos 2.2).
          </p>
        )}
      </section>

      <CheckinPanel
        jobId={job.id}
        status={job.status}
        temBriefing={Boolean(job.briefing)}
        geofence={geofence}
        inicio={job.inicio}
        fim={job.fim}
        chegada={chegada ? { em: chegada.capturado_em, dentro: chegada.dentro_geofence, distancia: chegada.distancia_m } : null}
        saida={saida ? { em: saida.capturado_em, dentro: saida.dentro_geofence } : null}
        precisaoMaxima={cfgMap.precisao_maxima_m ?? 100}
        janelaAntesMin={cfgMap.janela_checkin_antes_min ?? 120}
        janelaDepoisMin={cfgMap.janela_checkin_depois_min ?? 240}
        duracaoRealMin={job.duracao_real_min}
      />

      {job.status === "em_gravacao" && saida && <MaterialEntregue jobId={job.id} />}
      {job.material_entregue_em && <p className="text-sm text-success">✅ Material entregue em {fmtDataHora(job.material_entregue_em)}</p>}

      {job.precisa_99 && <Comprovantes99 jobId={job.id} corridas={corridas ?? []} />}
    </div>
  );
}

async function ReferenciaVisual({ path }: { path: string }) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.storage.from("referencias-briefing").createSignedUrl(path, 600);
  if (!data?.signedUrl) return null;
  return <a href={data.signedUrl} target="_blank" rel="noreferrer" className="text-primary underline">🖼️ Referência visual</a>;
}
