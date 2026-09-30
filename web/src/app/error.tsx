"use client";

import Link from "next/link";

/** QA P1 #3 — erro inesperado com identidade, em português, com tentar de novo e caminho de volta. */
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="card max-w-md space-y-3 text-center">
        <p className="text-5xl">⚠️</p>
        <h1 className="text-2xl font-bold">Algo deu errado</h1>
        <p className="text-sm text-muted">A tela não pôde ser carregada. Tente de novo; se persistir, avise a supervisão informando o código abaixo.</p>
        {error.digest && <p className="font-mono text-xs text-muted">código {error.digest}</p>}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button type="button" className="btn-primary" onClick={reset}>Tentar de novo</button>
          <Link href="/" className="btn-outline">Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}
