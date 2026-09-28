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
  "listaBultos": []
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

const types = ["1", "2"];

async function testAll() {
  for (const t of types) {
    const payload = JSON.stringify(Object.assign({}, data, {
      "listaInformacionAdicional": [{"tipoEtiqueta": t}]
    }));
    await new Promise(resolve => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
          console.log(`Tipo ${t}:`, JSON.parse(body).mensajeRetorno || (JSON.parse(body).etiqueta?.[0] ? Object.keys(JSON.parse(body).etiqueta[0]) : null));
          resolve();
        });
      });
      req.write(payload);
      req.end();
    });
  }
}
testAll();
