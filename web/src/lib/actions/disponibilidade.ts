"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { traduzirErro } from "@/lib/regras";

export type Resultado = { ok: true } | { ok: false; erro: string };

const Schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["manha", "tarde"]).nullable(),
  motivo: z.string().trim().max(120).optional(),
  /** só a gestão pode marcar para outro Fast */
  fastId: z.string().uuid().optional(),
});

/** RF-10 — o Fast informa dia/slot em que não pode gravar; a gestão pode registrar por ele. */
export async function marcarIndisponibilidade(entrada: z.infer<typeof Schema>): Promise<Resultado> {
  const s = await obterSessao();
  const parse = Schema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const fastId = s.ehGestao && d.fastId ? d.fastId : s.fastId;
  if (!fastId) return { ok: false, erro: "Seu usuário não está vinculado a um cadastro de Fast." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("indisponibilidade").insert({ fast_id: fastId, data: d.data, slot: d.slot, motivo: d.motivo || null });
  if (error) return { ok: false, erro: /indisponibilidade_unica/.test(error.message) ? "Este dia/slot já está marcado como indisponível." : traduzirErro(error.message) };
  revalidatePath("/campo");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function removerIndisponibilidade(id: string): Promise<Resultado> {
  await obterSessao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("indisponibilidade").delete().eq("id", id);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/campo");
  revalidatePath("/agenda");
  return { ok: true };
}
