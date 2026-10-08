import type { Contexto, ResultadoIntegracao } from "./tipos";
import { googleCalendarConfigurado, obterToken } from "./google-calendar";
import { caminhosParaData, estruturaConfigurada } from "./drive-estrutura";

/**
 * RF-16 / Processos 1.3 — pasta de ingest no Drive do cliente pela API oficial (Drive v3), com a mesma
 * conta de serviço do Calendar (ADR-0006, adendo Drive). Substitui o `drive_verificar` do Apps Script
 * quando GOOGLE_SERVICE_ACCOUNT_JSON existe; o Apps Script permanece como alternativa.
 *
 * Acesso: em Drives compartilhados do Workspace, impersonar um usuário com acesso (GOOGLE_DRIVE_IMPERSONAR,
 * delegação em todo o domínio com escopo drive); sem delegação, compartilhar a pasta do cliente com o
 * e-mail da conta de serviço como Editor.
 *
 * Idempotente: procura cada subpasta pelo nome dentro da pasta-mãe e só cria o que falta.
 */

const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive";
const API = "https://www.googleapis.com/drive/v3";
const PASTA = "application/vnd.google-apps.folder";

export function googleDriveConfigurado(): boolean {
  return googleCalendarConfigurado();
}

async function gapi<T>(token: string, caminho: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const sep = caminho.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${caminho}${sep}supportsAllDrives=true`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const texto = await r.text();
  let body: T = {} as T;
  try { body = texto ? (JSON.parse(texto) as T) : ({} as T); } catch { /* corpo vazio */ }
  return { status: r.status, body };
}

interface Arquivo { id: string; name: string }
type RespostaErro = { error?: { message?: string; code?: number } };

async function tokenDrive(): Promise<string> {
  const sub = process.env.GOOGLE_DRIVE_IMPERSONAR?.trim() || undefined;
  return obterToken(sub, ESCOPO_DRIVE);
}

async function obterPasta(token: string, id: string): Promise<Arquivo> {
  const r = await gapi<Arquivo & RespostaErro>(token, `/files/${encodeURIComponent(id)}?fields=id,name,mimeType`);
  if (r.status === 404) throw new Error(`Pasta do cliente não encontrada no Drive (id ${id}). Confira o campo "ID da pasta no Drive" do cliente.`);
  if (r.status === 403) throw new Error(`Sem permissão na pasta do cliente (id ${id}). Compartilhe a pasta com a conta de serviço como Editor ou configure GOOGLE_DRIVE_IMPERSONAR.`);
  if (r.status >= 300) throw new Error(`Drive GET ${r.status}: ${r.body.error?.message ?? ""}`);
  return { id: r.body.id, name: r.body.name };
}

async function garantirSubpasta(token: string, paiId: string, nome: string): Promise<Arquivo> {
  const q = `'${paiId}' in parents and name = '${nome.replace(/'/g, "\\'")}' and mimeType = '${PASTA}' and trashed = false`;
  const busca = await gapi<{ files?: Arquivo[] } & RespostaErro>(token, `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5&includeItemsFromAllDrives=true`);
  if (busca.status >= 300) throw new Error(`Drive LIST ${busca.status}: ${busca.body.error?.message ?? ""}`);
  const existente = busca.body.files?.[0];
  if (existente) return existente;
  const criada = await gapi<Arquivo & RespostaErro>(token, `/files?fields=id,name`, { method: "POST", body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [paiId] }) });
  if (criada.status >= 300 || !criada.body.id) throw new Error(`Drive CREATE "${nome}" ${criada.status}: ${criada.body.error?.message ?? ""}`);
  return { id: criada.body.id, name: criada.body.name };
}

async function garantirCaminho(token: string, raizId: string, segmentos: string[]): Promise<Arquivo> {
  let atual: Arquivo = { id: raizId, name: "" };
  for (const s of segmentos) atual = await garantirSubpasta(token, atual.id, s);
  return atual;
}

export function urlPasta(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/** Cria (se faltar) a estrutura da data do job e devolve a URL da pasta de ingest (BANCO DE IMAGENS/MM NOME/DD-MM). */
export async function driveVerificar(ctx: Contexto): Promise<ResultadoIntegracao> {
  const j = ctx.job;
  const raiz = j.cliente?.pasta_drive_id?.trim();
  if (!raiz) {
    // sem ID não há ponto de partida (o Drive não é pesquisado por nome): descartar e orientar o cadastro
    return { ok: false, erro: `Cliente "${j.cliente?.nome ?? ""}" sem "ID da pasta no Drive" cadastrado. Cadastre em Cadastros → Clientes e reprocesse.`, descartar: true };
  }
  const token = await tokenDrive();
  const pastaCliente = await obterPasta(token, raiz);
  const { ingest, extras } = caminhosParaData(j.data, estruturaConfigurada(process.env.DRIVE_ESTRUTURA));
  const pastaIngest = await garantirCaminho(token, raiz, ingest);
  const extrasIds: string[] = [];
  for (const e of extras) extrasIds.push((await garantirCaminho(token, raiz, e)).id);
  const url = urlPasta(pastaIngest.id);
  return {
    ok: true,
    resultado: { cliente_pasta: pastaCliente.name, caminho: ingest.join("/"), pasta_ingest_id: pastaIngest.id, pasta_ingest_url: url, extras: extrasIds },
    patchJob: { pasta_ingest_url: url },
  };
}
