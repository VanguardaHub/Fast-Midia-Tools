"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";
import { traduzirErro } from "@/lib/regras";
import { IconeGoogle } from "@/components/icone-google";

type Modo = "senha" | "magic";
const MAGIC_LINK = process.env.NEXT_PUBLIC_AUTH_MAGIC_LINK === "true"; // exige SMTP configurado no Supabase Auth
const GOOGLE = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true"; // provedor Google habilitado no Supabase Auth

/**
 * RF-01 — login corporativo pelo Supabase Auth.
 * Google (Workspace da Vanguarda) e e-mail/senha. O primeiro acesso por senha vem pelo link de convite
 * (Cadastros → Acessos); o banco só aceita e-mails do domínio corporativo, convidados ou cadastrados como Fast.
 */
export function LoginForm({ next, erroInicial }: { next: string; erroInicial?: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(erroInicial ?? null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [googlePendente, setGooglePendente] = useState(false);

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
        else setOk("Link de acesso enviado. Verifique seu e-mail.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setMsg(error.message.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : traduzirErro(error.message));
      else {
        router.replace(next);
        router.refresh();
      }
    });
  }

  async function google() {
    setMsg(null);
    setGooglePendente(true);
    const supabase = criarClienteBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setGooglePendente(false);
      setMsg("Login Google indisponível no momento. Use e-mail e senha.");
    }
  }

  return (
    <div className="space-y-5">
      {GOOGLE && (
        <>
          <button
            type="button"
            className="btn-outline w-full"
            onClick={google}
            disabled={googlePendente}
            aria-label="Entrar com a conta Google da Vanguarda"
          >
            <IconeGoogle />
            {googlePendente ? "Abrindo o Google…" : "Entrar com o Google"}
          </button>
          <p className="divisor">ou com e-mail e senha</p>
        </>
      )}
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
        {msg && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
        {ok && <p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">{ok}</p>}
        <button className="btn-primary w-full" disabled={pendente}>
          {pendente ? "Aguarde…" : modo === "magic" ? "Receber link por e-mail" : "Entrar"}
        </button>
        {MAGIC_LINK && (
          <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setModo(modo === "magic" ? "senha" : "magic")}>
            {modo === "magic" ? "Entrar com senha" : "Entrar com link por e-mail"}
          </button>
        )}
        <p className="text-center text-xs text-muted">
          Primeiro acesso ou esqueceu a senha? Peça à supervisão um link de acesso em Cadastros → Acessos e depois defina sua senha em Minha conta.
        </p>
      </form>
    </div>
  );
}
