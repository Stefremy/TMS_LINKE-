# C × L × A obrigatórios na criação de envios

## Regra

OPS → Novo envio e Área do Cliente → Criar envio exigem comprimento, largura e altura em centímetros. Os três campos são obrigatórios, aceitam decimais e têm mínimo de 0,1 cm. Não recebem valores predefinidos que substituam o preenchimento pelo utilizador.

O servidor aplica a mesma validação à emissão e à criação por FormData, incluindo chamadas diretas sem usar os formulários. Valores ausentes, zero, negativos, inferiores ao mínimo, não numéricos ou não finitos são recusados antes de reservar saldo, chamar a transportadora ou escrever o envio.

## Esquema e gravação

Consulta de leitura ao Supabase em 23/10/2026 confirmou que `packages.dimensions` já existe e que `shipments.length_cm` não está instalado nesse ambiente. A implementação usa o esquema existente: não depende de executar a antiga migração de dimensões de shipments.

Cada novo registo de volume é gravado com o peso declarado em `weight_g` e as medidas em `packages.dimensions`, coluna JSONB:

```json
{
  "length_cm": 30.5,
  "width_cm": 20,
  "height_cm": 10,
  "unit": "cm"
}
```

O snapshot `shipment_data` em `audit_log` guarda também `length_cm`, `width_cm` e `height_cm` com os valores validados, sem os substituir por zero. A emissão guarda ainda o peso e o número de volumes no snapshot.

A leitura dos detalhes usa o snapshot e pode recuperar as dimensões diretamente da coluna JSONB quando só existe um registo de volume. Não soma dimensões de volumes distintos. Valores históricos ausentes continuam ausentes.

Se a transportadora já aceitou o envio mas a gravação do volume falhar, a resposta devolve um aviso para confirmação. Ambos os formulários mostram o aviso e pedem que não se crie novamente o envio, evitando duplicar a expedição. O rascunho usa apenas colunas nativas de shipments e guarda os restantes dados no snapshot e no volume.

Não foram alterados preços, regras tarifárias ou dados históricos de produção. A confirmação do esquema foi de leitura; os testes de criação usam dados fictícios e transportadoras simuladas.

## Verificação

- Testes de servidor com cliente, colaborador e administrador: ausência/valor inválido em qualquer medida impede a emissão e qualquer reserva/call à transportadora.
- CTT e Correos: medidas decimais persistem no registo packages e no snapshot.
- Rascunhos: as mesmas regras são aplicadas ao FormData e o peso não é substituído por 1 kg.
- Ambos os formulários expõem os três campos como obrigatórios; o envio de 30,5 cm conserva a precisão decimal.
- Avisos de falha de gravação após aceitação são visíveis e não recomendam duplicar o pedido.
- Detalhes recuperam C/L/A da coluna JSONB mesmo sem snapshot.
