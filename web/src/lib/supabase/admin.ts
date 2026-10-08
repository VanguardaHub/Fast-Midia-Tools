import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Cliente com service_role — só no servidor (worker, integrações, convites). Nunca exposto ao navegador. */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function adminDisponivel(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
