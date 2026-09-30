import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Perfil = Database["public"]["Tables"]["perfil"]["Row"];
export type PerfilTipo = Database["public"]["Enums"]["perfil_tipo"];

export interface Sessao {
  usuarioId: string;
  email: string;
  perfil: Perfil;
  fastId: string | null;
  ehGestao: boolean;
  ehAdmin: boolean;
  consentiu: boolean;
  versaoTermo: string;
}

/**
 * Carrega a sessão + perfil + vínculo de Fast + consentimento vigente.
 * Memoizado por requisição (React cache). Redireciona para /login se ausente.
 */
export const obterSessao = cache(async (): Promise<Sessao> => {
  const supabase = await criarClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const sub = claims?.claims?.sub as string | undefined;
  if (!sub) redirect("/login");

  const [{ data: perfil }, { data: fast }, { data: cfg }] = await Promise.all([
    supabase.from("perfil").select("*").eq("id", sub).single(),
    supabase.from("fast").select("id").eq("perfil_id", sub).maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "versao_termo_vigente").single(),
  ]);
  if (!perfil) redirect("/login?erro=Perfil%20n%C3%A3o%20encontrado");

  const versaoTermo = typeof cfg?.valor === "string" ? cfg.valor : "1.0";
  const { data: consent } = await supabase
    .from("consentimento")
    .select("id")
    .eq("usuario_id", sub)
    .eq("versao_termo", versaoTermo)
    .maybeSingle();

  return {
    usuarioId: sub,
    email: perfil.email,
    perfil,
    fastId: fast?.id ?? null,
    ehGestao: perfil.perfil === "supervisora" || perfil.perfil === "admin",
    ehAdmin: perfil.perfil === "admin",
    consentiu: Boolean(consent),
    versaoTermo,
  };
});

export async function exigirGestao(): Promise<Sessao> {
  const s = await obterSessao();
  if (!s.ehGestao) redirect("/");
  return s;
}

export async function exigirAdmin(): Promise<Sessao> {
  const s = await obterSessao();
  if (!s.ehAdmin) redirect("/");
  return s;
}
