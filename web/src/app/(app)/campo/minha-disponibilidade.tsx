"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarIndisponibilidade, removerIndisponibilidade } from "@/lib/actions/disponibilidade";
import { fmtData, hojeISO } from "@/lib/formato";

interface Item { id: string; data: string; slot: "manha" | "tarde" | null; motivo: string | null }

/** RF-10 — o Fast avisa quando não pode gravar; a agenda da supervisão mostra o slot como indisponível. */
export function MinhaDisponibilidade({ itens }: { itens: Item[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [slot, setSlot] = useState<"" | "manha" | "tarde">("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await marcarIndisponibilidade({ data, slot: slot || null, motivo: motivo || undefined });
      if (!r.ok) { setErro(r.erro); return; }
      setAberto(false); setData(""); setSlot(""); setMotivo("");
      router.refresh();
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerIndisponibilidade(id);
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Minha disponibilidade</h2>
        <button type="button" className="btn-outline min-h-9 text-xs" onClick={() => setAberto((v) => !v)}>{aberto ? "Fechar" : "Não posso gravar em…"}</button>
      </div>
      <p className="text-xs text-muted">Avise os dias ou turnos em que não pode gravar. A supervisão vê na agenda e não marca job nesses horários. Não precisa justificar.</p>

      {aberto && (
        <form onSubmit={salvar} className="space-y-2 rounded-xl border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Dia</label><input type="date" className="input" min={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} required /></div>
            <div>
              <label className="label">Turno</label>
              <select className="input" value={slot} onChange={(e) => setSlot(e.target.value as "" | "manha" | "tarde")}>
                <option value="">Dia inteiro</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
          </div>
          <div><label className="label">Motivo (opcional)</label><input className="input" maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: compromisso pessoal" /></div>
          {erro && <p className="text-sm text-danger">{erro}</p>}
          <button className="btn-primary w-full" disabled={pendente || !data}>{pendente ? "Salvando…" : "Marcar como indisponível"}</button>
        </form>
      )}

      {itens.length > 0 ? (
        <ul className="divide-y divide-border text-sm">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {fmtData(i.data, "EEE dd/MM")} · {i.slot === "manha" ? "manhã" : i.slot === "tarde" ? "tarde" : "dia inteiro"}
                {i.motivo && <span className="text-muted"> · {i.motivo}</span>}
              </span>
              <button type="button" className="text-xs text-primary underline" disabled={pendente} onClick={() => remover(i.id)}>Remover</button>
            </li>
          ))}
        </ul>
      ) : (
        !aberto && <p className="text-xs text-muted">Nenhuma indisponibilidade informada.</p>
      )}
      {!aberto && erro && <p className="text-sm text-danger">{erro}</p>}
    </section>
  );
}
