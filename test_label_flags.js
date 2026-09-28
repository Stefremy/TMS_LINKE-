const https = require('https');

const data = {
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
  "nomDest": "Destinatario Teste",
  "dirDest": "Calle Mayor 1",
  "pobDest": "Madrid",
  "codPosNacDest": "",
  "codPosIntDest": "1000",
  "paisISODest": "PT",
  "contacDest": "Destinatario Teste",
  "telefDest": "910000000",
  "numBultos": "1",
  "kilos": "1",
  "producto": "63",
  "portes": "P",
  "listaBultos": [],
  "generarEtiqueta": "1",
  "imprimirEtiqueta": "1"
};

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

const payload = JSON.stringify(data);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    console.log("Codigo:", json.codigoRetorno);
    console.log("Mensaje:", json.mensajeRetorno);
    console.log("Tracking:", json.datosResultado);
    console.log("Etiqueta object:", !!json.etiqueta);
    console.log("Lista object:", !!json.listaInformacionAdicional);
  });
});
req.write(payload);
req.end();
