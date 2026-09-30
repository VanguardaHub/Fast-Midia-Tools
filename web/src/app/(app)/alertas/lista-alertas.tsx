"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolverAlerta } from "@/lib/actions/jobs";
import { fmtDataHora } from "@/lib/formato";

interface A { id: string; jobId: string | null; tipo: string; severidade: string; mensagem: string; criadoEm: string; job: string }

export function ListaAlertas({ alertas }: { alertas: A[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  if (alertas.length === 0) return <p className="card text-sm text-muted">Nenhum alerta aberto.</p>;
  return (
    <ul className="space-y-2">
      {alertas.map((a) => (
        <li key={a.id} className={`card flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${a.severidade === "critico" ? "border-danger/40" : ""}`}>
          <div>
            <p className="font-medium">{a.severidade === "critico" ? "🔴" : "🟡"} {a.tipo} {a.job && <span className="text-muted">· {a.job}</span>}</p>
            <p className="text-muted">{a.mensagem} · {fmtDataHora(a.criadoEm)}</p>
          </div>
          <div className="flex gap-2">
            {a.jobId && <Link href={`/jobs/${a.jobId}`} className="btn-outline">Abrir job</Link>}
            <button className="btn-outline" disabled={pendente} onClick={() => iniciar(async () => { await resolverAlerta(a.id); router.refresh(); })}>Resolver</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
