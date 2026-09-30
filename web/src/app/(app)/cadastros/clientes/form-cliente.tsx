"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarCliente } from "@/lib/actions/cadastros";

interface C { id: string; nome: string; grupo: string; pastaDriveId: string; pastaDriveUrl: string; contatoNome: string; contatoWhatsapp: string; ativo: boolean }
const vazio: C = { id: "", nome: "", grupo: "", pastaDriveId: "", pastaDriveUrl: "", contatoNome: "", contatoWhatsapp: "", ativo: true };

export function FormCliente({ clientes }: { clientes: C[] }) {
  const router = useRouter();
  const [c, setC] = useState<C>(vazio);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof C, v: string | boolean) => setC({ ...c, [k]: v });
  return (
    <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await salvarCliente({ ...c, id: c.id || undefined }); setMsg(r.ok ? "Salvo." : r.erro); if (r.ok) { setC(vazio); router.refresh(); } }); }}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{c.id ? "Editar cliente" : "Novo cliente"}</h2>
        <select className="input min-h-9 w-40 text-xs" value={c.id} onChange={(e) => setC(clientes.find((x) => x.id === e.target.value) ?? vazio)}>
          <option value="">— novo —</option>
          {clientes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </div>
      <div><label className="label">Nome (igual à pasta no Drive)</label><input className="input" value={c.nome} onChange={(e) => set("nome", e.target.value)} required /></div>
      <div><label className="label">Grupo (pasta de grupo, se houver)</label><input className="input" value={c.grupo} onChange={(e) => set("grupo", e.target.value)} /></div>
      <div><label className="label">ID da pasta no Drive</label><input className="input" value={c.pastaDriveId} onChange={(e) => set("pastaDriveId", e.target.value)} /></div>
      <div><label className="label">URL da pasta no Drive</label><input className="input" value={c.pastaDriveUrl} onChange={(e) => set("pastaDriveUrl", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Contato</label><input className="input" value={c.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} /></div>
        <div><label className="label">WhatsApp</label><input className="input" value={c.contatoWhatsapp} onChange={(e) => set("contatoWhatsapp", e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={c.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo</label>
      {msg && <p className="text-sm">{msg}</p>}
      <button className="btn-primary w-full" disabled={pendente}>Salvar</button>
    </form>
  );
}
