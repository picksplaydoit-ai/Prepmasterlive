import { useState, useEffect } from "react";
import { socket } from "../lib/socket";
import { playGameSound } from "../lib/sound";

export interface BuzzerPress {
  id?: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  gameMode: string;
  timestamp: number;
  position: number;
  reactionTime: number;
  date?: string;
}

export interface BuzzerState {
  isOpen: boolean;
  presses: BuzzerPress[];
  gameMode: string;
}

export function useBuzzer(pin: string, gameMode: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [presses, setPresses] = useState<BuzzerPress[]>([]);
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [myReactionTime, setMyReactionTime] = useState<number | null>(null);
  const [buzzed, setBuzzed] = useState(false);

  useEffect(() => {
    if (!pin) return;

    const handleStarted = (data: { gameMode: string }) => {
      setIsOpen(true);
      setPresses([]);
      setMyPosition(null);
      setMyReactionTime(null);
      setBuzzed(false);
    };

    const handleClosed = () => {
      setIsOpen(false);
    };

    const handleResetted = () => {
      setIsOpen(false);
      setPresses([]);
      setMyPosition(null);
      setMyReactionTime(null);
      setBuzzed(false);
    };

    const handleResults = (data: { presses: BuzzerPress[] }) => {
      setPresses(data.presses);
    };

    const handlePressedAck = (data: { position: number; reactionTime: number }) => {
      setMyPosition(data.position);
      setMyReactionTime(data.reactionTime);
      setBuzzed(true);
    };

    const handleSound = (data: { type: string }) => {
      if (data.type === "start") {
        playGameSound("buzzer_start");
      } else if (data.type === "victory") {
        playGameSound("buzzer_victory");
      } else if (data.type === "close") {
        playGameSound("buzzer_close");
      }
    };

    socket.on("buzzer:started", handleStarted);
    socket.on("buzzer:closed", handleClosed);
    socket.on("buzzer:resetted", handleResetted);
    socket.on("buzzer:results", handleResults);
    socket.on("buzzer:pressed-ack", handlePressedAck);
    socket.on("buzzer:sound", handleSound);

    return () => {
      socket.off("buzzer:started", handleStarted);
      socket.off("buzzer:closed", handleClosed);
      socket.off("buzzer:resetted", handleResetted);
      socket.off("buzzer:results", handleResults);
      socket.off("buzzer:pressed-ack", handlePressedAck);
      socket.off("buzzer:sound", handleSound);
    };
  }, [pin]);

  const startBuzzer = () => {
    socket.emit("buzzer:start", { pin, gameMode });
  };

  const pressBuzzer = (playerInfo: { playerId: string; name: string; teamId?: string | null; teamName?: string | null }) => {
    if (buzzed || !isOpen) return;
    setBuzzed(true);
    socket.emit("buzzer:press", {
      pin,
      playerId: playerInfo.playerId,
      playerName: playerInfo.name,
      teamId: playerInfo.teamId || null,
      teamName: playerInfo.teamName || null,
      gameMode
    });
  };

  const closeBuzzer = () => {
    socket.emit("buzzer:close", { pin });
  };

  const resetBuzzer = () => {
    socket.emit("buzzer:reset", { pin });
  };

  return {
    isOpen,
    presses,
    myPosition,
    myReactionTime,
    buzzed,
    startBuzzer,
    pressBuzzer,
    closeBuzzer,
    resetBuzzer
  };
}
