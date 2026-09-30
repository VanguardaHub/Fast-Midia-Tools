"use client";

import { useState, useTransition } from "react";
import { atualizarPerfil } from "@/lib/actions/conta";

export function FormPerfil({ nome, telefone, email, perfil }: { nome: string; telefone: string; email: string; perfil: string }) {
  const [n, setN] = useState(nome);
  const [t, setT] = useState(telefone);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await atualizarPerfil({ nome: n, telefone: t });
          setMsg(r.ok ? "Dados atualizados." : r.erro);
        });
      }}
    >
      <div>
        <label className="label">E-mail</label>
        <input className="input" value={email} disabled />
      </div>
      <div>
        <label className="label">Perfil</label>
        <input className="input" value={perfil} disabled />
      </div>
      <div>
        <label className="label" htmlFor="nome">Nome</label>
        <input id="nome" className="input" value={n} onChange={(e) => setN(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="tel">WhatsApp (DDI+DDD+número)</label>
        <input id="tel" className="input" inputMode="tel" value={t} onChange={(e) => setT(e.target.value)} placeholder="5592999999999" />
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <button className="btn-primary" disabled={pendente}>Salvar</button>
    </form>
  );
}
