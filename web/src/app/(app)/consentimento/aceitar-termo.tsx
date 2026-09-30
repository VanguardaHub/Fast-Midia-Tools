"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aceitarTermo } from "@/lib/actions/conta";

export function AceitarTermo({ versao, next }: { versao: string; next: string }) {
  const router = useRouter();
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="card space-y-4">
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" className="mt-1 size-5" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
        <span>Li e estou ciente das condições de coleta da minha localização nos eventos do job.</span>
      </label>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button
        className="btn-primary w-full"
        disabled={!ciente || pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await aceitarTermo(versao);
            if (!r.ok) setErro(r.erro);
            else {
              router.replace(next);
              router.refresh();
            }
          })
        }
      >
        {pendente ? "Registrando…" : "Registrar ciência"}
      </button>
    </div>
  );
}
