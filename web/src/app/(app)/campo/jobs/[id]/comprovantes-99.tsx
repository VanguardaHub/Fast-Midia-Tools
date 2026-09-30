"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { salvarCorrida } from "@/lib/actions/campo";
import { fmtMoeda } from "@/lib/formato";
import { SeletorArquivo } from "@/components/seletor-arquivo";
import type { Database } from "@/lib/database.types";

type Corrida = Database["public"]["Tables"]["corrida_99"]["Row"];

/** RF-41 / RF-42 / RF-44 — comprovantes de ida e volta com valor, direto no app. */
export function Comprovantes99({ jobId, corridas }: { jobId: string; corridas: Corrida[] }) {
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Corridas de 99</h2>
        <p className="text-xs text-muted">Os dois comprovantes (ida e volta) são obrigatórios para concluir o job. Prazo: mesmo dia, até o fim do expediente.</p>
      </div>
      {(["ida", "volta"] as const).map((s) => (
        <FormCorrida key={s} jobId={jobId} sentido={s} corrida={corridas.find((c) => c.sentido === s) ?? null} />
      ))}
    </section>
  );
}

function FormCorrida({ jobId, sentido, corrida }: { jobId: string; sentido: "ida" | "volta"; corrida: Corrida | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(corrida?.valor?.toString().replace(".", ",") ?? "");
  const [destino, setDestino] = useState(corrida?.destino ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fase, setFase] = useState<"idle" | "enviando" | "salvando">("idle");
  const [pendente, iniciar] = useTransition();
  const bloqueado = corrida?.validada ?? false;
  const temAlgo = Boolean(arquivo) || valor.trim() !== "" || destino.trim() !== "";

  function enviar() {
    setErro(null);
    iniciar(async () => {
      let path = corrida?.comprovante_path ?? null;
      if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) { setErro("Arquivo acima de 10 MB."); return; }
        setFase("enviando");
        const supabase = criarClienteBrowser();
        const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
        const novoPath = `${jobId}/${sentido}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("comprovantes-99").upload(novoPath, arquivo, { upsert: true, contentType: arquivo.type || undefined });
        if (error) { setFase("idle"); setErro(`Falha no upload: ${error.message}`); return; }
        path = novoPath;
      }
      setFase("salvando");
      const v = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
      if (valor.trim() && (v === null || Number.isNaN(v))) { setFase("idle"); setErro("Valor inválido. Use o formato 18,50."); return; }
      const r = await salvarCorrida({ jobId, sentido, valor: v, comprovantePath: path, destino });
      setFase("idle");
      if (!r.ok) setErro(r.erro);
      else { setArquivo(null); router.refresh(); }
    });
  }

  const ocupado = pendente || fase !== "idle";
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="font-medium capitalize">{sentido}</p>
        {corrida?.comprovante_path ? (
          <span className="badge bg-success/15 text-success">{corrida.validada ? "validada" : "comprovante anexado"}</span>
        ) : (
          <span className="badge bg-danger/15 text-danger">sem comprovante</span>
        )}
      </div>
      {corrida?.valor != null && <p className="text-sm text-muted">Valor registrado: {fmtMoeda(corrida.valor)}{corrida.destino ? ` · destino: ${corrida.destino}` : ""}</p>}
      {!bloqueado && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" inputMode="decimal" placeholder="18,50" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <label className="label">Destino</label>
              <input className="input" placeholder={sentido === "ida" ? "Cliente" : "Retorno"} value={destino} onChange={(e) => setDestino(e.target.value)} />
            </div>
          </div>
          <SeletorArquivo arquivo={arquivo} onChange={setArquivo} rotulo={corrivaRotulo(corrida)} />
          {erro && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{erro}</p>}
          <button type="button" className="btn-primary w-full" disabled={ocupado || !temAlgo} onClick={enviar}>
            {fase === "enviando" ? "Enviando arquivo…" : fase === "salvando" ? "Salvando…" : arquivo ? "Enviar comprovante" : corrida ? "Salvar alterações" : "Salvar"}
          </button>
          {!arquivo && !corrida?.comprovante_path && <p className="text-center text-xs text-muted">Você pode salvar o valor agora e anexar o print depois.</p>}
        </>
      )}
      {bloqueado && <p className="text-xs text-muted">Corrida validada pela supervisão; edição bloqueada.</p>}
    </div>
  );
}

function corrivaRotulo(corrida: Corrida | null): string {
  return corrida?.comprovante_path ? "📷 Substituir comprovante" : "📷 Tirar foto ou escolher o print";
}
