const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const distPath = path.join\(process.cwd\(\), 'dist'\);/g, `const distPath = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'dist');`);

fs.writeFileSync('server.ts', code);
