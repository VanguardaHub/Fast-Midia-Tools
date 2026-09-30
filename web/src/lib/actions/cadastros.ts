"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { traduzirErro } from "@/lib/regras";

export type Resultado = { ok: true } | { ok: false; erro: string };

const FastSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2),
  emailCalendario: z.string().trim().email(),
  telefone: z.string().trim().optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  nomeNotion: z.string().trim().optional(),
  ativo: z.boolean().default(true),
});

/** RF-03 — cadastro de Fasts por interface. */
export async function salvarFast(entrada: z.infer<typeof FastSchema>): Promise<Resultado> {
  await exigirGestao();
  const parse = FastSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const linha = {
    nome: d.nome,
    email_calendario: d.emailCalendario.toLowerCase(),
    telefone: d.telefone?.replace(/\D/g, "") || null,
    cor: d.cor,
    nome_notion: d.nomeNotion || null,
    ativo: d.ativo,
  };
  const { error } = d.id
    ? await supabase.from("fast").update(linha).eq("id", d.id)
    : await supabase.from("fast").insert(linha);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/cadastros/fasts");
  revalidatePath("/agenda");
  return { ok: true };
}

const ClienteSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2),
  grupo: z.string().trim().optional(),
  pastaDriveId: z.string().trim().optional(),
  pastaDriveUrl: z.string().trim().url().optional().or(z.literal("")),
  contatoNome: z.string().trim().optional(),
  contatoWhatsapp: z.string().trim().optional(),
  ativo: z.boolean().default(true),
});

/** RF-16 — clientes e pasta do Drive (CRIAÇÃO/[ANO]/[CLIENTE]). */
export async function salvarCliente(entrada: z.infer<typeof ClienteSchema>): Promise<Resultado> {
  const parse = ClienteSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  const supabase = await criarClienteServidor();
  const linha = {
    nome: d.nome,
    grupo: d.grupo || null,
    pasta_drive_id: d.pastaDriveId || null,
    pasta_drive_url: d.pastaDriveUrl || null,
    contato_nome: d.contatoNome || null,
    contato_whatsapp: d.contatoWhatsapp?.replace(/\D/g, "") || null,
    ativo: d.ativo,
  };
  const { error } = d.id
    ? await supabase.from("cliente").update(linha).eq("id", d.id)
    : await supabase.from("cliente").insert(linha);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/cadastros/clientes");
  revalidatePath("/agenda");
  return { ok: true };
}

const ConviteSchema = z.object({
  email: z.string().trim().email(),
  nome: z.string().trim().optional(),
  perfil: z.enum(["fast", "analista", "supervisora", "admin"]),
});

/** RF-01 / RF-02 — convite de acesso (permite e-mail fora do domínio e define o perfil). */
export async function criarConvite(entrada: z.infer<typeof ConviteSchema>): Promise<Resultado> {
  const s = await exigirGestao();
  const parse = ConviteSchema.safeParse(entrada);
  if (!parse.success) return { ok: false, erro: parse.error.issues.map((i) => i.message).join("; ") };
  const d = parse.data;
  if ((d.perfil === "admin" || d.perfil === "supervisora") && !s.ehAdmin) {
    return { ok: false, erro: "Apenas Admin convida Supervisora ou Admin." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("convite")
    .upsert({ email: d.email.toLowerCase(), nome: d.nome || null, perfil: d.perfil, criado_por: s.usuarioId }, { onConflict: "email" });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/cadastros/acessos");
  return { ok: true };
}

export async function alterarPerfilUsuario(usuarioId: string, perfil: "fast" | "analista" | "supervisora" | "admin", ativo: boolean): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("perfil").update({ perfil, ativo }).eq("id", usuarioId);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/cadastros/acessos");
  return { ok: true };
}

export async function salvarConfiguracao(chave: string, valor: unknown): Promise<Resultado> {
  const s = await exigirGestao();
  if (!s.ehAdmin) return { ok: false, erro: "Apenas Admin altera configurações." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("configuracao")
    .update({ valor: valor as never, atualizado_por: s.usuarioId, atualizado_em: new Date().toISOString() })
    .eq("chave", chave);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/cadastros/configuracoes");
  return { ok: true };
}
