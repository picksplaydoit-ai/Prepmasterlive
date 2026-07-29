const fs = require('fs');

const socketLogic = `
// ==========================================
// SOCKET.IO CORE (Recovered basic routing)
// ==========================================
io.on("connection", (socket) => {
  // Join a room based on PIN
  socket.on("player:join", (data) => {
    if (data && data.pin) {
      socket.join('game:' + data.pin);
      socket.to('game:' + data.pin).emit("player:joined-list", data);
      socket.emit("player:join-success", data);
    }
  });

  socket.on("host:create-session", (data) => {
    if (data && data.pin) {
      socket.join('game:' + data.pin);
    }
  });

  // Generic broadcaster for host to students
  const hostEvents = [
    "host:start-game", "host:next-question", "host:skip-question", 
    "host:end-game", "host:show-leaderboard", "game:host-message",
    "jeopardy:start", "jeopardy:question-show", "jeopardy:cell-cleared",
    "exam:start", "exam:ended", "game:status-update", "countdown:tick",
    "question:active", "question:tick"
  ];
  
  hostEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        socket.to('game:' + data.pin).emit(evt, data);
      }
    });
  });

  // Generic broadcaster for students to host
  const playerEvents = [
    "player:submit-answer", "player:answer-received", "player:question-result",
    "buzzer:press"
  ];

  playerEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        // Send to host (we assume everyone in room gets it, and host filters it)
        io.to('game:' + data.pin).emit(evt, data);
      }
    });
  });

  // Buzzer logic
  const buzzerEvents = ["buzzer:start", "buzzer:close", "buzzer:reset"];
  buzzerEvents.forEach(evt => {
    socket.on(evt, (data) => {
      if (data && data.pin) {
        io.to('game:' + data.pin).emit(evt.replace("buzzer:", "buzzer:") + (evt === "buzzer:start" ? "ted" : evt === "buzzer:reset" ? "ted" : "d"), data); // just basic mapping or broadcast
      }
    });
  });

  socket.on("buzzer:reset", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:resetted", data);
     }
  });
  socket.on("buzzer:start", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:started", data);
     }
  });
  socket.on("buzzer:close", (data) => {
     if (data && data.pin) {
        io.to('game:' + data.pin).emit("buzzer:closed", data);
     }
  });

  socket.on("disconnect", () => {
    // Handle disconnects generically if needed
  });
});

async function startViteAndListen() {
`;

let code = fs.readFileSync('server.ts', 'utf8');
// Insert before startViteAndListen if it exists, otherwise at the end.
if (code.includes('async function startViteAndListen')) {
  code = code.replace('async function startViteAndListen() {', socketLogic);
} else {
  code += socketLogic;
}

fs.writeFileSync('server.ts', code);
