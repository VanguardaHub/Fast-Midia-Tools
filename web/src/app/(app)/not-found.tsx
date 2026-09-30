import Link from "next/link";

/** QA P1 #3 — item inexistente dentro do app (ex.: job removido), mantendo o menu. */
export default function NaoEncontradoApp() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-xl font-bold">Não encontramos este item</h1>
      <p className="text-sm text-muted">Ele pode ter sido excluído, cancelado há muito tempo ou o link está incompleto.</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link href="/" className="btn-primary">Ir para o início</Link>
        <Link href="/jobs" className="btn-outline">Ver jobs</Link>
      </div>
    </div>
  );
}
