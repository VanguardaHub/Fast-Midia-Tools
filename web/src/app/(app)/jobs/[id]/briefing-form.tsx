"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { salvarBriefing } from "@/lib/actions/jobs";
import { fmtDataHora } from "@/lib/formato";
import { SeletorArquivo } from "@/components/seletor-arquivo";
import type { Database } from "@/lib/database.types";

type Briefing = Database["public"]["Tables"]["briefing"]["Row"];

/** RF-20 — briefing no app (campos do docs/forms-briefing-campos.md). */
export function BriefingForm({ jobId, briefing, podeEditar }: { jobId: string; briefing: Briefing | null; podeEditar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(!briefing);
  const [local, setLocal] = useState(briefing?.local ?? "");
  const [roteiro, setRoteiro] = useState(briefing?.roteiro ?? "");
  const [obs, setObs] = useState(briefing?.observacoes ?? "");
  const [precisa99, setPrecisa99] = useState(briefing?.precisa_99 ?? false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      let referenciaVisualPath = briefing?.referencia_visual_path ?? undefined;
      if (arquivo) {
        const supabase = criarClienteBrowser();
        const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${jobId}/referencia-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("referencias-briefing").upload(path, arquivo, { upsert: true, contentType: arquivo.type });
        if (error) { setErro(`Upload falhou: ${error.message}`); return; }
        referenciaVisualPath = path;
      }
      const r = await salvarBriefing(jobId, { local, roteiro, observacoes: obs, precisa99, referenciaVisualPath });
      if (!r.ok) setErro(r.erro);
      else { setEditando(false); router.refresh(); }
    });
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Briefing {briefing ? "" : <span className="badge bg-danger/15 text-danger">pendente</span>}</h2>
        {briefing && podeEditar && !editando && <button className="text-sm text-primary underline" onClick={() => setEditando(true)}>Editar</button>}
      </div>
      {briefing && !editando ? (
        <div className="space-y-1 text-sm">
          <p><span className="text-muted">📍 Local:</span> {briefing.local}</p>
          <p className="whitespace-pre-line"><span className="text-muted">📝 Roteiro:</span> {briefing.roteiro}</p>
          {briefing.observacoes && <p className="whitespace-pre-line"><span className="text-muted">💬 Obs:</span> {briefing.observacoes}</p>}
          <p><span className="text-muted">🚗 Precisa de 99:</span> {briefing.precisa_99 ? "Sim" : "Não"}</p>
          <p className="text-xs text-muted">Preenchido em {fmtDataHora(briefing.preenchido_em)}</p>
        </div>
      ) : podeEditar ? (
        <form onSubmit={enviar} className="space-y-3">
          <div><label className="label">Local da gravação (endereço completo) *</label><textarea className="input min-h-16" value={local} onChange={(e) => setLocal(e.target.value)} required /></div>
          <div><label className="label">Roteiro / instruções do job *</label><textarea className="input min-h-24" value={roteiro} onChange={(e) => setRoteiro(e.target.value)} required /></div>
          <div><label className="label">Observações do cliente</label><textarea className="input min-h-16" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          <div><label className="label">Referência visual (opcional)</label><SeletorArquivo arquivo={arquivo} onChange={setArquivo} rotulo="📎 Anexar imagem ou PDF" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={precisa99} onChange={(e) => setPrecisa99(e.target.checked)} /> Precisa de transporte (99)?</label>
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <div className="flex gap-2">
            {briefing && <button type="button" className="btn-outline" onClick={() => setEditando(false)}>Cancelar</button>}
            <button className="btn-primary" disabled={pendente}>{pendente ? "Salvando…" : "Salvar briefing"}</button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted">Aguardando o analista preencher o briefing.</p>
      )}
    </section>
  );
}
