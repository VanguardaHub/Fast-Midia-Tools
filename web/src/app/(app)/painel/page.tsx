import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { ALERTA_ROTULO, SLOT_ROTULO, diasAtrasISO, fmtData, fmtHora, hojeISO } from "@/lib/formato";

export const metadata = { title: "Painel" };

export default async function PainelPage() {
  await exigirGestao();
  const supabase = await criarClienteServidor();
  const hoje = hojeISO();
  const [{ data: jobsHoje, error: erroJobs }, { data: alertas }, { data: excecoes }, { data: okr }] = await Promise.all([
    supabase.schema("analytics").from("vw_jobs").select("*").eq("data", hoje).neq("status", "cancelado").order("inicio"),
    supabase.from("alerta").select("id, tipo, severidade, mensagem, criado_em, job_id").eq("resolvido", false).order("criado_em", { ascending: false }).limit(8),
    supabase.from("excecao").select("id", { count: "exact", head: true }).is("aprovada", null),
    supabase.schema("analytics").rpc("indicadores_okr", { p_inicio: diasAtrasISO(30), p_fim: hoje }),
  ]);

  const total = jobsHoje?.length ?? 0;
  const comCheckin = jobsHoje?.filter((j) => j.checkin_em).length ?? 0;
  const semBriefing = jobsHoje?.filter((j) => !j.tem_briefing).length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Painel da supervisora</h1>
          <p className="text-sm text-muted">{fmtData(hoje, "EEEE, dd 'de' MMMM 'de' yyyy")}</p>
        </div>
        <Link href="/agenda" className="btn-primary">+ Novo job</Link>
      </header>

      {erroJobs && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Falha ao consultar os jobs: {erroJobs.message}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Jobs hoje" valor={String(total)} />
        <Kpi rotulo="Com check-in" valor={`${comCheckin}/${total}`} tom={comCheckin === total && total > 0 ? "ok" : "neutro"} />
        <Kpi rotulo="Sem briefing" valor={String(semBriefing)} tom={semBriefing > 0 ? "alerta" : "ok"} />
        <Kpi rotulo="Exceções pendentes" valor={String(excecoes?.length ?? (excecoes as unknown as { count?: number })?.count ?? 0)} href="/alertas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Jobs do dia</h2>
            <Link href="/mapa" className="text-sm text-primary underline">Ver mapa</Link>
          </div>
          {total === 0 ? (
            <p className="text-sm text-muted">Nenhum job hoje.</p>
          ) : (
            <ul className="divide-y divide-border">
              {jobsHoje!.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: j.fast_cor }} />
                      {j.cliente} · {j.fast}
                    </p>
                    <p className="text-xs text-muted">
                      {SLOT_ROTULO[j.slot]} · #{j.codigo}
                      {j.checkin_em && ` · check-in ${fmtHora(j.checkin_em)}${j.checkin_dentro_geofence === false ? " (fora da geofence)" : ""}`}
                      {!j.tem_briefing && " · sem briefing"}
                    </p>
                  </Link>
                  <StatusBadge status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Alertas abertos</h2>
            <Link href="/alertas" className="text-sm text-primary underline">Todos</Link>
          </div>
          {alertas?.length ? (
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li key={a.id} className={`rounded-xl p-2 text-sm ${a.severidade === "critico" ? "bg-danger/10" : "bg-warning/10"}`}>
                  <p className="font-medium">{ALERTA_ROTULO[a.tipo]}</p>
                  <p className="text-xs text-muted">{a.mensagem}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum alerta aberto.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">OKRs — últimos 30 dias</h2>
          <Link href="/indicadores" className="text-sm text-primary underline">Detalhar</Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(okr ?? []).slice(0, 6).map((k) => (
            <div key={k.indicador} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted">{k.indicador}</p>
              <p className="text-xl font-bold">{k.valor ?? "—"}</p>
              <p className="text-xs text-muted">meta {k.meta}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ rotulo, valor, tom = "neutro", href }: { rotulo: string; valor: string; tom?: "ok" | "alerta" | "neutro"; href?: string }) {
  const cls = tom === "ok" ? "text-success" : tom === "alerta" ? "text-warning" : "";
  const inner = (
    <div className="card">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={`text-2xl font-bold ${cls}`}>{valor}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
