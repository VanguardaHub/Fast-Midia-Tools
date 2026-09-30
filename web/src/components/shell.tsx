import Link from "next/link";
import type { Sessao } from "@/lib/sessao";
import { NavLinks } from "./nav-links";

export function Shell({ sessao, children }: { sessao: Sessao; children: React.ReactNode }) {
  const itens = sessao.ehGestao
    ? [
        { href: "/painel", rotulo: "Painel" },
        { href: "/agenda", rotulo: "Agenda" },
        { href: "/jobs", rotulo: "Jobs" },
        { href: "/mapa", rotulo: "Mapa" },
        { href: "/alertas", rotulo: "Alertas" },
        { href: "/indicadores", rotulo: "Indicadores" },
        { href: "/cadastros", rotulo: "Cadastros" },
      ]
    : sessao.perfil.perfil === "analista"
      ? [
          { href: "/agenda", rotulo: "Agenda" },
          { href: "/jobs", rotulo: "Jobs" },
        ]
      : [
          { href: "/campo", rotulo: "Hoje" },
          { href: "/campo/historico", rotulo: "Histórico" },
        ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <img src="/icons/icon-192.svg" alt="" width={28} height={28} className="rounded-lg" />
            <span className="hidden sm:inline">Fast Mídia Tools</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            <NavLinks itens={itens} />
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/conta" className="max-w-40 truncate text-muted">{sessao.perfil.nome}</Link>
            <span className="badge bg-primary/10 text-primary">{sessao.perfil.perfil}</span>
            <form action="/auth/sair" method="post">
              <button className="text-muted underline">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:pb-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="flex justify-around px-2 py-1">
          <NavLinks itens={itens} mobile />
        </div>
      </nav>
    </div>
  );
}
