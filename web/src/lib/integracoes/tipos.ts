import type { Database } from "@/lib/database.types";

export type ItemFila = Database["public"]["Tables"]["fila_integracao"]["Row"];

export interface JobCompleto {
  id: string;
  codigo: number;
  data: string;
  slot: "manha" | "tarde";
  inicio: string;
  fim: string;
  status: Database["public"]["Enums"]["job_status"];
  precisa_99: boolean;
  prazo_material: string | null;
  data_edicao: string | null;
  bloco_edicao: "manha" | "tarde" | null;
  observacoes: string | null;
  pasta_ingest_url: string | null;
  notion_page_id: string | null;
  calendar_event_id: string | null;
  calendar_event_edicao_id: string | null;
  analista_whatsapp: string | null;
  endereco: string | null;
  cliente: { nome: string; pasta_drive_id: string | null; grupo: string | null } | null;
  fast: { nome: string; email_calendario: string; telefone: string | null; nome_notion: string | null } | null;
  briefing: { local: string; roteiro: string; observacoes: string | null; precisa_99: boolean } | null;
}

export type ResultadoIntegracao =
  | { ok: true; resultado?: Record<string, unknown>; patchJob?: Record<string, string | null> }
  | { ok: false; erro: string; descartar?: boolean };

export interface Contexto {
  job: JobCompleto;
  urlApp: string;
}
