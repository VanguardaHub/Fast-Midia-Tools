"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ itens, mobile }: { itens: { href: string; rotulo: string }[]; mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {itens.map((i) => {
        const ativo = pathname === i.href || (i.href !== "/campo" && pathname.startsWith(i.href + "/")) || (i.href === "/campo" && pathname === "/campo");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={
              mobile
                ? `flex min-h-12 flex-1 items-center justify-center rounded-xl text-sm font-medium ${ativo ? "bg-primary/10 text-primary" : "text-muted"}`
                : `rounded-lg px-3 py-1.5 text-sm font-medium ${ativo ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"}`
            }
          >
            {i.rotulo}
          </Link>
        );
      })}
    </>
  );
}
