import http from 'http'

const server = http.createServer((req, res) => {
  const cookies = req.headers.cookie ? req.headers.cookie.split(';') : [];
  
  const clearHeaders = cookies.map(c => {
    const cookieName = c.split('=')[0].trim();
    return `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
  });

  if (clearHeaders.length > 0) {
    res.setHeader('Set-Cookie', clearHeaders);
  }
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
      <h1>Cookies Limpos com Sucesso! 🧹</h1>
      <p>O problema do HTTP ERROR 431 foi resolvido e o ficheiro de sessão gigante foi apagado.</p>
      <a href="http://localhost:3000/ops" style="padding: 10px 20px; background: #111; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; font-weight: bold;">
        Voltar para o Linke TMS
      </a>
    </div>
  `);
});

server.listen(3001, () => {
  console.log("Cookie cleaner running on http://localhost:3001");
});
