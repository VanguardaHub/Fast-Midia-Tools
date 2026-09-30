"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reabrirAlerta, resolverAlerta } from "@/lib/actions/jobs";
import { fmtDataHora } from "@/lib/formato";

interface A {
  id: string;
  jobId: string | null;
  tipo: string;
  severidade: string;
  mensagem: string;
  criadoEm: string;
  job: string;
  resolvidoEm?: string | null;
  resolvidoPor?: string | null;
}

/** RF-52 — lista de alertas abertos (resolver) ou resolvidos recentemente (reabrir). */
export function ListaAlertas({ alertas, modo = "abertos" }: { alertas: A[]; modo?: "abertos" | "resolvidos" }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [emCurso, setEmCurso] = useState<string | null>(null);

  if (alertas.length === 0) {
    return <p className="card text-sm text-muted">{modo === "abertos" ? "Nenhum alerta aberto." : "Nenhum alerta resolvido nos últimos 7 dias."}</p>;
  }

  function agir(a: A) {
    setErro(null);
    setEmCurso(a.id);
    iniciar(async () => {
      const r = modo === "abertos" ? await resolverAlerta(a.id) : await reabrirAlerta(a.id);
      if (!r.ok) setErro(`${a.tipo}: ${r.erro}`);
      setEmCurso(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {erro && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{erro}</p>}
      <ul className="space-y-2">
        {alertas.map((a) => (
          <li
            key={a.id}
            className={`card flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${modo === "resolvidos" ? "opacity-80" : a.severidade === "critico" ? "border-danger/40" : ""}`}
          >
            <div>
              <p className="font-medium">
                {modo === "resolvidos" ? "✅" : a.severidade === "critico" ? "🔴" : "🟡"} {a.tipo} {a.job && <span className="text-muted">· {a.job}</span>}
              </p>
              <p className="text-muted">{a.mensagem} · {fmtDataHora(a.criadoEm)}</p>
              {modo === "resolvidos" && a.resolvidoEm && (
                <p className="text-xs text-muted">Resolvido por {a.resolvidoPor ?? "sistema (condição atendida)"} em {fmtDataHora(a.resolvidoEm)}</p>
              )}
            </div>
            <div className="flex gap-2">
              {a.jobId && <Link href={`/jobs/${a.jobId}`} className="btn-outline">Abrir job</Link>}
              <button className="btn-outline" disabled={pendente} onClick={() => agir(a)}>
                {emCurso === a.id ? "Salvando…" : modo === "abertos" ? "Resolver" : "Reabrir"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
