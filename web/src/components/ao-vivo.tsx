"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteBrowser } from "@/lib/supabase/client";

/**
 * Atualização ao vivo por eventos (RF-51): assina mudanças nas tabelas indicadas via Supabase Realtime
 * e recarrega os dados do servidor. Fallback: recarga periódica. Não rastreia nada; apenas reflete
 * eventos já registrados pelo Fast (check-in, check-out, corrida).
 */
export function AoVivo({ tabelas = ["job", "alerta", "corrida_99"], intervaloMs = 120_000 }: { tabelas?: string[]; intervaloMs?: number }) {
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

    let canal = supabase.channel("mapa-do-dia");
    for (const t of tabelas) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: t }, atualizar);
    }
    canal.subscribe((status) => {
      setEstado(status === "SUBSCRIBED" ? "ao_vivo" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "offline" : "conectando");
    });

    const poll = setInterval(atualizar, intervaloMs);
    return () => {
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cor = estado === "ao_vivo" ? "bg-success" : estado === "offline" ? "bg-danger" : "bg-warning";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" title="Atualiza quando um check-in, check-out ou corrida é registrado">
      <span className={`inline-block size-2 rounded-full ${cor} ${estado === "ao_vivo" ? "animate-pulse" : ""}`} />
      {estado === "ao_vivo" ? "ao vivo" : estado === "offline" ? "sem conexão ao vivo" : "conectando"}
      {ultima && ` · atualizado ${ultima.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
    </span>
  );
}
