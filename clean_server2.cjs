const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexesToRemove = [
  /\/\/ PICTIONARY DATABASE OPERATIONS \(Prepmaster 2\.3\.0\)[\s\S]*?(?=\/\/ ==========================================|$)/g,
  /\/\/ HEADBANZ SQLITE HELPERS & SEEDING \(Prepmaster 2\.5\.0\)[\s\S]*?(?=\/\/ ==========================================|$)/g,
  /\/\/ PICTIONARY REST ENDPOINTS \(Prepmaster 2\.3\.0\)[\s\S]*?(?=\/\/ BUZZER \(100 MEXICANOS\/JEOPARDY\) LOGIC|$)/g,
  /\/\/ HORSE RACE HISTORY ENDPOINTS \(Prepmaster v2\.4\.0\)[\s\S]*?(?=\/\/ QUESTIONNAIRE REST API ENDPOINTS|$)/g,
  /\/\/ Global active Pictionary rooms storage[\s\S]*?(?=const familyFeudSessions)/g,
  /\/\/ Global active Headbanz rooms storage[\s\S]*?(?=const examSessions)/g,
  /  \/\/ PICTIONARY SOCKET\.IO ACTIONS \(Prepmaster 2\.3\.0\)[\s\S]*?(?=  \/\/ EXAM MODE SOCKET\.IO ACTIONS|$)/g,
  /  \/\/ HEADBANZ SOCKET\.IO ACTIONS \(Prepmaster 2\.5\.0\)[\s\S]*?(?=  \/\/ DISCONNECT HANDLING|$)/g,
  /\/\/ HEADBANZ CORE LOGIC HELPERS \(Prepmaster 2\.5\.0\)[\s\S]*?(?=async function startViteAndListen\(\) \{)/g
];

for(let reg of regexesToRemove) {
   code = code.replace(reg, '');
}

fs.writeFileSync('server.ts', code);
