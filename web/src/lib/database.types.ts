// Gerado a partir do projeto Supabase wcidhqxkoltwfrlairqj (migrações 0001–0006).
// Regenerar após cada migração: supabase gen types typescript --project-id wcidhqxkoltwfrlairqj
// O schema `analytics` foi adicionado manualmente (views com security_invoker).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  analytics: {
    Tables: { [_ in never]: never };
    Views: {
      vw_jobs: {
        Row: {
          id: string; codigo: number; data: string; slot: Database["public"]["Enums"]["slot_tipo"];
          inicio: string; fim: string; status: Database["public"]["Enums"]["job_status"]; precisa_99: boolean;
          prazo_material: string | null; data_edicao: string | null; bloco_edicao: Database["public"]["Enums"]["slot_tipo"] | null;
          raio_geofence_m: number; ponto_confirmado: boolean; duracao_real_min: number | null;
          material_entregue_em: string | null; cancelado_em: string | null; criado_em: string;
          cliente_id: string; cliente: string; cliente_grupo: string | null;
          fast_id: string; fast: string; fast_cor: string; analista: string | null;
          tem_briefing: boolean; briefing_em: string | null; briefing_antes_da_gravacao: boolean | null;
          checkin_em: string | null; checkin_dentro_geofence: boolean | null; checkin_precisao_m: number | null;
          checkout_em: string | null; atraso_checkin_min: number | null; qtd_excecoes: number; qtd_alertas_abertos: number;
        };
        Relationships: [];
      };
      vw_gasto_99: {
        Row: {
          data: string; fast_id: string; fast: string; job_id: string; codigo: number; cliente: string;
          valor_ida: number | null; valor_volta: number | null; valor_total: number;
          comprovante_ida: boolean | null; comprovante_volta: boolean | null; validada: boolean | null; divergencia_destino: boolean | null;
        };
        Relationships: [];
      };
      vw_gasto_99_por_fast_dia: {
        Row: { data: string; fast_id: string; fast: string; jobs_com_99: number; gasto_total: number | null; jobs_com_comprovantes: number };
        Relationships: [];
      };
    };
    Functions: {
      indicadores_okr: {
        Args: { p_inicio?: string; p_fim?: string };
        Returns: { indicador: string; objetivo: string; meta: string; valor: number | null; numerador: number | null; denominador: number | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
  public: {
    Tables: {
      alerta: {
        Row: { criado_em: string; id: string; job_id: string | null; mensagem: string; resolvido: boolean; resolvido_em: string | null; resolvido_por: string | null; severidade: string; tipo: Database["public"]["Enums"]["alerta_tipo"] };
        Insert: { criado_em?: string; id?: string; job_id?: string | null; mensagem: string; resolvido?: boolean; resolvido_em?: string | null; resolvido_por?: string | null; severidade?: string; tipo: Database["public"]["Enums"]["alerta_tipo"] };
        Update: { criado_em?: string; id?: string; job_id?: string | null; mensagem?: string; resolvido?: boolean; resolvido_em?: string | null; resolvido_por?: string | null; severidade?: string; tipo?: Database["public"]["Enums"]["alerta_tipo"] };
        Relationships: [
          { foreignKeyName: "alerta_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "job"; referencedColumns: ["id"] },
          { foreignKeyName: "alerta_resolvido_por_fkey"; columns: ["resolvido_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      auditoria: {
        Row: { acao: string; criado_em: string; dados: Json | null; entidade: string; entidade_id: string | null; id: number; usuario_email: string | null; usuario_id: string | null };
        Insert: { acao: string; criado_em?: string; dados?: Json | null; entidade: string; entidade_id?: string | null; id?: never; usuario_email?: string | null; usuario_id?: string | null };
        Update: { acao?: string; criado_em?: string; dados?: Json | null; entidade?: string; entidade_id?: string | null; id?: never; usuario_email?: string | null; usuario_id?: string | null };
        Relationships: [];
      };
      briefing: {
        Row: { atualizado_em: string; id: string; job_id: string; local: string; observacoes: string | null; precisa_99: boolean; preenchido_em: string; preenchido_por: string | null; referencia_visual_path: string | null; roteiro: string };
        Insert: { atualizado_em?: string; id?: string; job_id: string; local: string; observacoes?: string | null; precisa_99?: boolean; preenchido_em?: string; preenchido_por?: string | null; referencia_visual_path?: string | null; roteiro: string };
        Update: { atualizado_em?: string; id?: string; job_id?: string; local?: string; observacoes?: string | null; precisa_99?: boolean; preenchido_em?: string; preenchido_por?: string | null; referencia_visual_path?: string | null; roteiro?: string };
        Relationships: [
          { foreignKeyName: "briefing_job_id_fkey"; columns: ["job_id"]; isOneToOne: true; referencedRelation: "job"; referencedColumns: ["id"] },
          { foreignKeyName: "briefing_preenchido_por_fkey"; columns: ["preenchido_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      cliente: {
        Row: { ativo: boolean; atualizado_em: string; contato_nome: string | null; contato_whatsapp: string | null; criado_em: string; grupo: string | null; id: string; nome: string; pasta_drive_id: string | null; pasta_drive_url: string | null };
        Insert: { ativo?: boolean; atualizado_em?: string; contato_nome?: string | null; contato_whatsapp?: string | null; criado_em?: string; grupo?: string | null; id?: string; nome: string; pasta_drive_id?: string | null; pasta_drive_url?: string | null };
        Update: { ativo?: boolean; atualizado_em?: string; contato_nome?: string | null; contato_whatsapp?: string | null; criado_em?: string; grupo?: string | null; id?: string; nome?: string; pasta_drive_id?: string | null; pasta_drive_url?: string | null };
        Relationships: [];
      };
      configuracao: {
        Row: { atualizado_em: string; atualizado_por: string | null; chave: string; descricao: string | null; valor: Json };
        Insert: { atualizado_em?: string; atualizado_por?: string | null; chave: string; descricao?: string | null; valor: Json };
        Update: { atualizado_em?: string; atualizado_por?: string | null; chave?: string; descricao?: string | null; valor?: Json };
        Relationships: [];
      };
      consentimento: {
        Row: { aceito_em: string; id: string; user_agent: string | null; usuario_id: string; versao_termo: string };
        Insert: { aceito_em?: string; id?: string; user_agent?: string | null; usuario_id: string; versao_termo: string };
        Update: { aceito_em?: string; id?: string; user_agent?: string | null; usuario_id?: string; versao_termo?: string };
        Relationships: [
          { foreignKeyName: "consentimento_usuario_id_fkey"; columns: ["usuario_id"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
          { foreignKeyName: "consentimento_versao_termo_fkey"; columns: ["versao_termo"]; isOneToOne: false; referencedRelation: "termo_ciencia"; referencedColumns: ["versao"] },
        ];
      };
      convite: {
        Row: { criado_em: string; criado_por: string | null; email: string; nome: string | null; perfil: Database["public"]["Enums"]["perfil_tipo"]; usado_em: string | null };
        Insert: { criado_em?: string; criado_por?: string | null; email: string; nome?: string | null; perfil?: Database["public"]["Enums"]["perfil_tipo"]; usado_em?: string | null };
        Update: { criado_em?: string; criado_por?: string | null; email?: string; nome?: string | null; perfil?: Database["public"]["Enums"]["perfil_tipo"]; usado_em?: string | null };
        Relationships: [
          { foreignKeyName: "convite_criado_por_fkey"; columns: ["criado_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      corrida_99: {
        Row: { atualizado_em: string; comprovante_path: string | null; criado_em: string; destino: string | null; destino_ponto: unknown; divergencia_destino: boolean | null; id: string; job_id: string; origem: string | null; registrado_por: string | null; sentido: Database["public"]["Enums"]["sentido_corrida"]; validada: boolean; validada_em: string | null; validada_por: string | null; valor: number | null };
        Insert: { atualizado_em?: string; comprovante_path?: string | null; criado_em?: string; destino?: string | null; destino_ponto?: unknown; divergencia_destino?: boolean | null; id?: string; job_id: string; origem?: string | null; registrado_por?: string | null; sentido: Database["public"]["Enums"]["sentido_corrida"]; validada?: boolean; validada_em?: string | null; validada_por?: string | null; valor?: number | null };
        Update: { atualizado_em?: string; comprovante_path?: string | null; criado_em?: string; destino?: string | null; destino_ponto?: unknown; divergencia_destino?: boolean | null; id?: string; job_id?: string; origem?: string | null; registrado_por?: string | null; sentido?: Database["public"]["Enums"]["sentido_corrida"]; validada?: boolean; validada_em?: string | null; validada_por?: string | null; valor?: number | null };
        Relationships: [
          { foreignKeyName: "corrida_99_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "job"; referencedColumns: ["id"] },
          { foreignKeyName: "corrida_99_registrado_por_fkey"; columns: ["registrado_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
          { foreignKeyName: "corrida_99_validada_por_fkey"; columns: ["validada_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      evento_localizacao: {
        Row: { capturado_em: string; chave_idempotencia: string | null; criado_em: string; dentro_geofence: boolean | null; distancia_m: number | null; fast_id: string; id: string; job_id: string; justificativa: string | null; origem_offline: boolean; ponto: unknown; precisao_m: number; tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] };
        Insert: { capturado_em: string; chave_idempotencia?: string | null; criado_em?: string; dentro_geofence?: boolean | null; distancia_m?: number | null; fast_id: string; id?: string; job_id: string; justificativa?: string | null; origem_offline?: boolean; ponto: unknown; precisao_m: number; tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] };
        Update: { capturado_em?: string; chave_idempotencia?: string | null; criado_em?: string; dentro_geofence?: boolean | null; distancia_m?: number | null; fast_id?: string; id?: string; job_id?: string; justificativa?: string | null; origem_offline?: boolean; ponto?: unknown; precisao_m?: number; tipo?: Database["public"]["Enums"]["evento_localizacao_tipo"] };
        Relationships: [
          { foreignKeyName: "evento_localizacao_fast_id_fkey"; columns: ["fast_id"]; isOneToOne: false; referencedRelation: "fast"; referencedColumns: ["id"] },
          { foreignKeyName: "evento_localizacao_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "job"; referencedColumns: ["id"] },
        ];
      };
      excecao: {
        Row: { aprovada: boolean | null; criado_em: string; decidida_em: string | null; decidida_por: string | null; id: string; job_id: string; motivo: string; parecer: string | null; solicitada_por: string | null; tipo: Database["public"]["Enums"]["excecao_tipo"] };
        Insert: { aprovada?: boolean | null; criado_em?: string; decidida_em?: string | null; decidida_por?: string | null; id?: string; job_id: string; motivo: string; parecer?: string | null; solicitada_por?: string | null; tipo: Database["public"]["Enums"]["excecao_tipo"] };
        Update: { aprovada?: boolean | null; criado_em?: string; decidida_em?: string | null; decidida_por?: string | null; id?: string; job_id?: string; motivo?: string; parecer?: string | null; solicitada_por?: string | null; tipo?: Database["public"]["Enums"]["excecao_tipo"] };
        Relationships: [
          { foreignKeyName: "excecao_decidida_por_fkey"; columns: ["decidida_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
          { foreignKeyName: "excecao_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "job"; referencedColumns: ["id"] },
          { foreignKeyName: "excecao_solicitada_por_fkey"; columns: ["solicitada_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      fast: {
        Row: { ativo: boolean; atualizado_em: string; cor: string; criado_em: string; email_calendario: string; id: string; nome: string; nome_notion: string | null; perfil_id: string | null; telefone: string | null };
        Insert: { ativo?: boolean; atualizado_em?: string; cor?: string; criado_em?: string; email_calendario: string; id?: string; nome: string; nome_notion?: string | null; perfil_id?: string | null; telefone?: string | null };
        Update: { ativo?: boolean; atualizado_em?: string; cor?: string; criado_em?: string; email_calendario?: string; id?: string; nome?: string; nome_notion?: string | null; perfil_id?: string | null; telefone?: string | null };
        Relationships: [
          { foreignKeyName: "fast_perfil_id_fkey"; columns: ["perfil_id"]; isOneToOne: true; referencedRelation: "perfil"; referencedColumns: ["id"] },
        ];
      };
      fila_integracao: {
        Row: { atualizado_em: string; chave_idempotencia: string; criado_em: string; id: number; max_tentativas: number; payload: Json; proximo_em: string; resultado: Json | null; status: Database["public"]["Enums"]["integracao_status"]; tentativas: number; tipo: Database["public"]["Enums"]["integracao_tipo"]; ultimo_erro: string | null };
        Insert: { atualizado_em?: string; chave_idempotencia: string; criado_em?: string; id?: never; max_tentativas?: number; payload: Json; proximo_em?: string; resultado?: Json | null; status?: Database["public"]["Enums"]["integracao_status"]; tentativas?: number; tipo: Database["public"]["Enums"]["integracao_tipo"]; ultimo_erro?: string | null };
        Update: { atualizado_em?: string; chave_idempotencia?: string; criado_em?: string; id?: never; max_tentativas?: number; payload?: Json; proximo_em?: string; resultado?: Json | null; status?: Database["public"]["Enums"]["integracao_status"]; tentativas?: number; tipo?: Database["public"]["Enums"]["integracao_tipo"]; ultimo_erro?: string | null };
        Relationships: [];
      };
      job: {
        Row: { analista_id: string | null; analista_whatsapp: string | null; atualizado_em: string; bloco_edicao: Database["public"]["Enums"]["slot_tipo"] | null; calendar_event_edicao_id: string | null; calendar_event_id: string | null; cancelado_em: string | null; cliente_id: string; codigo: number; criado_em: string; criado_por: string | null; data: string; data_edicao: string | null; duracao_real_min: number | null; endereco: string | null; excecao_motivo: string | null; fast_id: string; fim: string; id: string; inicio: string; material_entregue_em: string | null; motivo_cancelamento: string | null; notion_page_id: string | null; observacoes: string | null; pasta_ingest_url: string | null; ponto: unknown; ponto_confirmado: boolean; prazo_material: string | null; precisa_99: boolean; raio_geofence_m: number; slot: Database["public"]["Enums"]["slot_tipo"]; status: Database["public"]["Enums"]["job_status"] };
        Insert: { analista_id?: string | null; analista_whatsapp?: string | null; atualizado_em?: string; bloco_edicao?: Database["public"]["Enums"]["slot_tipo"] | null; calendar_event_edicao_id?: string | null; calendar_event_id?: string | null; cancelado_em?: string | null; cliente_id: string; codigo?: never; criado_em?: string; criado_por?: string | null; data: string; data_edicao?: string | null; duracao_real_min?: number | null; endereco?: string | null; excecao_motivo?: string | null; fast_id: string; fim?: string; id?: string; inicio?: string; material_entregue_em?: string | null; motivo_cancelamento?: string | null; notion_page_id?: string | null; observacoes?: string | null; pasta_ingest_url?: string | null; ponto?: unknown; ponto_confirmado?: boolean; prazo_material?: string | null; precisa_99?: boolean; raio_geofence_m?: number; slot: Database["public"]["Enums"]["slot_tipo"]; status?: Database["public"]["Enums"]["job_status"] };
        Update: { analista_id?: string | null; analista_whatsapp?: string | null; atualizado_em?: string; bloco_edicao?: Database["public"]["Enums"]["slot_tipo"] | null; calendar_event_edicao_id?: string | null; calendar_event_id?: string | null; cancelado_em?: string | null; cliente_id?: string; codigo?: never; criado_em?: string; criado_por?: string | null; data?: string; data_edicao?: string | null; duracao_real_min?: number | null; endereco?: string | null; excecao_motivo?: string | null; fast_id?: string; fim?: string; id?: string; inicio?: string; material_entregue_em?: string | null; motivo_cancelamento?: string | null; notion_page_id?: string | null; observacoes?: string | null; pasta_ingest_url?: string | null; ponto?: unknown; ponto_confirmado?: boolean; prazo_material?: string | null; precisa_99?: boolean; raio_geofence_m?: number; slot?: Database["public"]["Enums"]["slot_tipo"]; status?: Database["public"]["Enums"]["job_status"] };
        Relationships: [
          { foreignKeyName: "job_analista_id_fkey"; columns: ["analista_id"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
          { foreignKeyName: "job_cliente_id_fkey"; columns: ["cliente_id"]; isOneToOne: false; referencedRelation: "cliente"; referencedColumns: ["id"] },
          { foreignKeyName: "job_criado_por_fkey"; columns: ["criado_por"]; isOneToOne: false; referencedRelation: "perfil"; referencedColumns: ["id"] },
          { foreignKeyName: "job_fast_id_fkey"; columns: ["fast_id"]; isOneToOne: false; referencedRelation: "fast"; referencedColumns: ["id"] },
        ];
      };
      perfil: {
        Row: { ativo: boolean; atualizado_em: string; criado_em: string; email: string; id: string; nome: string; perfil: Database["public"]["Enums"]["perfil_tipo"]; telefone: string | null };
        Insert: { ativo?: boolean; atualizado_em?: string; criado_em?: string; email: string; id: string; nome: string; perfil?: Database["public"]["Enums"]["perfil_tipo"]; telefone?: string | null };
        Update: { ativo?: boolean; atualizado_em?: string; criado_em?: string; email?: string; id?: string; nome?: string; perfil?: Database["public"]["Enums"]["perfil_tipo"]; telefone?: string | null };
        Relationships: [];
      };
      termo_ciencia: {
        Row: { conteudo: string; publicado_em: string; titulo: string; versao: string; vigente: boolean };
        Insert: { conteudo: string; publicado_em?: string; titulo: string; versao: string; vigente?: boolean };
        Update: { conteudo?: string; publicado_em?: string; titulo?: string; versao?: string; vigente?: boolean };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      aceitar_termo: { Args: { p_user_agent?: string; p_versao: string }; Returns: undefined };
      auth_fast_id: { Args: never; Returns: string };
      auth_perfil: { Args: never; Returns: Database["public"]["Enums"]["perfil_tipo"] };
      cancelar_job: { Args: { p_job_id: string; p_motivo: string }; Returns: undefined };
      cfg_int: { Args: { p_chave: string }; Returns: number };
      cfg_json: { Args: { p_chave: string }; Returns: Json };
      cfg_text: { Args: { p_chave: string }; Returns: string };
      consultar_localizacoes_job: {
        Args: { p_job_id: string };
        Returns: { capturado_em: string; dentro_geofence: boolean; distancia_m: number; id: string; justificativa: string; lat: number; lng: number; origem_offline: boolean; precisao_m: number; tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] }[];
      };
      decidir_excecao: { Args: { p_aprovada: boolean; p_excecao_id: string; p_parecer?: string }; Returns: undefined };
      definir_ponto_job: { Args: { p_confirmado?: boolean; p_job_id: string; p_lat: number; p_lng: number; p_raio_m?: number }; Returns: undefined };
      eh_admin: { Args: never; Returns: boolean };
      eh_gestao: { Args: never; Returns: boolean };
      eh_sistema: { Args: never; Returns: boolean };
      enfileirar_integracao: { Args: { p_chave: string; p_payload: Json; p_tipo: Database["public"]["Enums"]["integracao_tipo"] }; Returns: undefined };
      expurgar_eventos_localizacao: { Args: never; Returns: number };
      gerar_alertas_periodicos: { Args: never; Returns: number };
      job_coordenadas: { Args: { p_job_id: string }; Returns: { lat: number; lng: number; ponto_confirmado: boolean; raio_geofence_m: number }[] };
      job_intervalo: { Args: { p_data: string; p_slot: Database["public"]["Enums"]["slot_tipo"] }; Returns: unknown };
      mapa_do_dia: {
        Args: { p_data?: string };
        Returns: { capturado_em: string; cliente: string; codigo: number; cor: string; dentro_geofence: boolean; fast_id: string; fast_nome: string; job_id: string; job_lat: number; job_lng: number; lat: number; lng: number; precisao_m: number; raio_geofence_m: number; status: Database["public"]["Enums"]["job_status"]; tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] }[];
      };
      marcar_material_entregue: { Args: { p_job_id: string }; Returns: undefined };
      pode_ver_job: { Args: { p_job_id: string }; Returns: boolean };
      registrar_evento_localizacao: {
        Args: { p_capturado_em?: string; p_chave?: string; p_job_id: string; p_justificativa?: string; p_lat: number; p_lng: number; p_offline?: boolean; p_precisao_m: number; p_tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] };
        Returns: { capturado_em: string; chave_idempotencia: string | null; criado_em: string; dentro_geofence: boolean | null; distancia_m: number | null; fast_id: string; id: string; job_id: string; justificativa: string | null; origem_offline: boolean; ponto: unknown; precisao_m: number; tipo: Database["public"]["Enums"]["evento_localizacao_tipo"] };
        SetofOptions: { from: "*"; to: "evento_localizacao"; isOneToOne: true; isSetofReturn: false };
      };
    };
    Enums: {
      alerta_tipo: "briefing_atrasado" | "checkin_atrasado" | "checkin_fora_geofence" | "checkin_baixa_precisao" | "material_nao_entregue_24h" | "comprovante_faltando" | "destino_divergente" | "excecao_pendente";
      evento_localizacao_tipo: "chegada" | "saida" | "corrida" | "posicao";
      excecao_tipo: "buffer_2h" | "agendamento_duplo" | "checkin_fora_geofence" | "checkin_baixa_precisao" | "sem_briefing" | "troca_fast" | "outro";
      integracao_status: "pendente" | "processando" | "ok" | "erro" | "descartado";
      integracao_tipo: "notion_upsert" | "calendar_upsert" | "calendar_delete" | "whatsapp_send" | "email_send" | "push_send" | "drive_verificar";
      job_status: "aguardando_briefing" | "briefing_recebido" | "em_gravacao" | "material_entregue" | "em_edicao" | "concluido" | "cancelado";
      perfil_tipo: "fast" | "analista" | "supervisora" | "admin";
      sentido_corrida: "ida" | "volta";
      slot_tipo: "manha" | "tarde";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      alerta_tipo: ["briefing_atrasado", "checkin_atrasado", "checkin_fora_geofence", "checkin_baixa_precisao", "material_nao_entregue_24h", "comprovante_faltando", "destino_divergente", "excecao_pendente"],
      evento_localizacao_tipo: ["chegada", "saida", "corrida", "posicao"],
      excecao_tipo: ["buffer_2h", "agendamento_duplo", "checkin_fora_geofence", "checkin_baixa_precisao", "sem_briefing", "troca_fast", "outro"],
      integracao_status: ["pendente", "processando", "ok", "erro", "descartado"],
      integracao_tipo: ["notion_upsert", "calendar_upsert", "calendar_delete", "whatsapp_send", "email_send", "push_send", "drive_verificar"],
      job_status: ["aguardando_briefing", "briefing_recebido", "em_gravacao", "material_entregue", "em_edicao", "concluido", "cancelado"],
      perfil_tipo: ["fast", "analista", "supervisora", "admin"],
      sentido_corrida: ["ida", "volta"],
      slot_tipo: ["manha", "tarde"],
    },
  },
} as const;
