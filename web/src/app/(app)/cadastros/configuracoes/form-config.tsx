"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarConfiguracao } from "@/lib/actions/cadastros";

export function FormConfig({ itens }: { itens: { chave: string; valor: string; descricao: string }[] }) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>(Object.fromEntries(itens.map((i) => [i.chave, i.valor])));
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(chave: string) {
    setMsg(null);
    let v: unknown;
    try { v = JSON.parse(valores[chave]); } catch { setMsg(`Valor inválido para ${chave} (use JSON: número, "texto" ou lista).`); return; }
    iniciar(async () => {
      const r = await salvarConfiguracao(chave, v);
      setMsg(r.ok ? `${chave} atualizado.` : r.erro);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {msg && <p className="rounded-xl bg-info/10 p-3 text-sm">{msg}</p>}
      {itens.map((i) => (
        <div key={i.chave} className="card grid gap-2 md:grid-cols-[1fr_2fr_auto] md:items-center">
          <div>
            <p className="font-mono text-sm">{i.chave}</p>
            <p className="text-xs text-muted">{i.descricao}</p>
          </div>
          <input className="input font-mono text-sm" value={valores[i.chave]} onChange={(e) => setValores({ ...valores, [i.chave]: e.target.value })} />
          <button className="btn-outline" disabled={pendente || valores[i.chave] === i.valor} onClick={() => salvar(i.chave)}>Salvar</button>
        </div>
      ))}
    </div>
  );
}
