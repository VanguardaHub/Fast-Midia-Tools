"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mapa } from "@/components/mapa";
import { definirPonto } from "@/lib/actions/jobs";

/** RF-33 / RF-36 — geocodifica o endereço e exige confirmação manual do ponto e do raio. */
export function PontoGeofence({ jobId, endereco, ponto, podeEditar }: {
  jobId: string; endereco: string;
  ponto: { lat: number; lng: number; raioM: number; confirmado: boolean } | null;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(endereco);
  const [resultados, setResultados] = useState<{ rotulo: string; lat: number; lng: number }[]>([]);
  const [atual, setAtual] = useState(ponto ? { lat: ponto.lat, lng: ponto.lng } : null);
  const [raio, setRaio] = useState(ponto?.raioM ?? 200);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [pendente, iniciar] = useTransition();

  async function geocodificar() {
    setErro(null);
    setBuscando(true);
    try {
      const r = await fetch(`/api/geocodificar?q=${encodeURIComponent(busca)}`);
      const j = (await r.json()) as { resultados: { rotulo: string; lat: number; lng: number }[]; erro?: string };
      if (j.erro) setErro(j.erro);
      setResultados(j.resultados ?? []);
      if (j.resultados?.[0]) setAtual({ lat: j.resultados[0].lat, lng: j.resultados[0].lng });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  function confirmar() {
    if (!atual) return;
    iniciar(async () => {
      const r = await definirPonto(jobId, atual.lat, atual.lng, raio);
      if (!r.ok) setErro(r.erro);
      else router.refresh();
    });
  }

  const alterado = !ponto || !atual || ponto.lat !== atual.lat || ponto.lng !== atual.lng || ponto.raioM !== raio;

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Geofence do job</h2>
        {ponto?.confirmado ? <span className="badge bg-success/15 text-success">ponto confirmado</span> : <span className="badge bg-warning/15 text-warning">não confirmado</span>}
      </div>
      {podeEditar && (
        <div className="flex gap-2">
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Endereço para geocodificar" />
          <button type="button" className="btn-outline shrink-0" onClick={geocodificar} disabled={buscando || busca.length < 5}>{buscando ? "…" : "Buscar"}</button>
        </div>
      )}
      {resultados.length > 1 && (
        <select className="input" onChange={(e) => { const r = resultados[Number(e.target.value)]; if (r) setAtual({ lat: r.lat, lng: r.lng }); }}>
          {resultados.map((r, i) => <option key={i} value={i}>{r.rotulo}</option>)}
        </select>
      )}
      <Mapa
        editavel={atual ? { lat: atual.lat, lng: atual.lng, raioM: raio } : null}
        centro={atual ?? undefined}
        zoom={atual ? 15 : 12}
        onMover={podeEditar ? (lat, lng) => setAtual({ lat, lng }) : undefined}
        altura="280px"
      />
      <p className="text-xs text-muted">Toque no mapa ou arraste o marcador para ajustar. O check-in compara a posição do Fast com este ponto.</p>
      {podeEditar && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Raio (m)</label>
          <input type="number" className="input w-28" min={20} max={5000} step={10} value={raio} onChange={(e) => setRaio(Number(e.target.value))} />
          <button type="button" className="btn-primary" disabled={!atual || pendente || !alterado} onClick={confirmar}>{pendente ? "Salvando…" : "Confirmar ponto"}</button>
        </div>
      )}
      {erro && <p className="text-sm text-danger">{erro}</p>}
    </section>
  );
}
