const https = require('https');

const data = {
  "keyCli": "555559999",
  "nenvio": "6330002512473747",
  "tipo": "1"
};

const options = {
  hostname: 'www.test.cexpr.es',
  port: 443,
  path: '/wspsc/apiRestEtiquetaTransporte/json/etiquetaTransporte',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from('WS_GoLinke:l3CtF').toString('base64')
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response:', body));
});
req.write(JSON.stringify(data));
req.end();
