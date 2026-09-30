"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarCliente } from "@/lib/actions/cadastros";

export interface ClienteForm { id: string; nome: string; grupo: string; pastaDriveId: string; pastaDriveUrl: string; contatoNome: string; contatoWhatsapp: string; ativo: boolean }
const vazio: ClienteForm = { id: "", nome: "", grupo: "", pastaDriveId: "", pastaDriveUrl: "", contatoNome: "", contatoWhatsapp: "", ativo: true };

/** RF-16 — formulário de cliente (novo ou edição vinda da lista via `inicial`). */
export function FormCliente({ inicial, hrefNovo }: { inicial?: ClienteForm | null; hrefNovo: string }) {
  const router = useRouter();
  const [c, setC] = useState<ClienteForm>(inicial ?? vazio);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof ClienteForm, v: string | boolean) => setC({ ...c, [k]: v });
  const editando = Boolean(c.id);

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        iniciar(async () => {
          const r = await salvarCliente({ ...c, id: c.id || undefined });
          if (!r.ok) { setMsg({ ok: false, texto: r.erro }); return; }
          setMsg({ ok: true, texto: editando ? "Alterações salvas." : "Cliente cadastrado." });
          if (!editando) setC(vazio);
          router.refresh();
        });
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{editando ? `Editar cliente · ${inicial?.nome}` : "Novo cliente"}</h2>
        {editando && <Link href={hrefNovo} className="text-xs text-primary underline">Cancelar edição</Link>}
      </div>
      <div><label className="label">Nome (igual à pasta no Drive)</label><input className="input" value={c.nome} onChange={(e) => set("nome", e.target.value)} required /></div>
      <div><label className="label">Grupo (pasta de grupo, se houver)</label><input className="input" value={c.grupo} onChange={(e) => set("grupo", e.target.value)} /></div>
      <div><label className="label">ID da pasta no Drive</label><input className="input" value={c.pastaDriveId} onChange={(e) => set("pastaDriveId", e.target.value)} /></div>
      <div><label className="label">URL da pasta no Drive</label><input className="input" value={c.pastaDriveUrl} onChange={(e) => set("pastaDriveUrl", e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Contato</label><input className="input" value={c.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} /></div>
        <div><label className="label">WhatsApp</label><input className="input" value={c.contatoWhatsapp} onChange={(e) => set("contatoWhatsapp", e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={c.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (aparece na agenda)</label>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.texto}</p>}
      <button className="btn-primary w-full" disabled={pendente}>{pendente ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar cliente"}</button>
    </form>
  );
}
