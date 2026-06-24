import React, { useState } from "react";
import HorseRaceSetup from "./HorseRaceSetup";
import HorseRaceTeacher from "./HorseRaceTeacher";
import { HorseRaceConfig } from "./horseRaceTypes";

interface HorseRaceGameProps {
  onBack: () => void;
}

export default function HorseRaceGame({ onBack }: HorseRaceGameProps) {
  const [config, setConfig] = useState<HorseRaceConfig | null>(null);
  const [selectedBankTitle, setSelectedBankTitle] = useState<string>("");
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);

  const handleLaunchGame = (newConfig: HorseRaceConfig, bankTitle: string, questions: any[]) => {
    setConfig(newConfig);
    setSelectedBankTitle(bankTitle);
    setSelectedQuestions(questions);
  };

  const handleBackToSetup = () => {
    setConfig(null);
  };

  return (
    <div className="w-full min-h-[80vh]" id="horse-race-game-root">
      {!config ? (
        <HorseRaceSetup
          onBack={onBack}
          onLaunchGame={handleLaunchGame}
        />
      ) : (
        <HorseRaceTeacher
          initialConfig={config}
          bankTitle={selectedBankTitle}
          questions={selectedQuestions}
          onBack={handleBackToSetup}
          onExitToDashboard={onBack}
        />
      )}
    </div>
  );
}
