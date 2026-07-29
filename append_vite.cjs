const fs = require('fs');

const endLogic = `
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = '0.0.0.0';
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(\`Servidor Prepmaster corriendo en http://\${HOST}:\${PORT}\`);
  });
}

startViteAndListen().catch(console.error);
`;

let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace('async function startViteAndListen() {', 'async function startViteAndListen() {' + endLogic);
fs.writeFileSync('server.ts', code);
