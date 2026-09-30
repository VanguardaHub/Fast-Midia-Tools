"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { exigirGestao } from "@/lib/sessao";
import { traduzirErro } from "@/lib/regras";
import { gerarEEnviarConvite, type ResultadoConvite } from "@/lib/integracoes/convites";

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

export type ResultadoEnvioConvite = { ok: false; erro: string } | { ok: true; link: string; emailEnviado: boolean; aviso?: string };

/** RF-01 / RF-02 — convite de acesso: registra, gera link de uso único e envia por e-mail (Resend) quando configurado. */
export async function criarConvite(entrada: z.infer<typeof ConviteSchema>): Promise<ResultadoEnvioConvite> {
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
  const envio: ResultadoConvite = await gerarEEnviarConvite(d.email.toLowerCase(), d.nome || null, d.perfil, s.perfil.nome);
  if (!envio.ok) return { ok: false, erro: envio.erro };
  return { ok: true, link: envio.link, emailEnviado: envio.emailEnviado, aviso: envio.aviso };
}

/** Reenvia (gera novo link) para um convite ainda não usado ou para um usuário existente. */
export async function reenviarConvite(email: string): Promise<ResultadoEnvioConvite> {
  const s = await exigirGestao();
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase.from("convite").select("email, nome, perfil").eq("email", email.toLowerCase()).maybeSingle();
  if (!c) return { ok: false, erro: "Convite não encontrado." };
  const envio = await gerarEEnviarConvite(c.email, c.nome, c.perfil, s.perfil.nome);
  if (!envio.ok) return { ok: false, erro: envio.erro };
  return { ok: true, link: envio.link, emailEnviado: envio.emailEnviado, aviso: envio.aviso };
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
