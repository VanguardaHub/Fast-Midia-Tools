"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { validarCorrida } from "@/lib/actions/jobs";
import { salvarCorrida } from "@/lib/actions/campo";
import { fmtMoeda } from "@/lib/formato";
import { SeletorArquivo } from "@/components/seletor-arquivo";
import type { Database } from "@/lib/database.types";

type Corrida = Database["public"]["Tables"]["corrida_99"]["Row"];
type Sentido = "ida" | "volta";

/** RF-41 / RF-43 / RF-44 — corridas de 99: edição pela gestão (valor, trajeto, comprovante) e conciliação. */
export function CorridasJob({ jobId, corridas, ehGestao }: { jobId: string; corridas: Corrida[]; ehGestao: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

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
        {(["ida", "volta"] as const).map((s) => (
          <CorridaCard key={s} jobId={jobId} sentido={s} corrida={corridas.find((x) => x.sentido === s) ?? null} url={corridas.find((x) => x.sentido === s)?.id ? urls[corridas.find((x) => x.sentido === s)!.id] : undefined} ehGestao={ehGestao} />
        ))}
      </div>
      <p className="text-xs text-muted">Job não pode ser concluído sem os dois comprovantes (RF-42). Meta OKR: ≥ 95% das corridas validadas. Corridas validadas ficam bloqueadas para edição pelo Fast.</p>
    </section>
  );
}

function CorridaCard({ jobId, sentido, corrida, url, ehGestao }: { jobId: string; sentido: Sentido; corrida: Corrida | null; url?: string; ehGestao: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(corrida?.valor?.toString() ?? "");
  const [origem, setOrigem] = useState(corrida?.origem ?? "");
  const [destino, setDestino] = useState(corrida?.destino ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      let path = corrida?.comprovante_path ?? null;
      if (arquivo) {
        const supabase = criarClienteBrowser();
        const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const novo = `${jobId}/${sentido}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("comprovantes-99").upload(novo, arquivo, { upsert: true, contentType: arquivo.type });
        if (error) { setErro(`Upload falhou: ${error.message}`); return; }
        path = novo;
      }
      const r = await salvarCorrida({ jobId, sentido, valor: valor.trim() ? Number(valor.replace(",", ".")) : null, comprovantePath: path, origem, destino });
      if (!r.ok) setErro(r.erro);
      else { setEditando(false); setArquivo(null); router.refresh(); }
    });
  }

  function validar() {
    if (!corrida) return;
    iniciar(async () => {
      const r = await validarCorrida(corrida.id, !corrida.validada);
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium capitalize">{sentido}</p>
        {corrida?.comprovante_path ? (
          <span className={`badge ${corrida.validada ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>{corrida.validada ? "validada" : "a conciliar"}</span>
        ) : (
          <span className="badge bg-danger/15 text-danger">sem comprovante</span>
        )}
      </div>

      {!editando && (
        <>
          <p>Valor: <strong>{fmtMoeda(corrida?.valor)}</strong></p>
          {(corrida?.origem || corrida?.destino) && (
            <p className="text-muted">{corrida?.origem ?? "—"} → {corrida?.destino ?? "—"}{corrida?.divergencia_destino ? " ⚠️ destino divergente da geofence" : ""}</p>
          )}
          {url && <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">Ver comprovante</a>}
          {ehGestao && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-outline min-h-9 text-xs" disabled={pendente} onClick={() => setEditando(true)}>{corrida ? "Editar" : "Registrar corrida"}</button>
              {corrida?.comprovante_path && (
                <button type="button" className={`${corrida.validada ? "btn-outline" : "btn-primary"} min-h-9 text-xs`} disabled={pendente} onClick={validar}>
                  {corrida.validada ? "Desfazer validação" : "Validar corrida"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {editando && (
        <form onSubmit={salvar} className="space-y-2">
          <div>
            <label className="label">Valor (R$)</label>
            <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Origem</label><input className="input" value={origem} onChange={(e) => setOrigem(e.target.value)} /></div>
            <div><label className="label">Destino</label><input className="input" value={destino} onChange={(e) => setDestino(e.target.value)} /></div>
          </div>
          <SeletorArquivo arquivo={arquivo} onChange={setArquivo} rotulo={corrida?.comprovante_path ? "📎 Substituir comprovante" : "📎 Anexar comprovante"} />
          {erro && <p className="text-danger">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-outline min-h-9 text-xs" onClick={() => { setEditando(false); setErro(null); }}>Cancelar</button>
            <button className="btn-primary min-h-9 text-xs" disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      )}
      {!editando && erro && <p className="text-danger">{erro}</p>}
    </div>
  );
}
