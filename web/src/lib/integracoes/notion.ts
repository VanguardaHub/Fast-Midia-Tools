import type { Contexto, ResultadoIntegracao } from "./tipos";

/**
 * RF-61 — espelha o job no Notion (status e campos) para manter as views atuais da supervisora.
 * Propriedades iguais às usadas em apps-script/agendamento.gs.
 */
const STATUS_NOTION: Record<string, string> = {
  aguardando_briefing: "Aguardando briefing",
  briefing_recebido: "Briefing recebido",
  em_gravacao: "Em gravação",
  material_entregue: "Material entregue",
  em_edicao: "Em edição",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export async function espelharNotion(ctx: Contexto): Promise<ResultadoIntegracao> {
  const token = process.env.NOTION_TOKEN;
  const db = process.env.NOTION_DATABASE_ID;
  if (!token || !db) return { ok: false, erro: "NOTION_TOKEN/NOTION_DATABASE_ID não configurados" };
  const j = ctx.job;

  const observacoes = [
    j.briefing?.local ? `📍 Local: ${j.briefing.local}` : "",
    j.briefing?.roteiro ? `📝 Roteiro: ${j.briefing.roteiro}` : "",
    j.briefing?.observacoes ? `💬 Obs do cliente: ${j.briefing.observacoes}` : "",
    j.observacoes ?? "",
    j.data_edicao ? `Edição: ${j.data_edicao.split("-").reverse().join("/")} — ${j.bloco_edicao === "manha" ? "Manhã (08:00–12:00)" : "Tarde (13:00–17:00)"}` : "",
  ].filter(Boolean).join("\n");

  const props: Record<string, unknown> = {
    Job: { title: [{ text: { content: `${j.data} — ${j.cliente?.nome ?? ""}` } }] },
    Cliente: { rich_text: [{ text: { content: j.cliente?.nome ?? "" } }] },
    "Fast Responsável": { select: { name: j.fast?.nome_notion ?? j.fast?.nome ?? "Outro" } },
    "Data do Compromisso": { date: { start: j.data } },
    Status: { select: { name: STATUS_NOTION[j.status] ?? j.status } },
    "Corrida 99 Solicitada": { checkbox: j.precisa_99 },
    Observações: { rich_text: [{ text: { content: observacoes.slice(0, 1900) } }] },
    "Link do Briefing (Forms)": { url: `${ctx.urlApp}/jobs/${j.id}` },
  };
  if (j.pasta_ingest_url) props["Pasta de Ingest (Drive)"] = { url: j.pasta_ingest_url };
  if (j.prazo_material) props["Prazo de Entrega do Material"] = { date: { start: j.prazo_material } };

  const headers = { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
  const r = j.notion_page_id
    ? await fetch(`https://api.notion.com/v1/pages/${j.notion_page_id}`, { method: "PATCH", headers, body: JSON.stringify({ properties: props }) })
    : await fetch("https://api.notion.com/v1/pages", { method: "POST", headers, body: JSON.stringify({ parent: { database_id: db }, properties: props }) });
  const body = (await r.json()) as { id?: string; message?: string };
  if (!r.ok) return { ok: false, erro: `Notion ${r.status}: ${body.message ?? "erro"}`, descartar: r.status === 400 };
  return { ok: true, resultado: { page_id: body.id }, patchJob: j.notion_page_id ? undefined : { notion_page_id: body.id ?? null } };
}
