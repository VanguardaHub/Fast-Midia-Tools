"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { validarCorrida } from "@/lib/actions/jobs";
import { fmtMoeda } from "@/lib/formato";
import type { Database } from "@/lib/database.types";

type Corrida = Database["public"]["Tables"]["corrida_99"]["Row"];

/** RF-41 / RF-43 / RF-44 — conciliação das corridas pela supervisora. */
export function CorridasJob({ corridas, ehGestao }: { jobId: string; corridas: Corrida[]; ehGestao: boolean }) {
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    const supabase = criarClienteBrowser();
    (async () => {
      const m: Record<string, string> = {};
      for (const c of corridas) {
        if (!c.comprovante_path) continue;
        const { data } = await supabase.storage.from("comprovantes-99").createSignedUrl(c.comprovante_path, 600);
        if (data?.signedUrl) m[c.id] = data.signedUrl;
      }
      setUrls(m);
    })();
  }, [corridas]);

  const total = corridas.reduce((a, c) => a + (c.valor ?? 0), 0);
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Corridas de 99</h2>
        <span className="text-sm">Total: <strong>{fmtMoeda(total)}</strong></span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["ida", "volta"] as const).map((s) => {
          const c = corridas.find((x) => x.sentido === s);
          return (
            <div key={s} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium capitalize">{s}</p>
                {c?.comprovante_path ? (
                  <span className={`badge ${c.validada ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>{c.validada ? "validada" : "a conciliar"}</span>
                ) : (
                  <span className="badge bg-danger/15 text-danger">sem comprovante</span>
                )}
              </div>
              {c && (
                <>
                  <p>Valor: {fmtMoeda(c.valor)}</p>
                  {c.destino && <p className="text-muted">Destino: {c.destino}{c.divergencia_destino ? " ⚠️ divergente" : ""}</p>}
                  {urls[c.id] && <a className="text-primary underline" href={urls[c.id]} target="_blank" rel="noreferrer">Ver comprovante</a>}
                  {ehGestao && c.comprovante_path && (
                    <div className="mt-2 flex gap-2">
                      <button className={c.validada ? "btn-outline" : "btn-primary"} disabled={pendente} onClick={() => iniciar(async () => { const r = await validarCorrida(c.id, !c.validada); if (!r.ok) setErro(r.erro); else router.refresh(); })}>
                        {c.validada ? "Desfazer validação" : "Validar corrida"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <p className="text-xs text-muted">Job não pode ser concluído sem os dois comprovantes (RF-42). Meta OKR: ≥ 95% das corridas validadas.</p>
    </section>
  );
}
