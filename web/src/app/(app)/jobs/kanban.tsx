"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alterarStatus } from "@/lib/actions/jobs";
import { STATUS_ORDEM, STATUS_ROTULO, SLOT_ROTULO, fmtData, type JobStatus } from "@/lib/formato";
import { TRANSICOES } from "@/lib/regras";

interface J { id: string; codigo: number; data: string; slot: "manha" | "tarde"; status: JobStatus; cliente: string; fast: string; fast_cor: string; precisa_99: boolean; tem_briefing: boolean; checkin_em: string | null; qtd_alertas_abertos: number }

export function Kanban({ jobs, podeMover }: { jobs: J[]; podeMover: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function mover(id: string, status: JobStatus) {
    setErro(null);
    iniciar(async () => {
      const r = await alterarStatus(id, status);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {erro && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STATUS_ORDEM.filter((s) => s !== "cancelado").map((col) => {
          const itens = jobs.filter((j) => j.status === col);
          return (
            <div key={col} className="w-64 shrink-0 rounded-2xl border border-border bg-card p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{STATUS_ROTULO[col]}</h3>
                <span className="badge bg-border/60">{itens.length}</span>
              </div>
              <div className="space-y-2">
                {itens.map((j) => (
                  <div key={j.id} className="rounded-xl border border-border p-2 text-sm">
                    <Link href={`/jobs/${j.id}`} className="block">
                      <p className="font-medium">{j.cliente}</p>
                      <p className="text-xs text-muted">
                        <span className="mr-1 inline-block size-2 rounded-full" style={{ background: j.fast_cor }} />
                        {j.fast} · {fmtData(j.data, "dd/MM")} {SLOT_ROTULO[j.slot].split(" ")[0]}
                      </p>
                      <p className="mt-1 text-xs">
                        {!j.tem_briefing && <span className="badge mr-1 bg-danger/15 text-danger">sem briefing</span>}
                        {j.precisa_99 && <span className="badge mr-1 bg-warning/15 text-warning">99</span>}
                        {j.qtd_alertas_abertos > 0 && <span className="badge bg-danger/15 text-danger">{j.qtd_alertas_abertos} alerta</span>}
                      </p>
                    </Link>
                    {podeMover && TRANSICOES[col]?.length > 0 && (
                      <select className="input mt-2 min-h-9 text-xs" value="" disabled={pendente} onChange={(e) => e.target.value && mover(j.id, e.target.value as JobStatus)}>
                        <option value="">Mover para…</option>
                        {TRANSICOES[col].map((t) => <option key={t} value={t}>{STATUS_ROTULO[t as JobStatus]}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
