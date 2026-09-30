import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { EXCECAO_ROTULO, SLOT_ROTULO, fmtData, fmtDataHora, fmtMoeda } from "@/lib/formato";
import { BriefingForm } from "./briefing-form";
import { PontoGeofence } from "./ponto-geofence";
import { AcoesJob } from "./acoes-job";
import { ExcecoesJob } from "./excecoes-job";
import { CorridasJob } from "./corridas-job";

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const s = await obterSessao();
  const supabase = await criarClienteServidor();
  const [{ data: job }, { data: coords }, { data: fasts }, { data: excecoes }, { data: corridas }, { data: alertas }] = await Promise.all([
    supabase.from("job").select("*, cliente:cliente_id(id, nome, pasta_drive_url, grupo), fast:fast_id(id, nome, cor, email_calendario), briefing(*), analista:analista_id(nome, email)").eq("id", id).maybeSingle(),
    supabase.rpc("job_coordenadas", { p_job_id: id }),
    supabase.from("fast").select("id, nome, cor").eq("ativo", true).order("nome"),
    supabase.from("excecao").select("*, solicitante:solicitada_por(nome), decisor:decidida_por(nome)").eq("job_id", id).order("criado_em", { ascending: false }),
    supabase.from("corrida_99").select("*").eq("job_id", id),
    supabase.from("alerta").select("*").eq("job_id", id).eq("resolvido", false),
  ]);
  if (!job) notFound();

  // Localizações: consulta logada (somente gestão vê; Fast vê as próprias)
  const { data: localizacoes } = s.ehGestao ? await supabase.rpc("consultar_localizacoes_job", { p_job_id: id }) : { data: [] };
  const c = coords?.[0];
  const ponto = c?.lat != null && c?.lng != null ? { lat: c.lat, lng: c.lng, raioM: c.raio_geofence_m, confirmado: c.ponto_confirmado } : null;

  return (
    <div className="space-y-5">
      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Job #{job.codigo}</p>
            <h1 className="text-2xl font-bold">{job.cliente?.nome}</h1>
            <p className="text-sm text-muted">
              <span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: job.fast?.cor }} />
              {job.fast?.nome} · {fmtData(job.data, "EEE dd/MM/yyyy")} · {SLOT_ROTULO[job.slot]}
              {job.data_edicao && ` · edição ${fmtData(job.data_edicao, "dd/MM")} (${job.bloco_edicao === "manha" ? "manhã" : "tarde"})`}
            </p>
            {job.analista && <p className="text-sm text-muted">Analista: {job.analista.nome}{job.analista_whatsapp ? ` · ${job.analista_whatsapp}` : ""}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={job.status} />
            {job.notion_page_id && <a className="text-xs text-primary underline" href={`https://www.notion.so/${job.notion_page_id.replace(/-/g, "")}`} target="_blank" rel="noreferrer">Ver no Notion</a>}
          </div>
        </div>
        {alertas?.length ? (
          <ul className="mt-3 space-y-1">
            {alertas.map((a) => <li key={a.id} className={`rounded-lg p-2 text-sm ${a.severidade === "critico" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>⚠️ {a.mensagem}</li>)}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {job.pasta_ingest_url ? <a className="btn-outline" href={job.pasta_ingest_url} target="_blank" rel="noreferrer">📁 Pasta de ingest</a> : <span className="badge bg-warning/15 text-warning">Pasta de ingest pendente (Drive)</span>}
          {job.cliente?.pasta_drive_url && <a className="btn-outline" href={job.cliente.pasta_drive_url} target="_blank" rel="noreferrer">📂 Pasta do cliente</a>}
          <Link className="btn-outline" href={`/campo/jobs/${job.id}`}>Visão do Fast</Link>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <BriefingForm jobId={job.id} briefing={job.briefing} podeEditar={s.ehGestao || s.perfil.perfil === "analista"} />
        <PontoGeofence jobId={job.id} endereco={job.briefing?.local ?? job.endereco ?? ""} ponto={ponto} podeEditar={s.ehGestao || s.perfil.perfil === "analista"} />
      </div>

      {s.ehGestao && (
        <AcoesJob
          job={{ id: job.id, status: job.status, fastId: job.fast_id, data: job.data, slot: job.slot, prazoMaterial: job.prazo_material, dataEdicao: job.data_edicao, blocoEdicao: job.bloco_edicao, pastaIngestUrl: job.pasta_ingest_url, observacoes: job.observacoes, analistaWhatsapp: job.analista_whatsapp }}
          fasts={fasts ?? []}
        />
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Presença (eventos de localização)</h2>
        {s.ehGestao ? (
          localizacoes?.length ? (
            <ul className="divide-y divide-border text-sm">
              {localizacoes.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="capitalize">{e.tipo} · {fmtDataHora(e.capturado_em)}{e.origem_offline ? " (offline)" : ""}</span>
                  <span className={e.dentro_geofence === false ? "text-danger" : e.dentro_geofence ? "text-success" : "text-muted"}>
                    {e.dentro_geofence == null ? "sem geofence" : e.dentro_geofence ? "dentro" : "fora"} · {e.distancia_m != null ? `${Math.round(e.distancia_m)} m` : "—"} · precisão {Math.round(e.precisao_m)} m
                  </span>
                  {e.justificativa && <span className="w-full text-xs text-muted">Justificativa: {e.justificativa}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum evento registrado.{job.duracao_real_min != null && ` Duração real: ${job.duracao_real_min} min.`}</p>
          )
        ) : (
          <p className="text-sm text-muted">Posições visíveis apenas para a supervisão (consulta auditada).</p>
        )}
        {job.duracao_real_min != null && <p className="text-sm">⏱️ Duração real da gravação: <strong>{job.duracao_real_min} min</strong></p>}
        {job.material_entregue_em && <p className="text-sm">📤 Material entregue em {fmtDataHora(job.material_entregue_em)}</p>}
      </section>

      {job.precisa_99 && <CorridasJob jobId={job.id} corridas={corridas ?? []} ehGestao={s.ehGestao} />}

      <ExcecoesJob
        excecoes={(excecoes ?? []).map((e) => ({ id: e.id, tipo: EXCECAO_ROTULO[e.tipo], motivo: e.motivo, aprovada: e.aprovada, parecer: e.parecer, criadoEm: e.criado_em, solicitante: e.solicitante?.nome ?? "—", decisor: e.decisor?.nome ?? null }))}
        ehGestao={s.ehGestao}
      />

      {job.status === "cancelado" && (
        <p className="card text-sm text-muted">Cancelado em {fmtDataHora(job.cancelado_em)} · Motivo: {job.motivo_cancelamento}</p>
      )}
      {job.precisa_99 && corridas?.length ? (
        <p className="text-xs text-muted">Gasto de 99 neste job: {fmtMoeda(corridas.reduce((a, c) => a + (c.valor ?? 0), 0))}</p>
      ) : null}
    </div>
  );
}
