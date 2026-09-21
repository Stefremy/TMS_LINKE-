export const emailTemplates: Record<string, string> = {
  pickup_scheduled: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
  .container { max-w-lg mx-auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; }
  .logo { color: #16a34a; font-size: 28px; font-weight: 800; text-decoration: none; display: block; margin-bottom: 24px; }
  .title { color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
  .text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
  .box { background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .box p { margin: 0 0 8px 0; color: #334155; font-size: 14px; }
  .box p:last-child { margin: 0; }
  .btn { display: inline-block; background: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <img src="http://localhost:3000/Linke-logo.png" alt="Linke" style="height: 32px; display: block; margin-bottom: 24px;" />
    <h1 class="title">Recolha Agendada</h1>
    <p class="text">A sua recolha foi agendada com sucesso. A transportadora irá passar no local indicado no período selecionado.</p>
    <div class="box">
      <p><strong>Data:</strong> {{date}}</p>
      <p><strong>Período:</strong> {{time_period}}</p>
      <p><strong>Morada:</strong> {{address}}</p>
      <p><strong>Volumes:</strong> {{volumes}}</p>
    </div>
    <a href="{{tracking_url}}" class="btn">Ver Detalhes</a>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
  `,
  low_balance: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
  .container { max-w-lg mx-auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto; border: 1px solid #fecdd3; border-top: 4px solid #e11d48;}
  .logo { color: #16a34a; font-size: 28px; font-weight: 800; text-decoration: none; display: block; margin-bottom: 24px; }
  .title { color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
  .text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
  .highlight { color: #e11d48; font-weight: 700; font-size: 24px; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <img src="http://localhost:3000/Linke-logo.png" alt="Linke" style="height: 32px; display: block; margin-bottom: 24px;" />
    <h1 class="title">Aviso de Saldo Baixo</h1>
    <p class="text">O saldo da sua conta atingiu o limite mínimo. Por favor, carregue a sua carteira para garantir que os seus próximos envios e recolhas não são interrompidos.</p>
    <p class="text">Saldo atual: <span class="highlight">{{current_balance}}€</span></p>
    <br>
    <a href="{{topup_url}}" class="btn">Carregar Saldo Agora</a>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
  `,
  in_transit: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
  .container { max-w-lg mx-auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-top: 4px solid #3b82f6;}
  .logo { color: #16a34a; font-size: 28px; font-weight: 800; text-decoration: none; display: block; margin-bottom: 24px; }
  .title { color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
  .text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
  .box { background: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .box p { margin: 0 0 8px 0; color: #334155; font-size: 14px; }
  .box p:last-child { margin: 0; }
  .btn { display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <img src="http://localhost:3000/Linke-logo.png" alt="Linke" style="height: 32px; display: block; margin-bottom: 24px;" />
    <h1 class="title">A sua encomenda está a caminho! 🚚</h1>
    <p class="text">Olá {{receiver_name}}, a sua encomenda enviada por <strong>{{sender_name}}</strong> já se encontra em trânsito e deverá ser entregue em breve.</p>
    <div class="box">
      <p><strong>Nº Envio:</strong> {{tracking_code}}</p>
      <p><strong>Transportadora:</strong> {{carrier_name}}</p>
    </div>
    <a href="{{tracking_url}}" class="btn">Acompanhar Encomenda</a>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
  `,
  tracking: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
  .container { max-w-lg mx-auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; }
  .logo { color: #16a34a; font-size: 28px; font-weight: 800; text-decoration: none; display: block; margin-bottom: 24px; }
  .title { color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
  .text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
  .box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center; }
  .code { font-family: monospace; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: 2px; }
  .btn { display: inline-block; background: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <img src="http://localhost:3000/Linke-logo.png" alt="Linke" style="height: 32px; display: block; margin-bottom: 24px;" />
    <h1 class="title">Guia de Transporte Emitida</h1>
    <p class="text">Olá {{receiver_name}}, foi emitida uma guia de transporte para a sua encomenda. Pode usar o código abaixo para seguir o estado do envio.</p>
    <div class="box">
      <p style="margin:0 0 8px 0; color:#64748b; font-size:12px; text-transform:uppercase; font-weight:600;">Código de Envio</p>
      <div class="code">{{tracking_code}}</div>
    </div>
    <center>
      <a href="{{tracking_url}}" class="btn">Seguir Encomenda</a>
    </center>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
  `,
  incident: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 0; }
  .container { max-w-lg mx-auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 500px; margin: 0 auto; border: 1px solid #fecaca; border-top: 4px solid #ef4444;}
  .logo { color: #16a34a; font-size: 28px; font-weight: 800; text-decoration: none; display: block; margin-bottom: 24px; }
  .title { color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; }
  .text { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
  .box { background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #fca5a5; }
  .box p { margin: 0 0 8px 0; color: #991b1b; font-size: 14px; }
  .box p:last-child { margin: 0; }
  .btn { display: inline-block; background: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { margin-top: 32px; text-align: center; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <img src="http://localhost:3000/Linke-logo.png" alt="Linke" style="height: 32px; display: block; margin-bottom: 24px;" />
    <h1 class="title">Atenção: Problema na Entrega ⚠️</h1>
    <p class="text">Verificou-se uma incidência durante a tentativa de entrega da encomenda com o código <strong>{{tracking_code}}</strong>.</p>
    <div class="box">
      <p><strong>Motivo Reportado:</strong> {{incident_reason}}</p>
      <p><strong>Data/Hora:</strong> {{incident_date}}</p>
    </div>
    <p class="text" style="font-size: 13px;">Por favor, contacte o suporte ou verifique os detalhes da encomenda para podermos resolver a situação o mais rápido possível.</p>
    <a href="{{support_url}}" class="btn">Ver Detalhes e Resolver</a>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
  `
}
