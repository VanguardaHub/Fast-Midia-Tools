import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const erro = typeof sp.erro === "string" ? sp.erro : undefined;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icons/icon-192.svg" alt="" width={44} height={44} className="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Fast Mídia Tools</h1>
            <p className="text-sm text-muted">Acesso corporativo · Vanguarda Martech</p>
          </div>
        </div>
        <LoginForm next={next} erroInicial={erro} />
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Acesso por e-mail e senha (Supabase Auth). Somente e-mails do domínio corporativo ou convidados pela supervisão; a sessão expira automaticamente. Localização é coletada apenas em eventos do job, com o app aberto.
        </p>
      </div>
    </main>
  );
}
