"use client";

import { useId } from "react";

/** Seletor de arquivo com alvo de toque grande (RNF-09). Abre câmera ou galeria no celular. */
export function SeletorArquivo({ arquivo, onChange, rotulo = "📷 Tirar foto ou escolher arquivo", accept = "image/*,application/pdf" }: {
  arquivo: File | null;
  onChange: (f: File | null) => void;
  rotulo?: string;
  accept?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="btn-outline w-full cursor-pointer">{arquivo ? "Trocar arquivo" : rotulo}</label>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {arquivo ? (
        <p className="truncate text-xs text-success">Selecionado: {arquivo.name} ({Math.round(arquivo.size / 1024)} KB)</p>
      ) : (
        <p className="text-xs text-muted">Imagem ou PDF, até 10 MB.</p>
      )}
    </div>
  );
}
