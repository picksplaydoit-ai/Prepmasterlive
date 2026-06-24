import React, { useState } from "react";
import HeadbanzSetup from "./HeadbanzSetup";
import HeadbanzTeacher from "./HeadbanzTeacher";
import HeadbanzResults from "./HeadbanzResults";
import { HeadbanzConfig, HeadbanzWord } from "./headbanzTypes";

interface HeadbanzGameProps {
  socket: any;
  onBack: () => void;
}

export default function HeadbanzGame({ socket, onBack }: HeadbanzGameProps) {
  const [view, setView] = useState<"setup" | "playing" | "results">("setup");
  const [pin, setPin] = useState<string>("");
  const [config, setConfig] = useState<HeadbanzConfig | null>(null);
  const [bankTitle, setBankTitle] = useState<string>("");
  const [words, setWords] = useState<HeadbanzWord[]>([]);
  
  // Results cache
  const [playerScores, setPlayerScores] = useState<any[]>([]);
  const [conceptsLog, setConceptsLog] = useState<any[]>([]);

  const handleLaunchGame = (newConfig: HeadbanzConfig, title: string, loadedWords: HeadbanzWord[]) => {
    // Generate simple 4-digit PIN for local connections
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(newPin);
    setConfig(newConfig);
    setBankTitle(title);
    setWords(loadedWords);

    // Initialize Headbanz session on server via Socket.io
    socket.emit("headbanz:create", {
      pin: newPin,
      config: newConfig,
      bankName: title,
      words: loadedWords
    });

    setView("playing");
  };

  const handleGameEnded = (finalPlayers: any[], finalLog: any[]) => {
    setPlayerScores(finalPlayers);
    setConceptsLog(finalLog);
    setView("results");
  };

  const handleRestart = () => {
    setView("setup");
    setPin("");
    setConfig(null);
    setBankTitle("");
    setWords([]);
    setPlayerScores([]);
    setConceptsLog([]);
  };

  return (
    <div className="w-full h-full min-h-screen" id="headbanz-game-module-root">
      {view === "setup" && (
        <HeadbanzSetup
          onBack={onBack}
          onLaunchGame={handleLaunchGame}
        />
      )}

      {view === "playing" && config && (
        <HeadbanzTeacher
          socket={socket}
          pin={pin}
          config={config}
          bankTitle={bankTitle}
          words={words}
          onGameEnded={handleGameEnded}
        />
      )}

      {view === "results" && config && (
        <HeadbanzResults
          bankTitle={bankTitle}
          config={config}
          players={playerScores}
          conceptsLog={conceptsLog}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
