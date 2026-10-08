"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Map as MapLibre, Marker, NavigationControl, LngLatBounds, type GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";
import { ESTILO_OSM, circulo } from "./mapa";
import { distanciaMetros } from "@/lib/regras";
import { etaSegundos, fmtDistancia, fmtDuracao, idadeSegundos, posicaoDesatualizada, resumoTrilha, rumoGraus } from "@/lib/rastreio";
import { fmtHora } from "@/lib/formato";

export interface PontoVivo {
  lat: number;
  lng: number;
  capturadoEm: string;
  tipo: "chegada" | "saida" | "corrida" | "posicao";
  precisaoM: number;
  dentroGeofence: boolean | null;
}

export interface FastVivo {
  jobId: string;
  codigo: number;
  cliente: string;
  fastNome: string;
  cor: string;
  status: string;
  statusRotulo: string;
  job: { lat: number; lng: number; raioM: number } | null;
  /** eventos do job em ordem cronológica (chegada → posições → saída) */
  trilha: PontoVivo[];
}

interface Props {
  fasts: FastVivo[];
  /** instante do servidor (evita Date.now no render) */
  agoraInicial: number;
  /** cabeçalho flutuante: título, data e indicador ao vivo */
  cabecalho: ReactNode;
}

const MANAUS = { lat: -3.119, lng: -60.0217 };
const ANIMACAO_MS = 900;

interface Situacao {
  titulo: string;
  aoVivo: boolean;
  detalhe: string[];
  distanciaM: number | null;
  etaS: number | null;
}

/** Texto do cartão de cada Fast: situação (ao vivo / sem sinal / no local / saiu), distância ao cliente, ETA, percorrido. */
export function situacaoDoFast(f: FastVivo, agora: number): Situacao {
  const ultimo = f.trilha[f.trilha.length - 1];
  if (!ultimo) return { titulo: "Sem check-in", aoVivo: false, detalhe: [], distanciaM: null, etaS: null };

  const posicoes = f.trilha.filter((p) => p.tipo === "posicao" || p.tipo === "chegada");
  const resumo = resumoTrilha(posicoes);
  const distanciaM = f.job ? distanciaMetros(ultimo.lat, ultimo.lng, f.job.lat, f.job.lng) : null;
  const noLocal = ultimo.dentroGeofence === true || (distanciaM != null && f.job != null && distanciaM <= f.job.raioM);
  const detalhe: string[] = [];
  const chegada = f.trilha.find((p) => p.tipo === "chegada");
  const saida = [...f.trilha].reverse().find((p) => p.tipo === "saida");

  if (saida && ultimo.tipo === "saida") {
    if (chegada) detalhe.push(`chegou ${fmtHora(chegada.capturadoEm)} · saiu ${fmtHora(saida.capturadoEm)}`);
    if (resumo.distanciaM > 0) detalhe.push(`${fmtDistancia(resumo.distanciaM)} percorridos · ${fmtDuracao(resumo.duracaoS)} no job`);
    return { titulo: `Saiu às ${fmtHora(saida.capturadoEm)}`, aoVivo: false, detalhe, distanciaM, etaS: null };
  }

  const aoVivo = ultimo.tipo === "posicao" && !posicaoDesatualizada(ultimo.capturadoEm, 30_000, agora);
  const idade = idadeSegundos(ultimo.capturadoEm, agora);
  let titulo: string;
  if (ultimo.tipo === "posicao") titulo = aoVivo ? `Ao vivo · há ${idade} s` : `Sem sinal há ${fmtDuracao(idade)}`;
  else if (ultimo.tipo === "chegada") titulo = `Chegou às ${fmtHora(ultimo.capturadoEm)}`;
  else titulo = `Corrida registrada ${fmtHora(ultimo.capturadoEm)}`;

  let etaS: number | null = null;
  if (distanciaM != null) {
    if (noLocal) detalhe.push("No local do cliente");
    else {
      etaS = etaSegundos(distanciaM, resumo.velocidadeMs);
      detalhe.push(`A ${fmtDistancia(distanciaM)} do cliente${etaS != null ? ` · chega em ~${fmtDuracao(etaS)}` : resumo.emMovimento ? "" : " · parado"}`);
    }
  } else detalhe.push("Job sem ponto definido");
  if (chegada && resumo.duracaoS > 0) detalhe.push(`${fmtDistancia(resumo.distanciaM)} percorridos desde a chegada (${fmtDuracao(resumo.duracaoS)})`);
  if (ultimo.precisaoM > 50) detalhe.push(`precisão ±${Math.round(ultimo.precisaoM)} m`);
  return { titulo, aoVivo, detalhe, distanciaM, etaS };
}

function elementoFast(cor: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "fmt-fast";
  el.style.setProperty("--cor", cor);
  el.innerHTML = '<span class="fmt-fast-pulso"></span><span class="fmt-fast-seta"></span><span class="fmt-fast-ponto"></span>';
  return el;
}

function elementoJob(cor: string, rotulo: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "fmt-job";
  el.title = rotulo;
  el.innerHTML = `<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 37C15 37 2 21.5 2 14A13 13 0 0 1 28 14C28 21.5 15 37 15 37Z" fill="${cor}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#fff"/></svg>`;
  return el;
}

interface MarcadorFast {
  marker: Marker;
  el: HTMLDivElement;
  raf: number | null;
}

/**
 * RF-51 / RF-38 — Mapa do dia como app de corrida: trilha do Fast, marcador animado com rumo,
 * pino e geofence do cliente, cartões com distância/ETA e modo "seguir". Os dados chegam do
 * servidor (RPCs auditadas) e são recarregados pelo Realtime; aqui só se anima o que já foi gravado.
 */
export function MapaAoVivo({ fasts, agoraInicial, cabecalho }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapLibre | null>(null);
  const fastsRef = useRef(fasts);
  const marcadores = useRef<globalThis.Map<string, MarcadorFast>>(new globalThis.Map());
  const pinos = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [seguir, setSeguir] = useState(true);
  const [agora, setAgora] = useState(agoraInicial);
  const selRef = useRef({ selecionado, seguir });
  useEffect(() => {
    fastsRef.current = fasts;
    selRef.current = { selecionado, seguir };
  });

  // relógio para "há X s" (atualiza só o texto; o mapa é atualizado pelos dados)
  useEffect(() => {
    const i = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  function enquadrarTudo() {
    const m = mapa.current;
    if (!m) return;
    const b = new LngLatBounds();
    let n = 0;
    for (const f of fastsRef.current) {
      if (f.job) { b.extend([f.job.lng, f.job.lat]); n++; }
      const u = f.trilha[f.trilha.length - 1];
      if (u) { b.extend([u.lng, u.lat]); n++; }
    }
    if (n === 0) m.easeTo({ center: [MANAUS.lng, MANAUS.lat], zoom: 12 });
    else if (n === 1) m.easeTo({ center: b.getCenter(), zoom: 15 });
    else m.fitBounds(b, { padding: { top: 90, bottom: 190, left: 40, right: 40 }, maxZoom: 16, duration: 700 });
  }

  function moverSuave(mk: MarcadorFast, para: { lat: number; lng: number }) {
    const de = mk.marker.getLngLat();
    if (mk.raf) cancelAnimationFrame(mk.raf);
    if (Math.abs(de.lat - para.lat) < 1e-7 && Math.abs(de.lng - para.lng) < 1e-7) return;
    const inicio = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - inicio) / ANIMACAO_MS);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      mk.marker.setLngLat([de.lng + (para.lng - de.lng) * e, de.lat + (para.lat - de.lat) * e]);
      if (k < 1) mk.raf = requestAnimationFrame(passo);
      else mk.raf = null;
    };
    mk.raf = requestAnimationFrame(passo);
  }

  function atualizar() {
    const m = mapa.current;
    if (!m || !m.isStyleLoaded()) return;
    const lista = fastsRef.current;
    const { selecionado: sel, seguir: seg } = selRef.current;
    const vivos = new Set<string>();
    const linhas: Feature<LineString>[] = [];
    const geofences: Feature<Polygon>[] = [];
    const agoraMs = Date.now();

    for (const f of lista) {
      vivos.add(f.jobId);
      // pino + geofence do cliente
      if (f.job) {
        geofences.push(circulo(f.job.lat, f.job.lng, f.job.raioM));
        const existente = pinos.current.get(f.jobId);
        if (existente) existente.setLngLat([f.job.lng, f.job.lat]);
        else pinos.current.set(f.jobId, new Marker({ element: elementoJob(f.cor, `Job #${f.codigo} · ${f.cliente}`), anchor: "bottom" }).setLngLat([f.job.lng, f.job.lat]).addTo(m));
      }
      // trilha (chegada → posições → saída)
      const pontos = f.trilha.filter((p) => p.tipo !== "corrida");
      if (pontos.length >= 2) {
        linhas.push({ type: "Feature", properties: { cor: f.cor, sel: sel === f.jobId }, geometry: { type: "LineString", coordinates: pontos.map((p) => [p.lng, p.lat]) } });
      }
      // marcador do Fast na última posição conhecida
      const ultimo = f.trilha[f.trilha.length - 1];
      if (!ultimo) continue;
      let mk = marcadores.current.get(f.jobId);
      if (!mk) {
        const el = elementoFast(f.cor);
        el.addEventListener("click", () => { setSelecionado(f.jobId); setSeguir(true); });
        mk = { marker: new Marker({ element: el }).setLngLat([ultimo.lng, ultimo.lat]).addTo(m), el, raf: null };
        marcadores.current.set(f.jobId, mk);
      } else moverSuave(mk, ultimo);
      const anterior = pontos.length >= 2 ? pontos[pontos.length - 2] : null;
      const movimentou = anterior && distanciaMetros(anterior.lat, anterior.lng, ultimo.lat, ultimo.lng) >= 10;
      const aoVivo = ultimo.tipo === "posicao" && !posicaoDesatualizada(ultimo.capturadoEm, 30_000, agoraMs);
      mk.el.dataset.aoVivo = String(aoVivo);
      mk.el.dataset.rumo = String(Boolean(movimentou && aoVivo));
      mk.el.dataset.selecionado = String(sel === f.jobId);
      if (movimentou && anterior) mk.el.style.setProperty("--rumo", `${rumoGraus(anterior, ultimo).toFixed(0)}deg`);
      mk.el.title = `${f.fastNome} · ${f.cliente}`;
      if (sel === f.jobId && seg) m.easeTo({ center: [ultimo.lng, ultimo.lat], duration: ANIMACAO_MS, zoom: Math.max(m.getZoom(), 15) });
    }
    // remove o que saiu da lista (troca de data)
    for (const [id, mk] of marcadores.current) if (!vivos.has(id)) { if (mk.raf) cancelAnimationFrame(mk.raf); mk.marker.remove(); marcadores.current.delete(id); }
    for (const [id, p] of pinos.current) if (!vivos.has(id)) { p.remove(); pinos.current.delete(id); }

    (m.getSource("trilhas") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: linhas } satisfies FeatureCollection<LineString>);
    (m.getSource("geofences") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: geofences } satisfies FeatureCollection<Polygon>);
  }

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const m = new MapLibre({ container: ref.current, style: ESTILO_OSM, center: [MANAUS.lng, MANAUS.lat], zoom: 12, attributionControl: { compact: true } });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("geofences", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "geofences-fill", type: "fill", source: "geofences", paint: { "fill-color": "#d03134", "fill-opacity": 0.1 } });
      m.addLayer({ id: "geofences-line", type: "line", source: "geofences", paint: { "line-color": "#d03134", "line-width": 2, "line-dasharray": [2, 2] } });
      m.addSource("trilhas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "trilhas-borda", type: "line", source: "trilhas", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "sel"], 9, 7], "line-opacity": 0.9 } });
      m.addLayer({ id: "trilhas", type: "line", source: "trilhas", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "cor"], "line-width": ["case", ["get", "sel"], 5, 4], "line-opacity": 0.95 } });
      atualizar();
      enquadrarTudo();
    });
    // arrastar o mapa desliga o "seguir"
    m.on("dragstart", () => setSeguir(false));
    mapa.current = m;
    const mks = marcadores.current;
    const pns = pinos.current;
    return () => {
      for (const mk of mks.values()) if (mk.raf) cancelAnimationFrame(mk.raf);
      mks.clear();
      pns.clear();
      m.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    atualizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fasts, selecionado, seguir]);

  const fastSel = fasts.find((f) => f.jobId === selecionado) ?? null;

  return (
    <div className="fmt-mapa-vivo relative -mx-4 h-[calc(100dvh-8.5rem)] overflow-hidden md:mx-0 md:h-[calc(100dvh-7rem)] md:rounded-2xl md:border md:border-border">
      <div ref={ref} className="absolute inset-0" />

      {/* cabeçalho flutuante */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto card flex flex-wrap items-center justify-between gap-2 py-2">{cabecalho}</div>
      </div>

      {/* controles flutuantes */}
      <div className="absolute left-3 top-[5.25rem] z-10 flex flex-col gap-2">
        <button type="button" className="btn-outline min-h-10 px-3 text-sm shadow-md" onClick={enquadrarTudo} title="Enquadrar todos os Fasts e jobs">Visão geral</button>
        {fastSel && (
          <button type="button" className={`${seguir ? "btn-primary" : "btn-outline"} min-h-10 px-3 text-sm shadow-md`} onClick={() => setSeguir((v) => !v)} title="Manter o mapa centralizado no Fast selecionado">
            {seguir ? "Seguindo" : "Seguir"}
          </button>
        )}
      </div>

      {/* cartões dos Fasts (folha inferior, estilo app de corrida) */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        {fasts.length === 0 ? (
          <div className="card py-3 text-sm text-muted">Nenhum job nesta data.</div>
        ) : (
          <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {fasts.map((f) => {
              const s = situacaoDoFast(f, agora);
              const ativo = selecionado === f.jobId;
              return (
                <div key={f.jobId} className={`card w-72 shrink-0 snap-start py-3 text-sm transition ${ativo ? "border-primary ring-2 ring-primary/30" : ""}`}>
                  <button type="button" className="w-full text-left" onClick={() => { setSelecionado(ativo ? null : f.jobId); setSeguir(true); }} aria-pressed={ativo}>
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="inline-block size-3 rounded-full border-2 border-white shadow" style={{ background: f.cor }} />
                      <span className="truncate">{f.fastNome}</span>
                      <span className={`ml-auto inline-block size-2 rounded-full ${s.aoVivo ? "bg-success animate-pulse" : "bg-border"}`} aria-hidden="true" />
                    </p>
                    <p className="truncate text-xs text-muted">{f.cliente} · Job #{f.codigo} · {f.statusRotulo}</p>
                    <p className={`mt-1 font-medium ${s.aoVivo ? "text-success" : ""}`}>{s.titulo}</p>
                    {s.detalhe.map((d) => <p key={d} className="text-xs text-muted">{d}</p>)}
                    {!f.job && <p className="text-xs text-warning">Sem ponto do job → abrir e definir a geofence</p>}
                  </button>
                  <Link href={`/jobs/${f.jobId}`} className="mt-2 inline-block text-xs text-primary underline">Abrir job</Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
