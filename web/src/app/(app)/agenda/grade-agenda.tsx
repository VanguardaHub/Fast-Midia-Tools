"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SLOT_ROTULO, STATUS_COR } from "@/lib/formato";
import { detectarConflitos } from "@/lib/regras";
import { NovoJobForm } from "./novo-job-form";
import { useRouter } from "next/navigation";
import { removerIndisponibilidade } from "@/lib/actions/disponibilidade";

type Slot = "manha" | "tarde";
interface Fast { id: string; nome: string; cor: string }
interface Indisponibilidade { id: string; fast_id: string; data: string; slot: Slot | null; motivo: string | null }
interface JobResumo { id: string; codigo: number; fast_id: string; data: string; slot: Slot; status: string; cliente: string }
interface Cliente { id: string; nome: string; grupo: string | null }

export function GradeAgenda({ dias, fasts, jobs, clientes, indisponibilidades, ehGestao }: {
  dias: string[]; fasts: Fast[]; jobs: JobResumo[]; clientes: Cliente[];
  indisponibilidades: Indisponibilidade[]; ehGestao: boolean;
}) {
  const router = useRouter();
  const [selecao, setSelecao] = useState<{ fastId: string; data: string; slot: Slot; indisponivel?: Indisponibilidade } | null>(null);

  /** RF-10 — gestão clica num slot indisponível: remove a marcação ou agenda mesmo assim (com motivo). */
  function abrirIndisponivel(fastId: string, data: string, slot: Slot, ind: Indisponibilidade) {
    if (!ehGestao) return;
    const remover = confirm(`O Fast marcou este ${ind.slot ? "turno" : "dia"} como indisponível${ind.motivo ? ` (${ind.motivo})` : ""}.\n\nOK = remover a indisponibilidade\nCancelar = agendar mesmo assim, informando o motivo`);
    if (remover) {
      removerIndisponibilidade(ind.id).then((r) => { if (!r.ok) alert(r.erro); router.refresh(); });
      return;
    }
    setSelecao({ fastId, data, slot, indisponivel: ind });
  }
  const mapa = useMemo(() => {
    const m = new Map<string, JobResumo>();
    for (const j of jobs) m.set(`${j.fast_id}|${j.data}|${j.slot}`, j);
    return m;
  }, [jobs]);

  const conflitosSelecao = selecao
    ? detectarConflitos({ fastId: selecao.fastId, data: selecao.data, slot: selecao.slot }, jobs.map((j) => ({ id: j.id, fastId: j.fast_id, data: j.data, slot: j.slot, status: j.status })))
    : [];

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2">Fast</th>
              {dias.map((d) => (
                <th key={d} className="p-2 text-center">
                  <div className="font-semibold capitalize">{format(parseISO(d), "EEE", { locale: ptBR })}</div>
                  <div className="text-xs text-muted">{format(parseISO(d), "dd/MM")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fasts.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <td className="p-2 font-medium">
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: f.cor }} />
                  {f.nome}
                </td>
                {dias.map((d) => (
                  <td key={d} className="p-1 align-top">
                    <div className="grid gap-1">
                      {(["manha", "tarde"] as Slot[]).map((slot) => {
                        const j = mapa.get(`${f.id}|${d}|${slot}`);
                        const ind = indisponibilidades.find((b) => b.fast_id === f.id && b.data === d && (b.slot === null || b.slot === slot));
                        const bloqueado = Boolean(ind);
                        if (j) {
                          return (
                            <Link key={slot} href={`/jobs/${j.id}`} className={`block truncate rounded-lg px-2 py-1.5 text-xs ${STATUS_COR[j.status as keyof typeof STATUS_COR]}`} title={`${j.cliente} · ${SLOT_ROTULO[slot]}`}>
                              {slot === "manha" ? "M" : "T"} · {j.cliente}
                            </Link>
                          );
                        }
                        return (
                          <button
                            key={slot}
                            disabled={bloqueado && !ehGestao}
                            title={bloqueado ? `Fast indisponível${ind?.motivo ? `: ${ind.motivo}` : ""}${ehGestao ? " — clique para remover ou agendar com motivo" : ""}` : `Agendar ${SLOT_ROTULO[slot]}`}
                            onClick={() => (bloqueado && ind ? abrirIndisponivel(f.id, d, slot, ind) : setSelecao({ fastId: f.id, data: d, slot }))}
                            className={`rounded-lg border px-2 py-1.5 text-left text-xs ${bloqueado ? "border-warning/40 bg-warning/10 text-warning" : "border-dashed border-border text-muted hover:border-primary hover:text-primary"} disabled:opacity-70`}
                          >
                            {slot === "manha" ? "Manhã" : "Tarde"} · {bloqueado ? "indisponível" : "livre"}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {fasts.length === 0 && (
              <tr><td colSpan={dias.length + 1} className="p-4 text-center text-muted">Nenhum Fast cadastrado. <Link href="/cadastros/fasts" className="text-primary underline">Cadastrar</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selecao && (
        <NovoJobForm
          selecao={selecao}
          fast={fasts.find((f) => f.id === selecao.fastId)!}
          clientes={clientes}
          conflitos={conflitosSelecao}
          indisponivel={selecao.indisponivel ? { motivo: selecao.indisponivel.motivo, diaInteiro: selecao.indisponivel.slot === null } : undefined}
          ehGestao={ehGestao}
          onFechar={() => setSelecao(null)}
        />
      )}
    </>
  );
}
