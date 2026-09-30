import Link from "next/link";
import { exigirGestao } from "@/lib/sessao";

export default async function CadastrosLayout({ children }: LayoutProps<"/cadastros">) {
  const s = await exigirGestao();
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/cadastros/fasts" className="btn-outline">Fasts</Link>
        <Link href="/cadastros/clientes" className="btn-outline">Clientes</Link>
        <Link href="/cadastros/acessos" className="btn-outline">Acessos</Link>
        {s.ehAdmin && <Link href="/cadastros/configuracoes" className="btn-outline">Configurações</Link>}
        {s.ehAdmin && <Link href="/cadastros/auditoria" className="btn-outline">Auditoria</Link>}
        <Link href="/cadastros/integracoes" className="btn-outline">Integrações</Link>
      </nav>
      {children}
    </div>
  );
}
