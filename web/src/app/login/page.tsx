import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

/** Erros devolvidos pelo /auth/callback (OAuth/magic link) em linguagem do usuário. */
function traduzirErroDeLogin(erro: string | undefined): string | undefined {
  if (!erro) return undefined;
  if (/EMAIL_NAO_AUTORIZADO|Database error saving new user|unexpected_failure/i.test(erro)) {
    return "Este e-mail não está autorizado. Use a conta @vanguardamartech.com.br ou peça um convite à supervisão.";
  }
  if (/access_denied|cancel/i.test(erro)) return "Login cancelado no Google.";
  return erro;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const erro = traduzirErroDeLogin(typeof sp.erro === "string" ? sp.erro : undefined);
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="card w-full max-w-sm overflow-hidden p-0">
        <div className="h-1.5 w-full bg-brand" aria-hidden="true" />
        <div className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <img src="/icons/icon-192.svg" alt="" width={44} height={44} className="rounded-xl" />
            <div>
              <h1 className="text-xl font-bold leading-tight">Fast Mídia Tools</h1>
              <p className="text-sm text-muted">Vanguarda Martech · acesso corporativo</p>
            </div>
          </div>
          <LoginForm next={next} erroInicial={erro} />
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Somente e-mails do domínio corporativo, convidados pela supervisão ou cadastrados como Fast. A sessão expira automaticamente. Localização é coletada apenas em eventos do job, com o app aberto.
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">© Vanguarda Martech · Fast Mídia</p>
    </main>
  );
}
