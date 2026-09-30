export const metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Você está sem conexão</h1>
      <p className="max-w-sm text-muted">
        Check-ins e check-outs feitos offline ficam guardados no aparelho e são enviados
        automaticamente quando a conexão voltar.
      </p>
    </main>
  );
}
