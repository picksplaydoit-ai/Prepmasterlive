const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/"player:submit-answer", "player:answer-received", "player:question-result",\n    "buzzer:press"/g, '"player:submit-answer", "player:answer-received", "player:question-result",\n    "buzzer:press", "game:player-message", "player:leave"');

fs.writeFileSync('server.ts', code);
