"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { capturarLocalizacao, type Leitura } from "@/lib/geolocalizacao";
import { avaliarCheckin, dentroDaJanela } from "@/lib/regras";
import { enfileirar, gerarChave } from "@/lib/offline";
import { registrarEvento } from "@/lib/actions/campo";
import { fmtDataHora, fmtHora } from "@/lib/formato";

interface Props {
  jobId: string;
  status: string;
  temBriefing: boolean;
  geofence: { lat: number; lng: number; raioM: number; confirmado: boolean } | null;
  inicio: string;
  fim: string;
  chegada: { em: string; dentro: boolean | null; distancia: number | null } | null;
  saida: { em: string; dentro: boolean | null } | null;
  precisaoMaxima: number;
  janelaAntesMin: number;
  janelaDepoisMin: number;
  duracaoRealMin: number | null;
}

/** RF-31..RF-35, RF-37, RNF-05, RNF-06 — check-in/out por geofence, com justificativa e fila offline. */
export function CheckinPanel(p: Props) {
  const router = useRouter();
  const [fase, setFase] = useState<"idle" | "capturando" | "confirmar">("idle");
  const [tipo, setTipo] = useState<"chegada" | "saida">("chegada");
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const agora = new Date();
  const naJanela = dentroDaJanela(agora, new Date(p.inicio), new Date(p.fim), p.janelaAntesMin, p.janelaDepoisMin);
  const podeChegada = !p.chegada && p.temBriefing && p.status === "briefing_recebido";
  const podeSaida = Boolean(p.chegada) && !p.saida;

  async function capturar(t: "chegada" | "saida") {
    setErro(null);
    setTipo(t);
    setFase("capturando");
    try {
      const l = await capturarLocalizacao();
      setLeitura(l);
      setFase("confirmar");
    } catch (e) {
      setErro((e as Error).message);
      setFase("idle");
    }
  }

  const avaliacao = leitura ? avaliarCheckin(leitura, p.geofence ? { lat: p.geofence.lat, lng: p.geofence.lng, raioM: p.geofence.raioM } : null, p.precisaoMaxima) : null;

  function enviar() {
    if (!leitura) return;
    const chave = gerarChave();
    const evento = { jobId: p.jobId, tipo, lat: leitura.lat, lng: leitura.lng, precisaoM: leitura.precisaoM, capturadoEm: leitura.capturadoEm, justificativa: justificativa || undefined, chave };
    iniciar(async () => {
      if (!navigator.onLine) {
        await enfileirar(evento);
        setErro("Sem conexão: evento guardado no aparelho e será enviado automaticamente.");
        setFase("idle");
        return;
      }
      const r = await registrarEvento(evento);
      if (!r.ok) {
        if (/fetch|network|rede/i.test(r.erro)) {
          await enfileirar(evento);
          setErro("Falha de rede: evento guardado no aparelho para reenvio.");
        } else setErro(r.erro);
        setFase("confirmar");
        return;
      }
      setFase("idle");
      setLeitura(null);
      setJustificativa("");
      router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Presença no cliente</h2>
        <span className="text-xs text-muted" title="RF-35: indicador de captura">
          {fase === "capturando" ? "📡 capturando localização…" : "📍 localização só ao tocar"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className={`rounded-xl p-3 ${p.chegada ? "bg-success/10" : "bg-border/40"}`}>
          <p className="text-muted">Chegada</p>
          <p className="font-semibold">{p.chegada ? fmtHora(p.chegada.em) : "—"}</p>
          {p.chegada && (
            <p className="text-xs">{p.chegada.dentro ? "dentro da geofence" : p.chegada.dentro === false ? `fora (${Math.round(p.chegada.distancia ?? 0)} m)` : "sem geofence"}</p>
          )}
        </div>
        <div className={`rounded-xl p-3 ${p.saida ? "bg-success/10" : "bg-border/40"}`}>
          <p className="text-muted">Saída</p>
          <p className="font-semibold">{p.saida ? fmtHora(p.saida.em) : "—"}</p>
          {p.duracaoRealMin != null && <p className="text-xs">{p.duracaoRealMin} min de gravação</p>}
        </div>
      </div>

      {!p.geofence && <p className="text-xs text-warning">Este job ainda não tem ponto geográfico confirmado; o check-in pedirá justificativa.</p>}
      {!naJanela && (podeChegada || podeSaida) && (
        <p className="text-xs text-warning">Fora da janela do job ({fmtDataHora(p.inicio)} – {fmtDataHora(p.fim)}, com tolerância). O registro será recusado.</p>
      )}

      {fase !== "confirmar" && (
        <div className="grid gap-2">
          {podeChegada && (
            <button className="btn-primary" disabled={fase === "capturando"} onClick={() => capturar("chegada")}>
              ✅ Cheguei no cliente
            </button>
          )}
          {podeSaida && (
            <button className="btn-primary" disabled={fase === "capturando"} onClick={() => capturar("saida")}>
              🏁 Terminei a gravação
            </button>
          )}
          {!podeChegada && !podeSaida && !p.saida && !p.temBriefing && <p className="text-sm text-muted">Check-in bloqueado até o briefing ser preenchido (RF-21).</p>}
          {p.saida && <p className="text-sm text-success">Presença registrada.</p>}
        </div>
      )}

      {fase === "confirmar" && leitura && avaliacao && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-sm">
            Precisão do GPS: <strong>{Math.round(leitura.precisaoM)} m</strong>
            {avaliacao.distanciaM != null && <> · Distância do ponto: <strong>{Math.round(avaliacao.distanciaM)} m</strong> (raio {p.geofence?.raioM} m)</>}
          </p>
          {avaliacao.exigeJustificativa ? (
            <>
              <ul className="list-disc pl-5 text-sm text-warning">{avaliacao.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
              <textarea className="input min-h-24" placeholder="Justificativa obrigatória (ex.: gravação em estúdio interno, GPS sem sinal)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </>
          ) : (
            <p className="text-sm text-success">Dentro da geofence com boa precisão.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline" onClick={() => { setFase("idle"); setLeitura(null); }}>Cancelar</button>
            <button className="btn-primary" disabled={pendente || (avaliacao.exigeJustificativa && justificativa.trim().length < 5)} onClick={enviar}>
              {pendente ? "Enviando…" : `Confirmar ${tipo}`}
            </button>
          </div>
        </div>
      )}

      {erro && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
    </section>
  );
}
