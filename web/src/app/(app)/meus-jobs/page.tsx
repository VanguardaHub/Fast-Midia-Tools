import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { StatusBadge } from "@/components/status-badge";
import { AoVivo } from "@/components/ao-vivo";
import { SLOT_ROTULO, diasAtrasISO, fmtData, hojeISO } from "@/lib/formato";

export const metadata = { title: "Meus jobs" };

/**
 * Visão do analista (Processos 2.x): os jobs que ele criou ou pelos quais responde, organizados pelo que
 * exige ação dele — briefing pendente, ponto do job a confirmar, material a receber e comprovantes de 99.
 */
export default async function MeusJobsPage() {
  const s = await obterSessao();
  if (s.perfil.perfil !== "analista" && !s.ehGestao) redirect("/");
  const supabase = await criarClienteServidor();
  const hoje = hojeISO();
  const { data: jobs, error } = await supabase
    .from("job")
    .select("id, codigo, data, slot, status, precisa_99, ponto_confirmado, prazo_material, data_edicao, material_entregue_em, pasta_ingest_url, cliente:cliente_id(nome), fast:fast_id(nome, cor), briefing(id), corridas:corrida_99(sentido, comprovante_path, validada)")
    .or(`analista_id.eq.${s.usuarioId},criado_por.eq.${s.usuarioId}`)
    .neq("status", "cancelado")
    .gte("data", diasAtrasISO(60))
    .order("data")
    .order("inicio");

  const lista = jobs ?? [];
  const semBriefing = lista.filter((j) => !j.briefing && j.data >= hoje);
  const semPonto = lista.filter((j) => j.briefing && !j.ponto_confirmado && j.data >= hoje);
  const proximos = lista.filter((j) => j.data >= hoje && j.status !== "concluido");
  const emProducao = lista.filter((j) => ["em_gravacao", "material_entregue", "em_edicao"].includes(j.status));
  const comprovantesPendentes = lista.filter((j) => j.precisa_99 && j.data < hoje && j.status !== "concluido" && (j.corridas ?? []).filter((c) => c.comprovante_path).length < 2);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meus jobs</h1>
          <p className="text-sm text-muted">{s.perfil.nome} · {fmtData(hoje, "EEEE, dd 'de' MMMM")} · <AoVivo tabelas={["job", "briefing", "corrida_99"]} canal="meus-jobs" /></p>
        </div>
        <Link href="/agenda" className="btn-primary">+ Agendar job</Link>
      </header>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Falha ao consultar os jobs: {error.message}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Briefing pendente" valor={semBriefing.length} tom={semBriefing.length ? "alerta" : "ok"} />
        <Kpi rotulo="Ponto a confirmar" valor={semPonto.length} tom={semPonto.length ? "alerta" : "ok"} />
        <Kpi rotulo="Em produção" valor={emProducao.length} />
        <Kpi rotulo="Comprovantes 99 pendentes" valor={comprovantesPendentes.length} tom={comprovantesPendentes.length ? "alerta" : "ok"} />
      </div>

      {semBriefing.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">⚠️ Briefing pendente — nenhuma gravação começa sem briefing (Processos 2.2)</h2>
          <ul className="space-y-2">{semBriefing.map((j) => <LinhaJob key={j.id} job={j} acao="Preencher briefing" />)}</ul>
        </section>
      )}

      {semPonto.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">📍 Ponto do job a confirmar no mapa (RF-36)</h2>
          <ul className="space-y-2">{semPonto.map((j) => <LinhaJob key={j.id} job={j} acao="Confirmar ponto" />)}</ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Próximos jobs</h2>
        {proximos.length ? (
          <ul className="space-y-2">{proximos.map((j) => <LinhaJob key={j.id} job={j} />)}</ul>
        ) : (
          <p className="card text-sm text-muted">Nenhum job futuro. Agende pela Agenda.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Em produção (gravado, material e edição)</h2>
        {emProducao.length ? (
          <ul className="space-y-2">{emProducao.map((j) => <LinhaJob key={j.id} job={j} acao={j.pasta_ingest_url ? "Abrir pasta de ingest" : undefined} hrefAcao={j.pasta_ingest_url ?? undefined} />)}</ul>
        ) : (
          <p className="card text-sm text-muted">Nada em produção no momento.</p>
        )}
      </section>

      {comprovantesPendentes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">🚗 Comprovantes de 99 pendentes (cobrar o Fast; bloqueia “Concluído”)</h2>
          <ul className="space-y-2">{comprovantesPendentes.map((j) => <LinhaJob key={j.id} job={j} acao="Ver corridas" />)}</ul>
        </section>
      )}

      <p className="text-xs text-muted">Mostra jobs dos últimos 60 dias que você criou ou nos quais é o analista responsável. A supervisão vê todos em Jobs.</p>
    </div>
  );
}

type JobLinha = {
  id: string; codigo: number; data: string; slot: "manha" | "tarde"; status: Parameters<typeof StatusBadge>[0]["status"]; precisa_99: boolean;
  prazo_material: string | null; data_edicao: string | null; material_entregue_em: string | null;
  cliente: { nome: string } | null; fast: { nome: string; cor: string } | null; briefing: { id: string } | null;
  corridas: { sentido: string; comprovante_path: string | null; validada: boolean }[] | null;
};

function LinhaJob({ job: j, acao, hrefAcao }: { job: JobLinha; acao?: string; hrefAcao?: string }) {
  const comprovantes = (j.corridas ?? []).filter((c) => c.comprovante_path).length;
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 py-3">
      <Link href={`/jobs/${j.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium">
          <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: j.fast?.cor }} />
          {j.cliente?.nome} · {j.fast?.nome}
        </p>
        <p className="text-xs text-muted">
          {fmtData(j.data, "EEE dd/MM")} · {SLOT_ROTULO[j.slot]} · #{j.codigo}
          {j.prazo_material && ` · material até ${fmtData(j.prazo_material, "dd/MM")}`}
          {j.data_edicao && ` · edição ${fmtData(j.data_edicao, "dd/MM")}`}
          {j.precisa_99 && ` · 99: ${comprovantes}/2 comprovantes`}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        <StatusBadge status={j.status} />
        {acao && (hrefAcao ? (
          <a href={hrefAcao} target="_blank" rel="noreferrer" className="btn-outline min-h-9 text-xs">{acao}</a>
        ) : (
          <Link href={`/jobs/${j.id}`} className="btn-outline min-h-9 text-xs">{acao}</Link>
        ))}
      </div>
    </li>
  );
}

function Kpi({ rotulo, valor, tom = "neutro" }: { rotulo: string; valor: number; tom?: "ok" | "alerta" | "neutro" }) {
  const cls = tom === "ok" ? "text-success" : tom === "alerta" ? "text-warning" : "";
  return (
    <div className="card">
      <p className="text-xs text-muted">{rotulo}</p>
      <p className={`text-2xl font-bold ${cls}`}>{valor}</p>
    </div>
  );
}
