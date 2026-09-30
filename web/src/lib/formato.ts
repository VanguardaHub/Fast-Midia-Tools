import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/lib/database.types";

export type JobStatus = Database["public"]["Enums"]["job_status"];
export type Slot = Database["public"]["Enums"]["slot_tipo"];

export const STATUS_ROTULO: Record<JobStatus, string> = {
  aguardando_briefing: "Aguardando briefing",
  briefing_recebido: "Briefing recebido",
  em_gravacao: "Em gravação",
  material_entregue: "Material entregue",
  em_edicao: "Em edição",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const STATUS_ORDEM: JobStatus[] = [
  "aguardando_briefing", "briefing_recebido", "em_gravacao", "material_entregue", "em_edicao", "concluido", "cancelado",
];

export const STATUS_COR: Record<JobStatus, string> = {
  aguardando_briefing: "bg-warning/15 text-warning",
  briefing_recebido: "bg-info/15 text-info",
  em_gravacao: "bg-primary/15 text-primary",
  material_entregue: "bg-success/15 text-success",
  em_edicao: "bg-accent/15 text-accent",
  concluido: "bg-success/25 text-success",
  cancelado: "bg-muted/20 text-muted",
};

export const SLOT_ROTULO: Record<Slot, string> = { manha: "08:00 – 12:00", tarde: "13:00 – 17:00" };

export const ALERTA_ROTULO: Record<Database["public"]["Enums"]["alerta_tipo"], string> = {
  briefing_atrasado: "Briefing atrasado",
  checkin_atrasado: "Check-in atrasado",
  checkin_fora_geofence: "Check-in fora da geofence",
  checkin_baixa_precisao: "Check-in com baixa precisão",
  material_nao_entregue_24h: "Material não entregue em 24h",
  comprovante_faltando: "Comprovante 99 faltando",
  destino_divergente: "Destino da corrida divergente",
  excecao_pendente: "Exceção pendente",
};

export const EXCECAO_ROTULO: Record<Database["public"]["Enums"]["excecao_tipo"], string> = {
  buffer_2h: "Folga menor que 2h",
  agendamento_duplo: "Agendamento duplo",
  checkin_fora_geofence: "Check-in fora da geofence",
  checkin_baixa_precisao: "Check-in com baixa precisão",
  sem_briefing: "Sem briefing",
  troca_fast: "Troca de Fast",
  outro: "Outro",
};

export function fmtData(iso: string | null | undefined, padrao = "dd/MM/yyyy"): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? parseISO(iso) : new Date(iso);
  return format(d, padrao, { locale: ptBR });
}

export function fmtDataHora(iso: string | null | undefined): string {
  return fmtData(iso, "dd/MM HH:mm");
}

export function fmtHora(iso: string | null | undefined): string {
  return fmtData(iso, "HH:mm");
}

export function fmtMoeda(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function hojeISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Data ISO (yyyy-MM-dd) de N dias atrás — helper para evitar chamadas impuras no render. */
export function diasAtrasISO(n: number): string {
  return format(new Date(Date.now() - n * 864e5), "yyyy-MM-dd");
}
