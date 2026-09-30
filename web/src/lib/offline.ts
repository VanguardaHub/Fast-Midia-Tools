"use client";

import { get, set } from "idb-keyval";

/**
 * RF-37 — fila offline de eventos de localização.
 * Cada evento tem uma chave idempotente (UUID gerado no dispositivo); o banco
 * ignora reenvios (registrar_evento_localizacao consulta chave_idempotencia).
 */
export interface EventoPendente {
  chave: string;
  jobId: string;
  tipo: "chegada" | "saida" | "corrida";
  lat: number;
  lng: number;
  precisaoM: number;
  capturadoEm: string; // ISO
  justificativa?: string;
}

const CHAVE_FILA = "fmt:fila-eventos";

export async function listarPendentes(): Promise<EventoPendente[]> {
  try {
    return (await get<EventoPendente[]>(CHAVE_FILA)) ?? [];
  } catch {
    return [];
  }
}

export async function enfileirar(ev: EventoPendente): Promise<void> {
  const atual = await listarPendentes();
  if (atual.some((e) => e.chave === ev.chave)) return;
  await set(CHAVE_FILA, [...atual, ev]);
}

export async function remover(chave: string): Promise<void> {
  const atual = await listarPendentes();
  await set(CHAVE_FILA, atual.filter((e) => e.chave !== chave));
}

export function gerarChave(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
