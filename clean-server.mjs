import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');
const lines = content.split('\n');

const markers = [
  { start: '// PICTIONARY DATABASE OPERATIONS', end: '// PICTIONARY DATABASE SEEDING LOGIC' },
  { start: '// PICTIONARY REST ENDPOINTS', end: '// BUZZER (100 MEXICANOS/JEOPARDY) LOGIC' },
  { start: '// HORSE RACE HISTORY ENDPOINTS', end: '// HEADBANZ REST API ENDPOINTS' },
  { start: '// HEADBANZ REST API ENDPOINTS', end: '// QUESTIONNAIRE REST API ENDPOINTS' },
  { start: '  // PICTIONARY SOCKET.IO ACTIONS', end: '  // HORSE RACE SOCKET.IO ACTIONS' },
  { start: '  // HORSE RACE SOCKET.IO ACTIONS', end: '  // EXAM MODE SOCKET.IO ACTIONS' },
  { start: '  // HEADBANZ SOCKET.IO ACTIONS', end: '  // CONECTA 4 EDUCATIVO SOCKET.IO ACTIONS' },
  { start: '  // CONECTA 4 EDUCATIVO SOCKET.IO ACTIONS', end: '  // DISCONNECT HANDLING' },
  { start: '// HEADBANZ CORE LOGIC HELPERS', end: '// CONECTA 4 CORE HELPERS' },
  { start: '// CONECTA 4 CORE HELPERS', end: 'app.get("*", (req, res) => {' }
];

let filteredLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  let triggeredStart = false;
  for (const marker of markers) {
    if (line.includes(marker.start)) {
      skip = true;
      triggeredStart = true;
      break;
    }
  }

  if (skip) {
    for (const marker of markers) {
      if (line.includes(marker.end)) {
        skip = false;
        // Keep the end marker line if it's not meant to be deleted
        if (!marker.end.includes('app.get("*')) {
           filteredLines.push(line);
        } else {
           filteredLines.push(line);
        }
        break;
      }
    }
    continue;
  }

  filteredLines.push(line);
}

fs.writeFileSync('server.ts', filteredLines.join('\n'), 'utf-8');
console.log('Done cleaning server.ts');
