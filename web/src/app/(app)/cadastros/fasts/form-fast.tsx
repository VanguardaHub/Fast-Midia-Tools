"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarFast } from "@/lib/actions/cadastros";

export interface FastForm { id: string; nome: string; emailCalendario: string; telefone: string; cor: string; nomeNotion: string; ativo: boolean; perfilId: string }
export interface ContaDisponivel { id: string; nome: string; email: string }
const vazio: FastForm = { id: "", nome: "", emailCalendario: "", telefone: "", cor: "#D03134", nomeNotion: "", ativo: true, perfilId: "" };

/**
 * RF-03 — formulário de Fast (novo ou edição). A edição chega pela lista ("Editar") via `inicial`;
 * o `key` no componente pai reinicia o estado ao trocar de registro.
 */
export function FormFast({ inicial, contas, hrefNovo }: { inicial?: FastForm | null; contas: ContaDisponivel[]; hrefNovo: string }) {
  const router = useRouter();
  const [f, setF] = useState<FastForm>(inicial ?? vazio);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof FastForm, v: string | boolean) => setF({ ...f, [k]: v });
  const editando = Boolean(f.id);

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        iniciar(async () => {
          const r = await salvarFast({ ...f, id: f.id || undefined, perfilId: f.perfilId || null });
          if (!r.ok) { setMsg({ ok: false, texto: r.erro }); return; }
          setMsg({ ok: true, texto: editando ? "Alterações salvas." : "Fast cadastrado." });
          if (!editando) setF(vazio);
          router.refresh();
        });
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{editando ? `Editar Fast · ${inicial?.nome}` : "Novo Fast"}</h2>
        {editando && <Link href={hrefNovo} className="text-xs text-primary underline">Cancelar edição</Link>}
      </div>
      <div><label className="label">Nome</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} required /></div>
      <div><label className="label">E-mail do Google Calendar (e de login)</label><input className="input" type="email" value={f.emailCalendario} onChange={(e) => set("emailCalendario", e.target.value)} required /></div>
      <div><label className="label">WhatsApp (DDI+DDD+número)</label><input className="input" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="5592999999999" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Cor</label><input className="input" type="color" value={f.cor} onChange={(e) => set("cor", e.target.value.toUpperCase())} /></div>
        <div><label className="label">Nome no Notion</label><input className="input" value={f.nomeNotion} onChange={(e) => set("nomeNotion", e.target.value)} /></div>
      </div>
      <div>
        <label className="label">Conta de login vinculada</label>
        <select className="input" value={f.perfilId} onChange={(e) => set("perfilId", e.target.value)}>
          <option value="">— sem vínculo (vincula automaticamente no primeiro login com o e-mail acima) —</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.email}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">Só contas com perfil “fast” e ainda não vinculadas aparecem aqui. Sem vínculo, o Fast não consegue fazer check-in.</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (aparece na agenda)</label>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.texto}</p>}
      <button className="btn-primary w-full" disabled={pendente}>{pendente ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar Fast"}</button>
    </form>
  );
}
