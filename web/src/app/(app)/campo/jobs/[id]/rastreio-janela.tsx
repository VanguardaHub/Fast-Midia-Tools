"use client";

import { useEffect, useRef, useState } from "react";
import { registrarEvento } from "@/lib/actions/campo";
import { gerarChave } from "@/lib/offline";
import { deveEnviarPosicao, type Posicao } from "@/lib/rastreio";
import { fmtHora } from "@/lib/formato";

interface Props {
  jobId: string;
  intervaloS: number;
  precisaoMaxM: number;
}

type Estado = "iniciando" | "compartilhando" | "pausado" | "sem_permissao" | "erro";

const CHAVE_PAUSA = (jobId: string) => `fmt:rastreio:pausado:${jobId}`;

/**
 * RF-38 / ADR-0005 — compartilha a posição do Fast entre o check-in e o check-out, com o app aberto
 * nesta tela e indicador visível. Usa `watchPosition`; o envio é filtrado por `deveEnviarPosicao`
 * e o banco reaplica o intervalo mínimo. Pausa persistida por job no aparelho (sessionStorage).
 * Sem fila offline: posição antiga não tem valor operacional.
 */
export function RastreioJanela({ jobId, intervaloS, precisaoMaxM }: Props) {
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [ultimaEnviada, setUltimaEnviada] = useState<Posicao | null>(null);
  const [enviadas, setEnviadas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaRef = useRef<Posicao | null>(null);
  const enviandoRef = useRef(false);

  const [pausado, setPausado] = useState<boolean | null>(null);
  useEffect(() => {
    let p = false;
    try { p = sessionStorage.getItem(CHAVE_PAUSA(jobId)) === "1"; } catch { /* sem storage */ }
    const t = setTimeout(() => setPausado(p), 0);
    return () => clearTimeout(t);
  }, [jobId]);

  useEffect(() => {
    if (pausado == null || pausado) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const t = setTimeout(() => { setEstado("erro"); setErro("Este dispositivo não oferece geolocalização."); }, 0);
      return () => clearTimeout(t);
    }

    const politica = { intervaloMs: intervaloS * 1000, deslocamentoMinM: 25, precisaoMaxM };
    let ativo = true;
    const tInicio = setTimeout(() => { if (ativo) setEstado("iniciando"); }, 0);

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!ativo || document.visibilityState !== "visible") return;
        const atual: Posicao = { lat: pos.coords.latitude, lng: pos.coords.longitude, precisaoM: pos.coords.accuracy, capturadoEm: new Date(pos.timestamp || Date.now()).toISOString() };
        setEstado("compartilhando");
        if (enviandoRef.current || !deveEnviarPosicao(ultimaRef.current, atual, politica)) return;
        enviandoRef.current = true;
        try {
          const r = await registrarEvento({ jobId, tipo: "posicao", lat: atual.lat, lng: atual.lng, precisaoM: atual.precisaoM, capturadoEm: atual.capturadoEm, chave: gerarChave() });
          if (!ativo) return;
          if (r.ok) {
            ultimaRef.current = atual;
            setUltimaEnviada(atual);
            setEnviadas((n) => n + 1);
            setErro(null);
          } else if (/RASTREIO_FORA_DA_GRAVACAO|desligado/.test(r.erro)) {
            setEstado("erro");
            setErro(r.erro);
            navigator.geolocation.clearWatch(id);
          } else {
            setErro(r.erro);
          }
        } finally {
          enviandoRef.current = false;
        }
      },
      (err) => {
        if (!ativo) return;
        if (err.code === 1) { setEstado("sem_permissao"); setErro("Permissão de localização negada. Ative nas configurações do celular para compartilhar a posição."); }
        else { setErro(err.message); }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      ativo = false;
      clearTimeout(tInicio);
      navigator.geolocation.clearWatch(id);
    };
  }, [jobId, intervaloS, precisaoMaxM, pausado]);

  function alternar() {
    const novo = !pausado;
    try { sessionStorage.setItem(CHAVE_PAUSA(jobId), novo ? "1" : "0"); } catch { /* sem storage */ }
    setPausado(novo);
  }

  const rotulo: Record<Estado, string> = {
    iniciando: "📡 obtendo posição…",
    compartilhando: "📡 posição compartilhada com a supervisão",
    pausado: "⏸️ compartilhamento pausado",
    sem_permissao: "🚫 sem permissão de localização",
    erro: "⚠️ compartilhamento indisponível",
  };
  const exibido: Estado = pausado ? "pausado" : estado;
  const cor = exibido === "compartilhando" ? "bg-success" : exibido === "pausado" ? "bg-border" : exibido === "iniciando" ? "bg-warning" : "bg-danger";

  return (
    <section className="card space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className={`inline-block size-2.5 rounded-full ${cor} ${exibido === "compartilhando" ? "animate-pulse" : ""}`} />
          {rotulo[exibido]}
        </p>
        {exibido !== "erro" && (
          <button type="button" className="btn-outline min-h-9 text-xs" onClick={alternar}>
            {pausado ? "Retomar" : "Pausar"}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Durante a gravação (entre chegada e saída), com esta tela aberta, sua posição é enviada a cada ~{intervaloS}s à supervisora. Nada é enviado em segundo plano nem fora da janela do job (termo 2.0).
        {ultimaEnviada && ` Última enviada ${fmtHora(ultimaEnviada.capturadoEm)} (${Math.round(ultimaEnviada.precisaoM)} m) · ${enviadas} nesta sessão.`}
      </p>
      {erro && <p className="text-xs text-danger">{erro}</p>}
    </section>
  );
}
