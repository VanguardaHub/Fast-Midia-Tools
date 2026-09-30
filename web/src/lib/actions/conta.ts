"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/sessao";
import { traduzirErro } from "@/lib/regras";

export type Resultado = { ok: true } | { ok: false; erro: string };

export async function aceitarTermo(versao: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const ua = (await headers()).get("user-agent") ?? undefined;
  const { error } = await supabase.rpc("aceitar_termo", { p_versao: versao, p_user_agent: ua });
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function atualizarPerfil(dados: { nome: string; telefone: string }): Promise<Resultado> {
  const s = await obterSessao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("perfil")
    .update({ nome: dados.nome.trim(), telefone: dados.telefone.trim() || null })
    .eq("id", s.usuarioId);
  if (error) return { ok: false, erro: traduzirErro(error.message) };
  revalidatePath("/conta");
  return { ok: true };
}
