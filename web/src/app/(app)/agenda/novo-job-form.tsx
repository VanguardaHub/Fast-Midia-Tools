"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarJob } from "@/lib/actions/jobs";
import { SLOT_ROTULO, fmtData } from "@/lib/formato";
import type { ConflitoAgenda } from "@/lib/regras";

type Slot = "manha" | "tarde";

export function NovoJobForm({ selecao, fast, clientes, conflitos, indisponivel, ehGestao, onFechar }: {
  selecao: { fastId: string; data: string; slot: Slot };
  fast: { id: string; nome: string; cor: string };
  clientes: { id: string; nome: string; grupo: string | null }[];
  conflitos: ConflitoAgenda[];
  /** RF-10 — o Fast marcou este dia/turno como indisponível; só gestão agenda, com motivo */
  indisponivel?: { motivo: string | null; diaInteiro: boolean };
  ehGestao: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [whats, setWhats] = useState("");
  const [prazo, setPrazo] = useState("");
  const [dataEdicao, setDataEdicao] = useState("");
  const [blocoEdicao, setBlocoEdicao] = useState<"" | Slot>("");
  const [endereco, setEndereco] = useState("");
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const temConflito = conflitos.length > 0 || Boolean(indisponivel);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarJob({
        clienteId: clienteId || undefined,
        clienteNome: clienteId ? undefined : clienteNome,
        fastId: selecao.fastId,
        data: selecao.data,
        slot: selecao.slot,
        analistaWhatsapp: whats,
        prazoMaterial: prazo,
        dataEdicao,
        blocoEdicao,
        endereco,
        observacoes: obs,
        excecaoMotivo: motivo,
      });
      if (!r.ok) setErro(r.erro);
      else {
        onFechar();
        router.push(`/jobs/${r.dados!.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="card max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-b-none sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Novo job</h2>
            <p className="text-sm text-muted">
              <span className="mr-1 inline-block size-2.5 rounded-full" style={{ background: fast.cor }} />
              {fast.nome} · {fmtData(selecao.data, "EEE dd/MM")} · {SLOT_ROTULO[selecao.slot]}
            </p>
          </div>
          <button type="button" onClick={onFechar} className="text-muted">✕</button>
        </div>

        {temConflito && (
          <div className="rounded-xl bg-warning/10 p-3 text-sm text-warning">
            <p className="font-medium">Conflito com as regras de agenda (Processos 1.2):</p>
            <ul className="list-disc pl-5">
              {indisponivel && (
                <li>O Fast informou indisponibilidade neste {indisponivel.diaInteiro ? "dia inteiro" : "turno"}{indisponivel.motivo ? ` (${indisponivel.motivo})` : ""}</li>
              )}
              {conflitos.map((c, i) => (
                <li key={i}>{c.tipo === "agendamento_duplo" ? "Agendamento duplo no mesmo dia" : "Menos de 2h de folga"} — job existente em {fmtData(c.jobConflitante.data, "dd/MM")} ({SLOT_ROTULO[c.jobConflitante.slot]})</li>
              ))}
            </ul>
            {ehGestao ? (
              <div className="mt-2">
                <label className="label">Motivo da aprovação (obrigatório para prosseguir)</label>
                <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente prioritário, gravação curta" />
              </div>
            ) : (
              <p className="mt-2">Apenas a supervisora pode aprovar. Sinalize antes de confirmar.</p>
            )}
          </div>
        )}

        <div>
          <label className="label">Cliente</label>
          <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— Novo cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.grupo ? `${c.grupo} / ` : ""}{c.nome}</option>
            ))}
          </select>
          {!clienteId && <input className="input mt-2" placeholder="Nome do cliente (igual à pasta no Drive)" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} required />}
        </div>
        <div>
          <label className="label">WhatsApp do analista (briefing)</label>
          <input className="input" inputMode="tel" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="92 99999-9999" />
        </div>
        <div>
          <label className="label">Endereço da gravação (será geocodificado)</label>
          <input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, Manaus" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Prazo do material</label>
            <input type="date" className="input" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div>
            <label className="label">Edição — data</label>
            <input type="date" className="input" value={dataEdicao} onChange={(e) => setDataEdicao(e.target.value)} />
          </div>
        </div>
        {dataEdicao && (
          <div>
            <label className="label">Edição — bloco</label>
            <select className="input" value={blocoEdicao} onChange={(e) => setBlocoEdicao(e.target.value as Slot | "")} required>
              <option value="">Selecione</option>
              <option value="manha">Manhã (08:00–12:00)</option>
              <option value="tarde">Tarde (13:00–17:00)</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Observações</label>
          <textarea className="input min-h-20" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        {erro && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" disabled={pendente || (temConflito && (!ehGestao || motivo.trim().length < 3))}>
            {pendente ? "Criando…" : "Criar job"}
          </button>
        </div>
      </form>
    </div>
  );
}
