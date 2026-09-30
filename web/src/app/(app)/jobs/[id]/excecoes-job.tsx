"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirExcecao } from "@/lib/actions/jobs";
import { fmtDataHora } from "@/lib/formato";

interface E { id: string; tipo: string; motivo: string; aprovada: boolean | null; parecer: string | null; criadoEm: string; solicitante: string; decisor: string | null }

/** RF-53 / Processos 6 — registro de decisões da supervisora. */
export function ExcecoesJob({ excecoes, ehGestao }: { excecoes: E[]; ehGestao: boolean }) {
  const router = useRouter();
  const [parecer, setParecer] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function decidir(id: string, aprovada: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await decidirExcecao(id, aprovada, parecer[id]);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Exceções e decisões</h2>
      {excecoes.length === 0 ? <p className="text-sm text-muted">Nenhuma exceção registrada.</p> : (
        <ul className="space-y-2">
          {excecoes.map((e) => (
            <li key={e.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{e.tipo}</p>
                <span className={`badge ${e.aprovada === null ? "bg-warning/15 text-warning" : e.aprovada ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                  {e.aprovada === null ? "pendente" : e.aprovada ? "aprovada" : "recusada"}
                </span>
              </div>
              <p className="text-muted">Motivo: {e.motivo}</p>
              <p className="text-xs text-muted">Solicitada por {e.solicitante} em {fmtDataHora(e.criadoEm)}{e.decisor ? ` · decidida por ${e.decisor}` : ""}</p>
              {e.parecer && <p className="text-xs">Parecer: {e.parecer}</p>}
              {ehGestao && e.aprovada === null && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input className="input flex-1" placeholder="Parecer (opcional)" value={parecer[e.id] ?? ""} onChange={(ev) => setParecer({ ...parecer, [e.id]: ev.target.value })} />
                  <button className="btn-primary" disabled={pendente} onClick={() => decidir(e.id, true)}>Aprovar</button>
                  <button className="btn-outline" disabled={pendente} onClick={() => decidir(e.id, false)}>Recusar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </section>
  );
}
