"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/regras";

type Modo = "magic" | "senha";

export function LoginForm({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("magic");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(erroInicial ?? null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    iniciar(async () => {
      const supabase = criarClienteBrowser();
      if (modo === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) setMsg(traduzirErro(error.message));
        else setOk("Link de acesso enviado. Verifique seu e-mail corporativo.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(traduzirErro(error.message));
      else {
        router.replace(next);
        router.refresh();
      }
    });
  }

  async function google() {
    const supabase = criarClienteBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setMsg("Login Google ainda não configurado (decisão 3 da seção 14 do escopo).");
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@vanguardamartech.com.br" />
      </div>
      {modo === "senha" && (
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" className="input" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
      )}
      {msg && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
      {ok && <p className="rounded-xl bg-success/10 p-3 text-sm text-success">{ok}</p>}
      <button className="btn-primary w-full" disabled={pendente}>
        {pendente ? "Aguarde…" : modo === "magic" ? "Receber link por e-mail" : "Entrar"}
      </button>
      <button type="button" className="btn-outline w-full" onClick={google}>
        Entrar com Google Workspace
      </button>
      <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setModo(modo === "magic" ? "senha" : "magic")}>
        {modo === "magic" ? "Entrar com senha" : "Entrar com link por e-mail"}
      </button>
    </form>
  );
}
