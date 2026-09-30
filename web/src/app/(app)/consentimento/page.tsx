import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { AceitarTermo } from "./aceitar-termo";

export const metadata = { title: "Termo de ciência" };

export default async function ConsentimentoPage(props: PageProps<"/consentimento">) {
  const s = await obterSessao();
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/campo";
  if (s.consentiu) redirect(next);

  const supabase = await criarClienteServidor();
  const { data: termo } = await supabase.from("termo_ciencia").select("*").eq("vigente", true).single();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">{termo?.titulo ?? "Termo de ciência"}</h1>
      <p className="text-sm text-muted">Versão {termo?.versao} · Seção 8 do escopo (LGPD): coleta mínima, transparente e limitada à janela do job.</p>
      <div className="card whitespace-pre-line text-base leading-relaxed">{termo?.conteudo}</div>
      <ul className="card space-y-2 text-sm">
        <li>📍 Captura em <strong>chegada, saída e corrida</strong>, por toque, com o app aberto.</li>
        <li>📡 Entre a chegada e a saída, com a tela do job aberta, posição a cada ~30 s para a supervisora, com indicador visível e botão de pausa.</li>
        <li>🕒 Somente dentro da janela do job. Nunca fora do expediente nem em segundo plano.</li>
        <li>🗑️ Exclusão automática: posições da gravação após 7 dias; chegada, saída e corrida após 90 dias.</li>
        <li>👁️ Somente Supervisora e Admin consultam posições; toda consulta fica registrada.</li>
        <li>✉️ Acesso, correção e contestação pelo canal do DPO.</li>
      </ul>
      {termo && <AceitarTermo versao={termo.versao} next={next} />}
    </div>
  );
}
