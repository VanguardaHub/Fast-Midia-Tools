# ADR-0005 — Posição do Fast em tempo real durante a gravação (rastreio na janela do job)

**Status:** Aceito em 30/09/2026 — altera parcialmente a ADR-0003 (decisões 1 e 3). RIPD v1.0 elaborado e aprovado internamente pela gerência (`docs/lgpd/ripd-fast-midia-tools.md`); a empresa não possui DPO.
**Decisor:** gerência do projeto (Jussara Cavalcante), exercendo a decisão 1 da seção 14 do escopo. Registrado como mudança de escopo: o documento de escopo (seção 4.2) listava o rastreio contínuo como fora do escopo inicial e o RF-38 com prioridade C.

## Contexto

A supervisora precisa ver **onde o Fast está durante a gravação**, não apenas o ponto do check-in. A ADR-0003 limitava a coleta a eventos por toque (chegada, saída, corrida). A seção 8 do escopo estabelece o gatilho de revisão: qualquer ampliação exige decisão da diretoria e novo RIPD. Esta ADR registra a decisão e as salvaguardas adotadas para manter a coleta proporcional (LGPD, art. 6º, III — necessidade).

## Decisão

1. **Novo tipo de evento `posicao`** em `evento_localizacao`, aceito **somente entre a `chegada` e a `saida` do job**, dentro da janela do job e com consentimento do termo vigente (trigger `tg_evento_localizacao_validar`, erros `P0012`/`P0013`).
2. **Somente com o app aberto na tela do job** (`watchPosition` no componente `RastreioJanela`; nada é enviado com a aba oculta ou em segundo plano) e **com indicador visível e botão de pausa**. A pausa é respeitada no aparelho; o banco não distingue pausa de ausência de sinal.
3. **Frequência limitada no banco**: `rastreio_intervalo_s` (30 s). Posições mais frequentes são descartadas silenciosamente. No aparelho, `deveEnviarPosicao` ainda reduz o tráfego: leituras com precisão pior que 150 m não são enviadas e, parado, o Fast gera um "sinal de vida" a cada 4 intervalos.
4. **Retenção própria e menor**: `retencao_rastreio_dias` (7) contra 90 dias dos eventos por toque. Expurgo diário por `pg_cron`, registrado em `auditoria`.
5. **Sem efeitos colaterais**: posições não geram alerta, exceção nem espelho no Notion, não entram nas views analíticas e não alteram status do job. Apenas o `atualizado_em` do job é tocado para acionar o Realtime do mapa.
6. **Acesso inalterado**: gestão só lê posições pelas RPCs auditadas. Como o mapa agora recarrega a cada posição, a auditoria de `mapa_do_dia` passa a **agrupar consultas do mesmo usuário na mesma data em janelas de `auditoria_mapa_janela_min` (10 min)**; cada janela gera um registro `consulta_posicao`. `consultar_localizacoes_job` continua registrando toda consulta.
7. **Novo termo de ciência 2.0** (vigente), com aceite obrigatório antes de qualquer captura. O termo 1.0 permanece no histórico de consentimentos.
8. **Chave de desligamento**: `configuracao.rastreio_habilitado = false` desativa a captura no banco e oculta o componente no app, sem deploy.

## Revisão de 08/10/2026 — Mapa do dia como app de corrida (trilha ao vivo)

Pedido da gerência do projeto: acompanhar o trajeto do Fast em tempo real, como nos apps Uber/99. Não há coleta nova: o mapa passa a exibir a **trilha** (chegada → posições → saída) que a decisão 1 já captura, dentro da mesma janela, frequência e retenção. Implementação:

1. Nova RPC `trajeto_do_dia(p_data)` (migração 0016), só para gestão, auditada na **mesma janela** de `mapa_do_dia` e sob a mesma entidade, de modo que a transparência ao Fast ("quem consultou minha posição") continue íntegra e sem duplicar registros.
2. Componente `MapaAoVivo`: linha da trilha por Fast (cor do cadastro), marcador animado entre posições com seta de rumo e pulso quando "ao vivo", pino e geofence do cliente, cartões com situação (ao vivo / sem sinal / no local / saiu), distância ao cliente, chegada estimada e percorrido, modo "seguir" e "visão geral".
3. **Distância e ETA são calculadas em linha reta no próprio app** (`lib/rastreio.ts`), sem enviar posições a serviços de rotas externos (minimização; nenhum novo operador de dados). A estimativa é indicativa e vem rotulada com "~".
4. O Realtime continua o mesmo (toque em `job.atualizado_em` a cada posição); o cliente apenas anima a diferença entre duas cargas.

## Consequências

- O RF-38 passa de prioridade C para implementado; o RNF-04 (minimização) é preservado por janela, frequência, retenção e ausência de captura em segundo plano.
- **Pendências de governança**: revisão do RIPD e do inventário de dados pelo DPO; comunicação formal aos Fasts (o app exige novo aceite); política BYOD (decisão 4) ganha urgência, pois o rastreio consome bateria e dados do aparelho.
- **Limite técnico (risco R6)**: em iOS e Android o navegador interrompe `watchPosition` quando o PWA sai de primeiro plano; o mapa mostra "sem sinal há N min" após 3 intervalos. Rastreio com o app fechado exigiria app nativo, decisão fora desta ADR.
- **Pesquisa (DSR)**: o ciclo 2 do artefato passa a medir, além da presença por geofence, a cobertura do sinal durante a gravação (posições recebidas ÷ esperadas) e a percepção dos Fasts sobre proporcionalidade, registradas no protocolo de pesquisa.
