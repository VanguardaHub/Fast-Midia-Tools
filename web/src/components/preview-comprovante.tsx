"use client";

import { useEffect, useState } from "react";
import { criarClienteBrowser } from "@/lib/supabase/client";

interface Props {
  bucket?: string;
  path: string;
  /** altura máxima da miniatura */
  altura?: string;
  rotulo?: string;
}

/**
 * RF-41 / RF-44 — visualização do comprovante anexado (imagem em miniatura ou PDF embutido),
 * por URL assinada de curta duração do bucket privado. Quem pode ver é decidido pela RLS do Storage.
 */
export function PreviewComprovante({ bucket = "comprovantes-99", path, altura = "220px", rotulo = "Comprovante" }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const ehPdf = /\.pdf$/i.test(path);
  const nome = path.split("/").pop() ?? path;

  useEffect(() => {
    let ativo = true;
    const supabase = criarClienteBrowser();
    supabase.storage.from(bucket).createSignedUrl(path, 600).then(({ data, error }) => {
      if (!ativo) return;
      if (error || !data?.signedUrl) setErro("Não foi possível carregar o comprovante.");
      else setUrl(data.signedUrl);
    });
    return () => { ativo = false; };
  }, [bucket, path]);

  if (erro) return <p className="text-xs text-danger">{erro}</p>;
  if (!url) return <div className="animate-pulse rounded-xl bg-border/40" style={{ height: altura }} aria-label="Carregando comprovante" />;

  return (
    <figure className="space-y-1">
      {ehPdf ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <iframe src={`${url}#toolbar=0&view=FitH`} title={rotulo} className="w-full" style={{ height: altura }} />
        </div>
      ) : (
        <button type="button" className="block w-full overflow-hidden rounded-xl border border-border bg-black/5" onClick={() => setAberto(true)} title="Ampliar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={rotulo} className="mx-auto object-contain" style={{ maxHeight: altura }} />
        </button>
      )}
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{rotulo} · {nome}</span>
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-primary underline">Abrir em nova aba</a>
      </figcaption>
      {aberto && !ehPdf && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" onClick={() => setAberto(false)} role="dialog" aria-label={rotulo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={rotulo} className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-card px-3 py-1 text-sm" onClick={() => setAberto(false)}>Fechar ✕</button>
        </div>
      )}
    </figure>
  );
}
