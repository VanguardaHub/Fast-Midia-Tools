"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarFast } from "@/lib/actions/cadastros";

interface F { id: string; nome: string; emailCalendario: string; telefone: string; cor: string; nomeNotion: string; ativo: boolean }
const vazio: F = { id: "", nome: "", emailCalendario: "", telefone: "", cor: "#7C3AED", nomeNotion: "", ativo: true };

export function FormFast({ fasts }: { fasts: F[] }) {
  const router = useRouter();
  const [f, setF] = useState<F>(vazio);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof F, v: string | boolean) => setF({ ...f, [k]: v });

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await salvarFast({ ...f, id: f.id || undefined });
          setMsg(r.ok ? "Salvo." : r.erro);
          if (r.ok) { setF(vazio); router.refresh(); }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{f.id ? "Editar Fast" : "Novo Fast"}</h2>
        <select className="input min-h-9 w-40 text-xs" value={f.id} onChange={(e) => setF(fasts.find((x) => x.id === e.target.value) ?? vazio)}>
          <option value="">— novo —</option>
          {fasts.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </div>
      <div><label className="label">Nome</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} required /></div>
      <div><label className="label">E-mail do Google Calendar (e de login)</label><input className="input" type="email" value={f.emailCalendario} onChange={(e) => set("emailCalendario", e.target.value)} required /></div>
      <div><label className="label">WhatsApp (DDI+DDD+número)</label><input className="input" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="5592999999999" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Cor</label><input className="input" type="color" value={f.cor} onChange={(e) => set("cor", e.target.value.toUpperCase())} /></div>
        <div><label className="label">Nome no Notion</label><input className="input" value={f.nomeNotion} onChange={(e) => set("nomeNotion", e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo</label>
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn-primary w-full" disabled={pendente}>Salvar</button>
    </form>
  );
}
