# Evidência — Smoke test das regras de negócio (30/09/2026)

Executado no projeto Supabase `wcidhqxkoltwfrlairqj` em uma única transação encerrada com `rollback` (nenhum dado persistiu). Cada bloco `DO` lança `FALHA` se a regra não disparar; a transação chegou ao fim, logo todas as regras dispararam.

| Passo | Regra | Resultado |
|---|---|---|
| Signup `teste.supervisora@vanguardamartech.com.br` | Domínio permitido; primeiro usuário vira `admin` | ✅ perfil `admin` criado |
| Signup `fast.teste@gmail.com` | Fora do domínio, mas cadastrado em `fast` | ✅ perfil `fast` criado e vinculado ao cadastro |
| Signup `intruso@outro.com` | Sem domínio/convite | ✅ recusado (P0001) |
| Job manhã + job tarde mesmo dia, sem motivo | RF-13 | ✅ recusado (P0002) |
| Job tarde com `excecao_motivo` pela supervisora | RF-13 | ✅ aceito; exceções `agendamento_duplo` e `buffer_2h` aprovadas |
| Check-in sem termo aceito | Seção 8 | ✅ recusado (P0005) |
| Check-in sem briefing | RF-21 | ✅ recusado (P0007) |
| Check-in fora da geofence sem justificativa | RF-34 | ✅ recusado (P0011) |
| Check-in dentro da geofence (12 m de precisão) | RF-31 | ✅ `dentro_geofence = true`, status → `em_gravacao` |
| Reenvio com a mesma chave | RF-37 | ✅ idempotente (mesmo id) |
| Check-out 95 min depois | RF-32 | ✅ `duracao_real_min = 90` |
| Marcar material entregue (RPC) | Processos 1.3 | ✅ status → `material_entregue` |
| Concluir sem comprovantes de 99 | RF-42 | ✅ recusado (P0004) |
| Concluir com ida e volta anexadas | RF-42 | ✅ status → `concluido` |
| `mapa_do_dia` como supervisora | RNF-04 | ✅ linha em `auditoria` (`consulta_posicao`) |
| Fila de integração | RNF-08 | ✅ itens `notion_upsert`, `drive_verificar`, `calendar_upsert`, `whatsapp_send`, `email_send` enfileirados por chave |
| `analytics.indicadores_okr` | Seção 3.2 | ✅ briefing antes da gravação 100%; geofence 100%; atraso médio 5 min; duração 90 min; corridas validadas 0% (não validadas pela supervisora no teste) |

Advisors de segurança após a migração 0006: nenhum alerta crítico. Restam apenas avisos intencionais (fila sem política para usuários; RPCs `SECURITY DEFINER` com verificação interna), documentados em `0006_ajustes_advisors.sql`.
