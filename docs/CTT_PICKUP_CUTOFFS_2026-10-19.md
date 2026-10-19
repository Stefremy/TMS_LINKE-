# Avisos de hora-limite nas recolhas

Fonte importada: `docs/Horas+de+Corte_Recolhas_Pedido.pdf`, 13 páginas, 506 prefixos postais distintos. SHA-256: `4cfc3093f8c108fed7a5724349074dbf86477460651e73aa30d7e7f224ed7c47`.

O formulário CTT usa a janela 09h–19h. Foi importada a última coluna do PDF, **Recolhas até às 19h no próprio dia**: 294 prefixos com limite às 16h e 212 com limite às 13h. Não confundir com as colunas das janelas horárias específicas. A nota final do PDF exclui a Oferta Próprio Dia (serviço de entrega), não os pedidos de recolha para hoje.

Para origem PT e destino ES/RM, aplica-se o limite das 12h publicado na tabela oficial de canal/webservices, consultada em 19/10/2026: https://www.ctt.pt/application/themes/pdfs/horas%20de%20corte%20pedido%20de%20recolha%20por%20canal%2027mar.pdf . A cópia local `docs/HORAS+DE+CORTE+Pedido+de+Recolha+por+Canal+27mar.pdf` confirma a regra. Esta regra vem desse segundo documento e não da coluna por CP.

O aviso junto ao botão de agendamento atualiza a cada 30 segundos e quando mudam os campos. Usa o relógio do dispositivo convertido para Europe/Lisbon ou Atlantic/Azores conforme a origem. Mostra o prazo, avisa nos últimos 30 minutos e considera o limite atingido a partir do minuto indicado. Datas futuras não recebem o aviso de prazo ultrapassado de hoje. Códigos ausentes e origens estrangeiras ficam por confirmar, sem assumir um limite genérico nem ausência de cobertura.

Estes avisos são informativos: não bloqueiam pedidos, não criam agendamentos e não substituem disponibilidade, dias de serviço, exceções contratuais ou confirmação dos CTT.

A regra é identificada no aviso: **Portugal → Espanha** e **Portugal → Internacional** usam a tabela por canal; **Portugal → Portugal** usa o CP. A referência internacional das 12h pode ser mostrada para um CP de formato válido mesmo quando o prefixo não consta da tabela nacional, sem confirmar cobertura.

Para **Espanha → Portugal**, mostra-se a referência das 10h; para outras origens internacionais com destino Portugal, pedido em **D-1**, via EMS Internacional Inbound. Estas referências de origem estrangeira ficam por confirmar, sem contagem automática: o documento não especifica o fuso horário e não fornece uma hora exata na coluna INT-PT. Não são ativados novos países de origem no formulário.

Para regenerar a tabela: `python3 scripts/import-ctt-pickup-cutoffs.py` (requer `pypdf`). O importador recusa linhas por interpretar, duplicados e alterações inesperadas de contagem/horários. O resultado é `lib/data/ctt-pickup-cutoffs.ts`; a aplicação não precisa de ler PDFs em execução.

Verificação: `node --test tests/ctt-pickup-cutoff.test.cjs tests/pickup-management.test.cjs tests/ctt-pickup-serialization.test.cjs` — 30 testes aprovados. TypeScript e ESLint dos novos módulos aprovados. As colunas e exceções foram também conferidas visualmente no PDF. Num navegador, com relógio simulado, o aviso mudou automaticamente de prazo disponível para aproximação e ultrapassagem, sem exceder a largura de um telemóvel de 390 px. Nenhum pedido real foi enviado aos CTT.
