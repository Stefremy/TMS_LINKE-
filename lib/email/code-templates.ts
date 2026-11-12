// Shared email renderers: the configuration preview uses the same HTML as delivery.
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

export function pickupConfirmationHtml(v: {client_name:string;reference:string;carrier_reference:string;carrier_name:string;url:string}) { return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#1e293b"><p style="font-size:24px;font-weight:700;color:#15803d">Linke</p><h1 style="font-size:22px">Pedido de recolha confirmado</h1><p>Olá, ${escape(v.client_name)}.</p><p>A equipa Linke já efetuou o seu pedido de recolha à ${escape(v.carrier_name)}.</p><div style="background:#f1f5f9;padding:16px;border-radius:8px"><p><strong>O seu pedido:</strong> ${escape(v.reference)}</p><p><strong>Referência da transportadora:</strong> ${escape(v.carrier_reference)}</p><p><strong>Estado do pedido:</strong> Efetuado</p></div><p><a href="${escape(v.url)}" style="display:inline-block;background:#15803d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Consultar pedido de recolha</a></p><p style="font-size:12px;color:#64748b">Esta mensagem confirma o pedido à transportadora. Acompanhe os seus pedidos no portal Linke.</p></div>` }

export function quotationTrackingHtml(v:{reference:string;tracking_number:string;carrier:string;url:string}) { return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px"><h1>O seu envio está registado</h1><p>O envio do pedido <strong>${escape(v.reference)}</strong> foi registado pela equipa Linke.</p><p>Tracking ${escape(v.carrier)}: <strong>${escape(v.tracking_number)}</strong></p><p><a href="${escape(v.url)}">Acompanhar o envio</a></p><p>O envio está disponível no histórico da sua loja.</p></div>` }

export function clientInvitationHtml(storeName:string,link:string) { return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px">
    <h1 style="font-size:24px">Bem-vindo à Área do Cliente Linke</h1>
    <p>O acesso à loja <strong>${escape(storeName)}</strong> está preparado.</p>
    <p>Escolha a sua palavra-passe para entrar e começar a criar envios.</p>
    <p style="margin:28px 0"><a href="${escape(link)}" style="background:#126b4a;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">Definir palavra-passe</a></p>
    <p>Depois, entre com este email e a palavra-passe que escolheu.</p>
    <p style="font-size:12px;color:#64756a">Este link é pessoal, tem validade limitada e só pode ser utilizado uma vez. Se expirar, peça um novo convite à equipa Linke. Se não esperava este convite, ignore este email.</p>
  </div>` }

export function clientRecoveryHtml(link:string) { return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px"><h1>Recuperar palavra-passe</h1><p>Recebemos um pedido para definir uma nova palavra-passe na Área do Cliente Linke.</p><p><a href="${escape(link)}">Definir nova palavra-passe</a></p><p>Este link é pessoal, tem validade limitada e só pode ser utilizado uma vez. A palavra-passe atual continua válida até guardar uma nova.</p><p>Se não fez este pedido, ignore este email.</p></div>` }

export function invoiceEmailHtml(v:{clientName:string;docTitle:string;statementNumber:string;shipmentsCount:number;totalStr:string}) { return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 15px; color: #1e293b; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 24px 32px; text-align: left; border-bottom: 3px solid #16a34a; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: #94a3b8; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .note { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 32px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Linke TMS • Faturação</h1>
      <p>Documento de Faturação de Serviços Logísticos</p>
    </div>
    <div class="body">
      <div class="greeting">Olá, ${escape(v.clientName)}</div>
      <div class="intro">
        Encontra-se disponível a fatura relativa aos serviços de logística e transporte prestados. Os respetivos documentos oficiais encontram-se em anexo em formato PDF.
      </div>
      <div class="summary-box">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Documento:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${escape(v.docTitle)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Nº Extrato TMS:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${escape(v.statementNumber)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 6px 0; color: #64748b;">Envios Faturados:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0f172a;">${v.shipmentsCount} envio(s)</td>
          </tr>
          <tr>
            <td style="padding: 10px 0 0; font-size: 15px; font-weight: 700; color: #16a34a;">Valor Total:</td>
            <td style="padding: 10px 0 0; text-align: right; font-size: 16px; font-weight: 800; color: #16a34a;">${escape(v.totalStr)} €</td>
          </tr>
        </table>
      </div>
      <div class="note">
        Os ficheiros PDF da <strong>Fatura Oficial Certificada (AT)</strong> e do <strong>Extrato Detalhado</strong> encontram-se anexados a esta mensagem.
      </div>
    </div>
    <div class="footer">
      Linke Distribuição & Logística • Suporte: geral@linke.pt<br/>
      Este é um email automático de faturação.
    </div>
  </div>
</body>
</html>
` }

export function periodStatementHtml(v:{isTest:boolean;client_name:string;label:string;shipments_count:number;amount:string;statement_number:string}) { return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17251e;padding:24px"><h2 style="color:#128a47">${v.isTest ? 'Teste de ' : ''}Extrato de Envios</h2>${v.isTest ? '<p><strong>Dados fictícios para testar a entrega. Não representa uma cobrança.</strong></p>' : ''}<p>Olá ${escape(v.client_name)},</p><p>Segue em anexo o extrato dos envios do período <strong>${escape(v.label)}</strong>.</p><p>${v.shipments_count} envio(s) · Valor líquido dos envios (s/ IVA): <strong>${escape(v.amount)}</strong></p><p>Referência: ${escape(v.statement_number)}</p><p style="font-size:12px;color:#68756d">Este é um extrato interno de movimentos. Não substitui uma fatura.</p><p>Equipa Linke</p></div>` }
