const fs = require('fs');
const map = JSON.parse(fs.readFileSync('dist/server.cjs.map', 'utf8'));
const index = map.sources.indexOf('../server.ts');
if (index !== -1) {
    fs.writeFileSync('server.ts', map.sourcesContent[index], 'utf8');
    console.log('Recovered server.ts!');
} else {
    console.log('Could not find server.ts in sourcemap.');
}
