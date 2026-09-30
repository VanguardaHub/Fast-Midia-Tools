"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarMaterialEntregue } from "@/lib/actions/campo";

export function MaterialEntregue({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">Material bruto</h2>
      <p className="text-sm text-muted">Suba o material na pasta de ingest até 24h após o fim da gravação e confirme aqui (Processos 1.3).</p>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <button
        className="btn-primary w-full"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await marcarMaterialEntregue(jobId);
            if (!r.ok) setErro(r.erro);
            else router.refresh();
          })
        }
      >
        📤 Material bruto entregue
      </button>
    </section>
  );
}
