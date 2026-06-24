import React, { useState } from "react";
import { Socket } from "socket.io-client";
import Conecta4Setup from "./Conecta4Setup";
import Conecta4Teacher from "./Conecta4Teacher";
import Conecta4Results from "./Conecta4Results";
import { Conecta4Config, Conecta4SessionState } from "./conecta4Types";

interface Conecta4GameProps {
  socket: Socket;
  pin: string;
  onExit: () => void;
}

export default function Conecta4Game({ socket, pin, onExit }: Conecta4GameProps) {
  const [gameState, setGameState] = useState<"setup" | "playing" | "results">("setup");
  const [gameConfig, setGameConfig] = useState<Conecta4Config | null>(null);
  const [questionnaireTitle, setQuestionnaireTitle] = useState<string>("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [finalSession, setFinalSession] = useState<Conecta4SessionState | null>(null);

  const handleLaunch = (config: Conecta4Config, title: string, gameQuestions: any[]) => {
    setGameConfig(config);
    setQuestionnaireTitle(title);
    setQuestions(gameQuestions);
    setGameState("playing");
  };

  const handleGameEnd = (endedSession: Conecta4SessionState) => {
    setFinalSession(endedSession);
    setGameState("results");
  };

  const handleRestart = () => {
    setGameState("setup");
    setFinalSession(null);
    setGameConfig(null);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white" id="conecta4-main-router">
      {gameState === "setup" && (
        <Conecta4Setup 
          onBack={onExit} 
          onLaunch={handleLaunch} 
        />
      )}

      {gameState === "playing" && gameConfig && (
        <Conecta4Teacher
          socket={socket}
          pin={pin}
          config={gameConfig}
          questionnaireTitle={questionnaireTitle}
          questions={questions}
          onExit={onExit}
          onGameEnd={handleGameEnd}
        />
      )}

      {gameState === "results" && finalSession && (
        <Conecta4Results
          session={finalSession}
          onRestart={handleRestart}
          onExit={onExit}
        />
      )}
    </div>
  );
}
