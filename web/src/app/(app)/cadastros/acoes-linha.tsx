"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { alternarAtivoCadastro, excluirCadastro } from "@/lib/actions/cadastros";

interface Props {
  tabela: "fast" | "cliente";
  id: string;
  nome: string;
  ativo: boolean;
  jobs: number;
  ehAdmin: boolean;
  hrefEditar: string;
}

/** Ações por linha nas listas de cadastros: editar (formulário ao lado), desativar/reativar e excluir (Admin, sem jobs). */
export function AcoesLinha({ tabela, id, nome, ativo, jobs, ehAdmin, hrefEditar }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await alternarAtivoCadastro(tabela, id, !ativo);
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }

  function excluir() {
    if (!confirm(`Excluir “${nome}” definitivamente? Esta ação não pode ser desfeita.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await excluirCadastro(tabela, id);
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Link href={hrefEditar} className="btn-outline min-h-8 px-2 text-xs">Editar</Link>
      <button type="button" className="btn-outline min-h-8 px-2 text-xs" disabled={pendente} onClick={alternar}>{ativo ? "Desativar" : "Reativar"}</button>
      {ehAdmin && jobs === 0 && (
        <button type="button" className="btn-outline min-h-8 px-2 text-xs text-danger" disabled={pendente} onClick={excluir}>Excluir</button>
      )}
      {erro && <p className="w-full text-right text-xs text-danger">{erro}</p>}
    </div>
  );
}
