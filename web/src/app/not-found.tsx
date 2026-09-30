import Link from "next/link";

export const metadata = { title: "Página não encontrada" };

/** QA P1 #3 — 404 com identidade, em português e com caminho de volta. */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="card max-w-md space-y-3 text-center">
        <p className="text-5xl">🎬</p>
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-sm text-muted">O endereço pode estar errado, o item pode ter sido removido ou você não tem acesso a ele.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/" className="btn-primary">Ir para o início</Link>
          <Link href="/jobs" className="btn-outline">Ver jobs</Link>
        </div>
      </div>
    </main>
  );
}
