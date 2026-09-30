"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { atualizarJob, cancelarJob } from "@/lib/actions/jobs";

type Slot = "manha" | "tarde";

/** RF-15 / RF-53 — reagendar, trocar Fast (com motivo), ajustar pasta/prazo, cancelar. */
export function AcoesJob({ job, fasts }: {
  job: { id: string; status: string; fastId: string; data: string; slot: Slot; prazoMaterial: string | null; dataEdicao: string | null; blocoEdicao: Slot | null; pastaIngestUrl: string | null; observacoes: string | null; analistaWhatsapp: string | null };
  fasts: { id: string; nome: string; cor: string }[];
}) {
  const router = useRouter();
  const [fastId, setFastId] = useState(job.fastId);
  const [data, setData] = useState(job.data);
  const [slot, setSlot] = useState<Slot>(job.slot);
  const [prazo, setPrazo] = useState(job.prazoMaterial ?? "");
  const [dataEdicao, setDataEdicao] = useState(job.dataEdicao ?? "");
  const [blocoEdicao, setBlocoEdicao] = useState<Slot | "">(job.blocoEdicao ?? "");
  const [pasta, setPasta] = useState(job.pastaIngestUrl ?? "");
  const [whats, setWhats] = useState(job.analistaWhatsapp ?? "");
  const [obs, setObs] = useState(job.observacoes ?? "");
  const [motivo, setMotivo] = useState("");
  const [motivoCancel, setMotivoCancel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const cancelado = job.status === "cancelado";

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await atualizarJob(job.id, {
        fastId: fastId !== job.fastId ? fastId : undefined,
        data: data !== job.data ? data : undefined,
        slot: slot !== job.slot ? slot : undefined,
        prazoMaterial: prazo || null,
        dataEdicao: dataEdicao || null,
        blocoEdicao: dataEdicao ? (blocoEdicao || null) : null,
        pastaIngestUrl: pasta || "",
        analistaWhatsapp: whats || null,
        observacoes: obs || null,
        excecaoMotivo: motivo || null,
      });
      setMsg(r.ok ? "Job atualizado." : r.erro);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Ajustes da supervisora</h2>
      {cancelado ? <p className="text-sm text-muted">Job cancelado.</p> : (
        <form onSubmit={salvar} className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Fast responsável</label>
            <select className="input" value={fastId} onChange={(e) => setFastId(e.target.value)}>
              {fasts.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Data</label><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className="label">Slot</label><select className="input" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></div>
          </div>
          <div><label className="label">Prazo do material</label><input type="date" className="input" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Edição — data</label><input type="date" className="input" value={dataEdicao} onChange={(e) => setDataEdicao(e.target.value)} /></div>
            <div><label className="label">Bloco</label><select className="input" value={blocoEdicao} onChange={(e) => setBlocoEdicao(e.target.value as Slot | "")}><option value="">—</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></div>
          </div>
          <div><label className="label">Pasta de ingest (Drive)</label><input className="input" value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="https://drive.google.com/…" /></div>
          <div><label className="label">WhatsApp do analista</label><input className="input" value={whats} onChange={(e) => setWhats(e.target.value)} /></div>
          <div className="md:col-span-2"><label className="label">Observações</label><textarea className="input min-h-16" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          <div className="md:col-span-2">
            <label className="label">Motivo (obrigatório ao trocar Fast ou aprovar conflito de agenda)</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Registrado como exceção (RF-53)" />
          </div>
          {msg && <p className="text-sm md:col-span-2">{msg}</p>}
          <div className="md:col-span-2"><button className="btn-primary" disabled={pendente}>{pendente ? "Salvando…" : "Salvar alterações"}</button></div>
        </form>
      )}
      {!cancelado && (
        <div className="border-t border-border pt-3">
          <label className="label">Cancelar job (libera o calendário e notifica os envolvidos)</label>
          <div className="flex gap-2">
            <input className="input" value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} placeholder="Motivo do cancelamento" />
            <button
              type="button"
              className="btn-danger shrink-0"
              disabled={pendente || motivoCancel.trim().length < 3}
              onClick={() => {
                if (!confirm("Confirmar cancelamento do job?")) return;
                iniciar(async () => {
                  const r = await cancelarJob(job.id, motivoCancel);
                  setMsg(r.ok ? "Job cancelado." : r.erro);
                  if (r.ok) router.refresh();
                });
              }}
            >
              Cancelar job
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
