"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { salvarCorrida } from "@/lib/actions/campo";
import { fmtMoeda } from "@/lib/formato";
import type { Database } from "@/lib/database.types";

type Corrida = Database["public"]["Tables"]["corrida_99"]["Row"];

/** RF-41 / RF-42 / RF-44 — comprovantes de ida e volta com valor, direto no app. */
export function Comprovantes99({ jobId, corridas }: { jobId: string; corridas: Corrida[] }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Corridas de 99</h2>
        <p className="text-xs text-muted">Os dois comprovantes são obrigatórios para concluir o job. Prazo: mesmo dia, até o fim do expediente.</p>
      </div>
      {(["ida", "volta"] as const).map((s) => (
        <FormCorrida key={s} jobId={jobId} sentido={s} corrida={corridas.find((c) => c.sentido === s) ?? null} />
      ))}
    </section>
  );
}

function FormCorrida({ jobId, sentido, corrida }: { jobId: string; sentido: "ida" | "volta"; corrida: Corrida | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(corrida?.valor?.toString() ?? "");
  const [destino, setDestino] = useState(corrida?.destino ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const bloqueado = corrida?.validada ?? false;

  function enviar() {
    setErro(null);
    iniciar(async () => {
      let path = corrida?.comprovante_path ?? null;
      if (arquivo) {
        const supabase = criarClienteBrowser();
        const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const novoPath = `${jobId}/${sentido}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("comprovantes-99").upload(novoPath, arquivo, { upsert: true, contentType: arquivo.type });
        if (error) {
          setErro(`Falha no upload: ${error.message}`);
          return;
        }
        path = novoPath;
      }
      const r = await salvarCorrida({ jobId, sentido, valor: valor ? Number(valor.replace(",", ".")) : null, comprovantePath: path, destino });
      if (!r.ok) setErro(r.erro);
      else {
        setArquivo(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium capitalize">{sentido}</p>
        {corrida?.comprovante_path ? (
          <span className="badge bg-success/15 text-success">{corrida.validada ? "validada" : "comprovante anexado"}</span>
        ) : (
          <span className="badge bg-danger/15 text-danger">pendente</span>
        )}
      </div>
      {corrida?.valor != null && <p className="text-sm text-muted">Valor registrado: {fmtMoeda(corrida.valor)}</p>}
      {!bloqueado && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" inputMode="decimal" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
            <input className="input" placeholder={sentido === "ida" ? "Destino (cliente)" : "Destino (retorno)"} value={destino} onChange={(e) => setDestino(e.target.value)} />
          </div>
          <input type="file" accept="image/*,application/pdf" capture="environment" className="block w-full text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <button className="btn-outline w-full" disabled={pendente || (!arquivo && !corrida?.comprovante_path)} onClick={enviar}>
            {pendente ? "Salvando…" : corrida?.comprovante_path ? "Atualizar" : "Enviar comprovante"}
          </button>
        </>
      )}
    </div>
  );
}
