import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { ALERTA_ROTULO, EXCECAO_ROTULO, diasAtrasISO, fmtDataHora } from "@/lib/formato";
import { ListaAlertas } from "./lista-alertas";

export const metadata = { title: "Alertas e exceções" };

/** RF-52 / RF-53 — alertas operacionais e exceções pendentes de decisão. */
export default async function AlertasPage() {
  await exigirGestao();
  const supabase = await criarClienteServidor();
  const [{ data: alertas }, { data: resolvidos }, { data: excecoes }] = await Promise.all([
    supabase.from("alerta").select("*, job:job_id(codigo, cliente:cliente_id(nome), fast:fast_id(nome))").eq("resolvido", false).order("criado_em", { ascending: false }).limit(200),
    supabase.from("alerta").select("*, job:job_id(codigo, cliente:cliente_id(nome), fast:fast_id(nome)), resolvedor:resolvido_por(nome)").eq("resolvido", true).gte("resolvido_em", diasAtrasISO(7)).order("resolvido_em", { ascending: false }).limit(50),
    supabase.from("excecao").select("*, job:job_id(codigo, cliente:cliente_id(nome), fast:fast_id(nome)), solicitante:solicitada_por(nome)").is("aprovada", null).order("criado_em", { ascending: false }),
  ]);
  const paraLista = (a: NonNullable<typeof alertas>[number] & { resolvedor?: { nome: string } | null }) => ({
    id: a.id,
    jobId: a.job_id,
    tipo: ALERTA_ROTULO[a.tipo],
    severidade: a.severidade,
    mensagem: a.mensagem,
    criadoEm: a.criado_em,
    job: a.job ? `#${a.job.codigo} · ${a.job.cliente?.nome} (${a.job.fast?.nome})` : "",
    resolvidoEm: a.resolvido_em,
    resolvidoPor: a.resolvedor?.nome ?? null,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alertas e exceções</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Exceções aguardando decisão ({excecoes?.length ?? 0})</h2>
        {excecoes?.length ? (
          <ul className="space-y-2">
            {excecoes.map((e) => (
              <li key={e.id} className="card flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{EXCECAO_ROTULO[e.tipo]} · Job #{e.job?.codigo} · {e.job?.cliente?.nome} ({e.job?.fast?.nome})</p>
                  <p className="text-muted">Motivo: {e.motivo} · por {e.solicitante?.nome ?? "—"} em {fmtDataHora(e.criado_em)}</p>
                </div>
                <Link href={`/jobs/${e.job_id}`} className="btn-outline">Decidir</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card text-sm text-muted">Nenhuma exceção pendente.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Alertas abertos ({alertas?.length ?? 0})</h2>
        <p className="text-xs text-muted">Ao resolver, o alerta sai desta lista e passa para a seção abaixo, com quem resolveu e quando. Use “Reabrir” em caso de engano.</p>
        <ListaAlertas alertas={(alertas ?? []).map(paraLista)} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Resolvidos nos últimos 7 dias ({resolvidos?.length ?? 0})</h2>
        <ListaAlertas alertas={(resolvidos ?? []).map(paraLista)} modo="resolvidos" />
      </section>
    </div>
  );
}
