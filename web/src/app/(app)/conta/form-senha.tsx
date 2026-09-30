"use client";

import { useState, useTransition } from "react";
import { criarClienteBrowser } from "@/lib/supabase/client";

/** Define/troca a senha da própria conta (não depende de e-mail de recuperação). */
export function FormSenha() {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        if (senha.length < 10) return setMsg("Use pelo menos 10 caracteres.");
        if (senha !== confirma) return setMsg("As senhas não coincidem.");
        iniciar(async () => {
          const { error } = await criarClienteBrowser().auth.updateUser({ password: senha });
          setMsg(error ? error.message : "Senha atualizada.");
          if (!error) { setSenha(""); setConfirma(""); }
        });
      }}
    >
      <h2 className="font-semibold">Definir senha</h2>
      <div><label className="label" htmlFor="s1">Nova senha</label><input id="s1" className="input" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
      <div><label className="label" htmlFor="s2">Confirmar</label><input id="s2" className="input" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required /></div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <button className="btn-primary" disabled={pendente}>Salvar senha</button>
    </form>
  );
}
