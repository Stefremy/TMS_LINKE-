const https = require('https');

const data = JSON.stringify({
  "solicitante": "1",
  "codRte": "555559999",
  "fecha": "28092026",
  "nomRte": "TMS LINKE",
  "dirRte": "Avenida Teste 100",
  "pobRte": "Madrid",
  "codPosNacRte": "",
  "codPosIntRte": "4000",
  "paisISORte": "PT",
  "contacRte": "Remitente Teste",
  "telefRte": "910000000",
  "emailRte": "",
  "nomDest": "Destinatario Teste",
  "dirDest": "Calle Mayor 1",
  "pobDest": "Madrid",
  "codPosNacDest": "",
  "codPosIntDest": "1000",
  "paisISODest": "PT",
  "contacDest": "Destinatario Teste",
  "telefDest": "910000000",
  "emailDest": "",
  "observac": "",
  "numBultos": "1",
  "kilos": "1",
  "volumen": "",
  "producto": "63",
  "portes": "P",
  "reembolso": "",
  "entrSabado": "",
  "seguro": "",
  "listaBultos": [],
  "listaInformacionAdicional": [
    {
      "tipoEtiqueta": "1"
    }
  ]
});

const options = {
  hostname: 'www.test.cexpr.es',
  port: 443,
  path: '/wspsc/apiRestGrabacionEnviok8s/json/grabacionEnvio',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from('WS_GoLinke:l3CtF').toString('base64')
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response with label:', body));
});
req.write(data);
req.end();

const dataNoLabel = JSON.stringify(Object.assign(JSON.parse(data), {listaInformacionAdicional: undefined}));
const req2 = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response without label:', body));
});
req2.write(dataNoLabel);
req2.end();
