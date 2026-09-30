import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { diasAtrasISO, fmtData, fmtMoeda, hojeISO } from "@/lib/formato";

export const metadata = { title: "Indicadores" };

/**
 * OKRs (seção 3.2) e métricas da pesquisa (protocolo em docs/pesquisa).
 * RF-44 gasto de 99; RF-54 as mesmas views alimentam o Power BI.
 */
export default async function IndicadoresPage(props: PageProps<"/indicadores">) {
  await exigirGestao();
  const sp = await props.searchParams;
  const fim = typeof sp.fim === "string" ? sp.fim : hojeISO();
  const inicio = typeof sp.inicio === "string" ? sp.inicio : diasAtrasISO(30);
  const supabase = await criarClienteServidor();
  const [{ data: okr }, { data: gasto }, { data: jobs }] = await Promise.all([
    supabase.schema("analytics").rpc("indicadores_okr", { p_inicio: inicio, p_fim: fim }),
    supabase.schema("analytics").from("vw_gasto_99_por_fast_dia").select("*").gte("data", inicio).lte("data", fim).order("data", { ascending: false }),
    supabase.schema("analytics").from("vw_jobs").select("status").gte("data", inicio).lte("data", fim),
  ]);

  const porStatus = (jobs ?? []).reduce<Record<string, number>>((acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }), {});
  const gastoPorFast = (gasto ?? []).reduce<Record<string, { total: number; jobs: number; comComprovante: number }>>((acc, g) => {
    const a = acc[g.fast] ?? { total: 0, jobs: 0, comComprovante: 0 };
    return { ...acc, [g.fast]: { total: a.total + (g.gasto_total ?? 0), jobs: a.jobs + g.jobs_com_99, comComprovante: a.comComprovante + g.jobs_com_comprovantes } };
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Indicadores e OKRs</h1>
          <p className="text-sm text-muted">Período {fmtData(inicio)} a {fmtData(fim)} · linha de base e metas conforme seção 3.2 do escopo</p>
        </div>
        <form className="flex gap-2">
          <input type="date" name="inicio" defaultValue={inicio} className="input" />
          <input type="date" name="fim" defaultValue={fim} className="input" />
          <button className="btn-outline">Aplicar</button>
        </form>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-border text-left"><th className="p-3">Objetivo</th><th className="p-3">Resultado-chave</th><th className="p-3">Meta</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">n</th></tr></thead>
          <tbody>
            {(okr ?? []).map((k) => (
              <tr key={k.indicador} className="border-b border-border last:border-0">
                <td className="p-3 text-muted">{k.objetivo}</td>
                <td className="p-3">{k.indicador}</td>
                <td className="p-3">{k.meta}</td>
                <td className="p-3 text-right text-lg font-bold">{k.valor ?? "—"}</td>
                <td className="p-3 text-right text-xs text-muted">{k.numerador != null && k.denominador != null ? `${k.numerador}/${k.denominador}` : k.denominador ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold">Jobs por status</h2>
          <ul className="text-sm">
            {Object.entries(porStatus).map(([s, n]) => (
              <li key={s} className="flex justify-between border-b border-border py-1 last:border-0"><span>{s}</span><strong>{n}</strong></li>
            ))}
            {Object.keys(porStatus).length === 0 && <li className="text-muted">Sem jobs no período.</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Gasto de 99 por Fast (RF-44)</h2>
          <ul className="text-sm">
            {Object.entries(gastoPorFast).map(([f, g]) => (
              <li key={f} className="flex justify-between border-b border-border py-1 last:border-0">
                <span>{f} <span className="text-muted">({g.comComprovante}/{g.jobs} com comprovantes)</span></span>
                <strong>{fmtMoeda(g.total)}</strong>
              </li>
            ))}
            {Object.keys(gastoPorFast).length === 0 && <li className="text-muted">Sem corridas no período.</li>}
          </ul>
        </section>
      </div>

      <p className="text-xs text-muted">
        Fonte: views <code>analytics.vw_jobs</code>, <code>analytics.vw_gasto_99</code> e função <code>analytics.indicadores_okr</code> — as mesmas usadas pelo Power BI (RF-54).
        Os valores servem de linha de base para a Fase 0 e de evidência para o go/no-go (seção 13.3).
      </p>
    </div>
  );
}
