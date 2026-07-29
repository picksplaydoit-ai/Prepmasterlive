const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regexesToRemove = [
  /function loadPictionaryBanks\(\)[\s\S]*?(?=function loadHorseRaceHistory)/g,
  /function loadHorseRaceHistory\(\)[\s\S]*?(?=function loadHeadbanzBanks)/g,
  /function loadHeadbanzBanks\(\)[\s\S]*?(?=function compilePlayerSummaries)/g,
  /seedHeadbanzDefaultBanks\(\);\n/g
];

for(let reg of regexesToRemove) {
   code = code.replace(reg, '');
}

fs.writeFileSync('server.ts', code);
