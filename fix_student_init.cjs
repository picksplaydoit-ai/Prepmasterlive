const fs = require('fs');
let code = fs.readFileSync('src/components/StudentInterface.tsx', 'utf8');

const replacement = `export default function StudentInterface({ initialPin, initialGame }: StudentInterfaceProps = {}) {
  // Clear stale state if we are entering from a direct QR Code (new PIN)
  if (initialPin && initialPin !== safeStorage.getItem("prepmaster_pin")) {
    safeStorage.removeItem("prepmaster_pin");
    safeStorage.removeItem("prepmaster_team_id");
    safeStorage.removeItem("activeGameType");
    safeStorage.removeItem("exam_progress");
  }

  const [pin, setPin] = useState(() => initialPin || safeStorage.getItem("prepmaster_pin") || "");
  const [name, setName] = useState(() => safeStorage.getItem("prepmaster_name") || "");
  const [selectedAvatarId, setSelectedAvatarId] = useState(() => safeStorage.getItem("prepmaster_avatar_id") || "cult_mariachi");
  const [activeCategory, setActiveCategory] = useState("Todos");

  // Sync initial pin from QR link
  useEffect(() => {
    if (initialPin) {
      setPin(initialPin);
    }
  }, [initialPin]);

  // Priority logic for gameType
  const [activeGameType, setActiveGameType] = useState<string>(initialGame || "quiz_live");

  // Team selection states
  const [roomGameMode, setRoomGameMode] = useState<'individual' | 'teams'>('individual');
  const [roomTeams, setRoomTeams] = useState<Team[]>([]);
  const [playersInSession, setPlayersInSession] = useState<Player[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => safeStorage.getItem("prepmaster_team_id") || null);

  const [joined, setJoined] = useState(false);
  const [joinedPin, setJoinedPin] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
`;

code = code.replace(/export default function StudentInterface[\s\S]*?const \[roomTitle, setRoomTitle\] = useState\(""\);/m, replacement);

// Also remove `const [activeGameType, setActiveGameType] = useState<string>(() => safeStorage.getItem("activeGameType") || "quiz_live");` if it exists.
code = code.replace(/const \[activeGameType, setActiveGameType\] = useState<string>\(\(\) => safeStorage\.getItem\("activeGameType"\) \|\| "quiz_live"\);\n?/m, '');

fs.writeFileSync('src/components/StudentInterface.tsx', code);
