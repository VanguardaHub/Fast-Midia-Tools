import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { STATUS_ORDEM, STATUS_ROTULO, SLOT_ROTULO, diasAtrasISO, fmtData } from "@/lib/formato";
import { Kanban } from "./kanban";
import { AoVivo } from "@/components/ao-vivo";

export const metadata = { title: "Jobs" };

/** RF-50 — Kanban por status (mesmos status do Notion). */
export default async function JobsPage(props: PageProps<"/jobs">) {
  const s = await obterSessao();
  const sp = await props.searchParams;
  const visao = sp.visao === "lista" ? "lista" : "kanban";
  const supabase = await criarClienteServidor();
  const { data: jobs, error } = await supabase
    .schema("analytics")
    .from("vw_jobs")
    .select("id, codigo, data, slot, status, cliente, fast, fast_cor, precisa_99, tem_briefing, checkin_em, qtd_alertas_abertos")
    .gte("data", diasAtrasISO(45))
    .order("data", { ascending: false })
    .order("inicio", { ascending: false })
    .limit(400);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">Jobs</h1><AoVivo tabelas={["job", "briefing", "alerta", "corrida_99"]} canal="jobs" /></div>
        <div className="flex gap-2">
          <Link href="/jobs?visao=kanban" className={`btn-outline ${visao === "kanban" ? "border-primary text-primary" : ""}`}>Kanban</Link>
          <Link href="/jobs?visao=lista" className={`btn-outline ${visao === "lista" ? "border-primary text-primary" : ""}`}>Lista</Link>
          <Link href="/agenda" className="btn-primary">+ Novo</Link>
        </div>
      </header>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Falha ao consultar os jobs: {error.message}</p>}
      {visao === "kanban" ? (
        <Kanban jobs={jobs ?? []} podeMover={s.ehGestao} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border text-left"><th className="p-2">#</th><th className="p-2">Data</th><th className="p-2">Cliente</th><th className="p-2">Fast</th><th className="p-2">Status</th><th className="p-2">Flags</th></tr></thead>
            <tbody>
              {(jobs ?? []).map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0">
                  <td className="p-2"><Link href={`/jobs/${j.id}`} className="text-primary underline">{j.codigo}</Link></td>
                  <td className="p-2">{fmtData(j.data)} · {SLOT_ROTULO[j.slot]}</td>
                  <td className="p-2">{j.cliente}</td>
                  <td className="p-2"><span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: j.fast_cor }} />{j.fast}</td>
                  <td className="p-2">{STATUS_ROTULO[j.status]}</td>
                  <td className="p-2 text-xs text-muted">{!j.tem_briefing && "sem briefing · "}{j.precisa_99 && "99 · "}{j.qtd_alertas_abertos > 0 && `${j.qtd_alertas_abertos} alerta(s)`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">Colunas: {STATUS_ORDEM.map((s) => STATUS_ROTULO[s]).join(" → ")}. &ldquo;Concluído&rdquo; exige os dois comprovantes de 99 quando aplicável (RF-42).</p>
    </div>
  );
}
