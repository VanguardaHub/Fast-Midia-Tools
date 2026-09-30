"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/regras";
import type { Database } from "@/lib/database.types";

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string };

const EventoSchema = z.object({
  jobId: z.string().uuid(),
  tipo: z.enum(["chegada", "saida", "corrida", "posicao"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisaoM: z.number().min(0),
  capturadoEm: z.string().datetime(),
  justificativa: z.string().trim().optional(),
  chave: z.string().min(8),
  offline: z.boolean().optional(),
});
export type EntradaEvento = z.infer<typeof EventoSchema>;

/** RF-31 / RF-32 / RF-37 / RF-38 — registra check-in, check-out, corrida ou posição de rastreio (idempotente por chave). */
export async function registrarEvento(entrada: EntradaEvento): Promise<Resultado<{ dentroGeofence: boolean | null; distanciaM: number | null }>> {
  const parse = EventoSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("registrar_evento_localizacao", {
    p_job_id: d.jobId,
    p_tipo: d.tipo,
    p_lat: d.lat,
    p_lng: d.lng,
    p_precisao_m: d.precisaoM,
    p_capturado_em: d.capturadoEm,
    p_justificativa: d.justificativa,
    p_chave: d.chave,
    p_offline: d.offline ?? false,
  });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  // Posição de rastreio (RF-38): o banco pode descartar por frequência (retorna nulo) e não há o que revalidar.
  if (d.tipo === "posicao") return { ok: true, dados: { dentroGeofence: data?.dentro_geofence ?? null, distanciaM: data?.distancia_m ?? null } };
  revalidatePath(`/campo/jobs/${d.jobId}`);
  revalidatePath("/campo");
  revalidatePath("/mapa");
  return { ok: true, dados: { dentroGeofence: data.dentro_geofence, distanciaM: data.distancia_m } };
}

export async function marcarMaterialEntregue(jobId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_material_entregue", { p_job_id: jobId });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath(`/campo/jobs/${jobId}`);
  revalidatePath("/campo");
  revalidatePath("/jobs");
  return { ok: true };
}

const CorridaSchema = z.object({
  jobId: z.string().uuid(),
  sentido: z.enum(["ida", "volta"]),
  valor: z.number().min(0).nullable(),
  comprovantePath: z.string().min(3).nullable(),
  origem: z.string().trim().optional(),
  destino: z.string().trim().optional(),
});

/** RF-41 / RF-44 — comprovante e valor por sentido (upload feito no cliente para o bucket privado). */
export async function salvarCorrida(entrada: z.infer<typeof CorridaSchema>): Promise<Resultado> {
  const parse = CorridaSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const linha: Database["public"]["Tables"]["corrida_99"]["Insert"] = {
    job_id: d.jobId,
    sentido: d.sentido,
    valor: d.valor,
    comprovante_path: d.comprovantePath,
    origem: d.origem || null,
    destino: d.destino || null,
  };
  const { error } = await supabase.from("corrida_99").upsert(linha, { onConflict: "job_id,sentido" });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath(`/campo/jobs/${d.jobId}`);
  revalidatePath(`/jobs/${d.jobId}`);
  return { ok: true };
}
