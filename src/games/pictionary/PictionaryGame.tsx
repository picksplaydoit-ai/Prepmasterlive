import { useState } from "react";
import PictionarySetup from "./PictionarySetup";
import PictionaryTeacher from "./PictionaryTeacher";
import { PictionaryConfig, PictionaryWordBank } from "./pictionaryTypes";
import { socket } from "../../lib/socket";

interface PictionaryGameProps {
  onBack: () => void;
}

export default function PictionaryGame({ onBack }: PictionaryGameProps) {
  const [gameState, setGameState] = useState<"setup" | "playing">("setup");
  const [pin, setPin] = useState<string>("");
  const [config, setConfig] = useState<PictionaryConfig | null>(null);
  const [selectedBank, setSelectedBank] = useState<PictionaryWordBank | null>(null);

  const handleLaunchGame = (newConfig: PictionaryConfig, bank: PictionaryWordBank) => {
    // Generate a local 5-digit classroom PIN code
    const generatedPin = Math.floor(10000 + Math.random() * 90000).toString();
    setPin(generatedPin);
    setConfig(newConfig);
    setSelectedBank(bank);

    // Bootstrap room on the Node server
    socket.emit("pictionary:create-room", {
      pin: generatedPin,
      config: newConfig,
      bankName: bank.name,
      words: bank.words,
    });

    setGameState("playing");
  };

  const handleReset = () => {
    setGameState("setup");
    setPin("");
    setConfig(null);
    setSelectedBank(null);
  };

  return (
    <div className="w-full" id="pictionary-game-root">
      {gameState === "setup" ? (
        <PictionarySetup
          onBack={onBack}
          onLaunchGame={handleLaunchGame}
        />
      ) : (
        config && selectedBank && (
          <PictionaryTeacher
            socket={socket}
            pin={pin}
            config={config}
            selectedBank={selectedBank}
            onEndGame={handleReset}
          />
        )
      )}
    </div>
  );
}
