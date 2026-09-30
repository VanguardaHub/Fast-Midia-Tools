"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao, obterSessao } from "@/lib/sessao";
import { traduzirErro } from "@/lib/regras";
import { geocodificarMelhor } from "@/lib/geocodificacao";
import type { Database } from "@/lib/database.types";

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string };

const slot = z.enum(["manha", "tarde"]);
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const NovoJobSchema = z.object({
  clienteId: z.string().uuid().optional(),
  clienteNome: z.string().trim().min(2).optional(),
  fastId: z.string().uuid(),
  data: dataISO,
  slot,
  analistaWhatsapp: z.string().trim().optional(),
  prazoMaterial: dataISO.optional().or(z.literal("")),
  dataEdicao: dataISO.optional().or(z.literal("")),
  blocoEdicao: slot.optional().or(z.literal("")),
  endereco: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  excecaoMotivo: z.string().trim().optional(),
});
export type NovoJob = z.infer<typeof NovoJobSchema>;

function normalizarWhatsapp(v?: string): string | null {
  if (!v) return null;
  let d = v.replace(/\D/g, "");
  if (d.length > 0 && d.length <= 11) d = "55" + d;
  return d || null;
}

function revalidarJobs(id?: string) {
  revalidatePath("/agenda");
  revalidatePath("/jobs");
  revalidatePath("/painel");
  revalidatePath("/campo");
  revalidatePath("/alertas");
  if (id) {
    revalidatePath(`/jobs/${id}`);
    revalidatePath(`/campo/jobs/${id}`);
  }
}

/** RF-11 / RF-12 / RF-13 / RF-14 — criação do job (regras aplicadas pelo banco). */
export async function criarJob(entrada: NovoJob): Promise<Resultado<{ id: string }>> {
  const parse = NovoJobSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const s = await obterSessao();
  const supabase = await criarClienteServidor();

  let clienteId = d.clienteId;
  if (!clienteId) {
    if (!d.clienteNome) return { ok: false, erro: "Informe o cliente" };
    const { data: existente } = await supabase.from("cliente").select("id").ilike("nome", d.clienteNome).maybeSingle();
    if (existente) clienteId = existente.id;
    else {
      const { data: novo, error } = await supabase.from("cliente").insert({ nome: d.clienteNome }).select("id").single();
      if (error) return { ok: false, erro: traduzirErro(error.message) };
      clienteId = novo.id;
    }
  }

  const { data, error } = await supabase
    .from("job")
    .insert({
      cliente_id: clienteId,
      fast_id: d.fastId,
      data: d.data,
      slot: d.slot,
      analista_id: s.perfil.perfil === "analista" ? s.usuarioId : null,
      analista_whatsapp: normalizarWhatsapp(d.analistaWhatsapp),
      prazo_material: d.prazoMaterial || null,
      data_edicao: d.dataEdicao || null,
      bloco_edicao: d.blocoEdicao || null,
      endereco: d.endereco || null,
      observacoes: d.observacoes || null,
      excecao_motivo: s.ehGestao && d.excecaoMotivo ? d.excecaoMotivo : null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  if (d.endereco) await definirPontoAutomatico(data.id, d.endereco);
  revalidarJobs(data.id);
  return { ok: true, dados: { id: data.id } };
}

/**
 * RF-36 — ponto do job definido automaticamente a partir do endereço (não confirmado; a gestão confirma no mapa).
 * Sem ponto, o Mapa do dia não tem o que mostrar e o check-in exige justificativa. Falhas são silenciosas.
 */
async function definirPontoAutomatico(jobId: string, endereco: string): Promise<void> {
  const supabase = await criarClienteServidor();
  const { data: coords } = await supabase.rpc("job_coordenadas", { p_job_id: jobId });
  if (coords?.[0]?.lat != null) return; // já tem ponto (definido/confirmado manualmente)
  const geo = await geocodificarMelhor(endereco);
  if (!geo) return;
  await supabase.rpc("definir_ponto_job", { p_job_id: jobId, p_lat: geo.lat, p_lng: geo.lng, p_confirmado: false });
}

const EdicaoJobSchema = z.object({
  data: dataISO.optional(),
  slot: slot.optional(),
  fastId: z.string().uuid().optional(),
  prazoMaterial: dataISO.nullable().optional(),
  dataEdicao: dataISO.nullable().optional(),
  blocoEdicao: slot.nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  pastaIngestUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  analistaWhatsapp: z.string().trim().nullable().optional(),
  raioGeofenceM: z.number().int().min(20).max(5000).optional(),
  excecaoMotivo: z.string().trim().nullable().optional(),
});

/** RF-15 / RF-53 — reagendar, trocar Fast, ajustar campos. */
export async function atualizarJob(id: string, entrada: z.infer<typeof EdicaoJobSchema>): Promise<Resultado> {
  const parse = EdicaoJobSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const patch: Database["public"]["Tables"]["job"]["Update"] = {};
  if (d.data) patch.data = d.data;
  if (d.slot) patch.slot = d.slot;
  if (d.fastId) patch.fast_id = d.fastId;
  if (d.prazoMaterial !== undefined) patch.prazo_material = d.prazoMaterial;
  if (d.dataEdicao !== undefined) patch.data_edicao = d.dataEdicao;
  if (d.blocoEdicao !== undefined) patch.bloco_edicao = d.blocoEdicao;
  if (d.endereco !== undefined) patch.endereco = d.endereco;
  if (d.observacoes !== undefined) patch.observacoes = d.observacoes;
  if (d.pastaIngestUrl !== undefined) patch.pasta_ingest_url = d.pastaIngestUrl || null;
  if (d.analistaWhatsapp !== undefined) patch.analista_whatsapp = normalizarWhatsapp(d.analistaWhatsapp ?? undefined);
  if (d.raioGeofenceM !== undefined) patch.raio_geofence_m = d.raioGeofenceM;
  if (d.excecaoMotivo !== undefined) patch.excecao_motivo = d.excecaoMotivo;

  const { error } = await supabase.from("job").update(patch).eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidarJobs(id);
  return { ok: true };
}

/** RF-50 — transição de status pelo Kanban (validações no banco: RF-42). */
export async function alterarStatus(id: string, status: Database["public"]["Enums"]["job_status"]): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("job").update({ status }).eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidarJobs(id);
  return { ok: true };
}

export async function cancelarJob(id: string, motivo: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_job", { p_job_id: id, p_motivo: motivo });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidarJobs(id);
  return { ok: true };
}

/** RF-36 — confirmação manual do ponto no mapa. */
export async function definirPonto(id: string, lat: number, lng: number, raioM?: number): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_ponto_job", { p_job_id: id, p_lat: lat, p_lng: lng, p_raio_m: raioM, p_confirmado: true });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidarJobs(id);
  return { ok: true };
}

const BriefingSchema = z.object({
  local: z.string().trim().min(5, "Informe o local completo"),
  roteiro: z.string().trim().min(5, "Informe o roteiro/instruções"),
  observacoes: z.string().trim().optional(),
  precisa99: z.boolean(),
  referenciaVisualPath: z.string().trim().optional(),
});

/** RF-20 — briefing dentro do app (substitui o Google Forms). */
export async function salvarBriefing(jobId: string, entrada: z.infer<typeof BriefingSchema>): Promise<Resultado> {
  const parse = BriefingSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("briefing").upsert(
    {
      job_id: jobId,
      local: d.local,
      roteiro: d.roteiro,
      observacoes: d.observacoes || null,
      precisa_99: d.precisa99,
      referencia_visual_path: d.referenciaVisualPath || null,
    },
    { onConflict: "job_id" },
  );
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  await definirPontoAutomatico(jobId, d.local);
  revalidarJobs(jobId);
  return { ok: true };
}

export async function decidirExcecao(id: string, aprovada: boolean, parecer?: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("decidir_excecao", { p_excecao_id: id, p_aprovada: aprovada, p_parecer: parecer });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/alertas");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function resolverAlerta(id: string): Promise<Resultado> {
  const s = await obterSessao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("alerta")
    .update({ resolvido: true, resolvido_por: s.usuarioId, resolvido_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/alertas");
  revalidatePath("/painel");
  return { ok: true };
}

/** RF-52 — reabre um alerta resolvido por engano (volta para a lista de abertos). */
export async function reabrirAlerta(id: string): Promise<Resultado> {
  await exigirGestao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("alerta").update({ resolvido: false, resolvido_por: null, resolvido_em: null }).eq("id", id);
  if (error) return { ok: false, erro: /alerta_aberto_unico/.test(error.message) ? "Já existe um alerta aberto deste tipo para o job." : traduzirErro(error.message) };
  revalidatePath("/alertas");
  revalidatePath("/painel");
  return { ok: true };
}

/** RF-41 / RF-43 — conciliação da corrida pela supervisora. */
export async function validarCorrida(id: string, validada: boolean): Promise<Resultado> {
  const s = await obterSessao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("corrida_99")
    .update({ validada, validada_por: validada ? s.usuarioId : null, validada_em: validada ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/jobs");
  return { ok: true };
}
