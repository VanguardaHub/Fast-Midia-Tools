"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";

interface Props {
  /** tabelas públicas assinadas (precisam estar na publicação supabase_realtime) */
  tabelas?: string[];
  /** filtro opcional aplicado a todas as tabelas, ex.: "job_id=eq.<uuid>" */
  filtro?: string;
  /** recarga periódica de segurança */
  intervaloMs?: number;
  /** nome do canal (único por tela) */
  canal?: string;
  /** só o ponto, sem texto (para cabeçalhos compactos) */
  compacto?: boolean;
}

/**
 * Atualização ao vivo por eventos (RF-51 e todas as telas): assina mudanças nas tabelas indicadas
 * via Supabase Realtime (respeita RLS) e recarrega os dados do servidor. Fallback: recarga periódica.
 * Não rastreia nada; apenas reflete o que já foi gravado por outra pessoa ou pelo sistema.
 */
export function AoVivo({ tabelas = ["job", "alerta", "corrida_99", "briefing", "excecao"], filtro, intervaloMs = 120_000, canal = "ao-vivo", compacto = false }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<"conectando" | "ao_vivo" | "offline">("conectando");
  const [ultima, setUltima] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = criarClienteBrowser();
    const atualizar = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        router.refresh();
        setUltima(new Date());
      }, 800); // agrupa eventos em rajada
    };

    let ch = supabase.channel(`${canal}-${Math.random().toString(36).slice(2, 8)}`);
    for (const t of tabelas) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t, ...(filtro ? { filter: filtro } : {}) }, atualizar);
    }
    ch.subscribe((status) => {
      setEstado(status === "SUBSCRIBED" ? "ao_vivo" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "conectando");
    });

    const poll = setInterval(atualizar, intervaloMs);
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", aoVoltar);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, filtro, intervaloMs, tabelas.join(",")]);

  const cor = estado === "ao_vivo" ? "bg-success" : estado === "offline" ? "bg-danger" : "bg-warning";
  const texto = estado === "ao_vivo" ? "ao vivo" : estado === "offline" ? "sem conexão ao vivo" : "conectando";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" title="Esta tela atualiza sozinha quando alguém altera um job, briefing, corrida, alerta ou exceção">
      <span className={`inline-block size-2 rounded-full ${cor} ${estado === "ao_vivo" ? "animate-pulse" : ""}`} />
      {!compacto && texto}
      {!compacto && ultima && ` · atualizado ${ultima.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
    </span>
  );
}
