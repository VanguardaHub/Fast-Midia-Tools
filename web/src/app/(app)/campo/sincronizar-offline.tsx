"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listarPendentes, remover } from "@/lib/offline";
import { registrarEvento } from "@/lib/actions/campo";

/** RF-37 — reenvia eventos guardados no aparelho quando a conexão volta. */
export function SincronizarOffline() {
  const router = useRouter();
  const [pendentes, setPendentes] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  async function sincronizar() {
    const fila = await listarPendentes();
    setPendentes(fila.length);
    if (fila.length === 0 || !navigator.onLine) return;
    let enviados = 0;
    for (const ev of fila) {
      const r = await registrarEvento({
        jobId: ev.jobId, tipo: ev.tipo, lat: ev.lat, lng: ev.lng, precisaoM: ev.precisaoM,
        capturadoEm: ev.capturadoEm, justificativa: ev.justificativa, chave: ev.chave, offline: true,
      });
      if (r.ok) {
        await remover(ev.chave);
        enviados++;
      } else if (!/rede|network|fetch/i.test(r.erro)) {
        // Erro de regra de negócio: descarta para não bloquear a fila e informa
        await remover(ev.chave);
        setMsg(`Evento offline rejeitado: ${r.erro}`);
      }
    }
    const restante = (await listarPendentes()).length;
    setPendentes(restante);
    if (enviados > 0) {
      setMsg(`${enviados} evento(s) sincronizado(s).`);
      router.refresh();
    }
  }

  useEffect(() => {
    const inicial = setTimeout(() => { void sincronizar(); }, 0);
    const aoVoltar = () => { void sincronizar(); };
    window.addEventListener("online", aoVoltar);
    return () => {
      clearTimeout(inicial);
      window.removeEventListener("online", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pendentes === 0 && !msg) return null;
  return (
    <div className="rounded-xl bg-warning/10 p-3 text-sm text-warning">
      {pendentes > 0 ? `${pendentes} evento(s) aguardando conexão para envio.` : msg}
      {pendentes > 0 && (
        <button className="ml-2 underline" onClick={sincronizar}>Tentar agora</button>
      )}
    </div>
  );
}
