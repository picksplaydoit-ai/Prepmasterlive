import React from "react";

export interface AvatarItem {
  id: string;
  name: string;
  category: string;
  color: string;
  render: (size: number) => React.ReactNode;
}

export const AVATAR_CATEGORIES = [
  "Cultura Mexicana",
  "Jalisco",
  "Animales Mexicanos",
  "STEM",
  "Profesiones",
  "Deportes",
];

export const AVATAR_LIST: AvatarItem[] = [
  // --- CULTURA MEXICANA (6) ---
  {
    id: "cult_mariachi",
    name: "Mariachi",
    category: "Cultura Mexicana",
    color: "#1E1E24",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#2C2C35" />
        {/* Sombrero base */}
        <ellipse cx="50" cy="40" rx="36" ry="12" fill="#121214" stroke="#D4AF37" strokeWidth="2" />
        <path d="M35 40C35 25 65 25 65 40" fill="#121214" stroke="#D4AF37" strokeWidth="2" />
        {/* Carita */}
        <circle cx="50" cy="58" r="16" fill="#FAD1A5" />
        {/* Bigote mariachi */}
        <path d="M42 58C46 59 48 57 50 59C52 57 54 59 58 58C56 61 52 61 50 61C48 61 44 61 42 58Z" fill="#121214" />
        {/* Traje corbatín */}
        <path d="M42 74L50 82L58 74Z" fill="#D32F2F" />
        <circle cx="48" cy="74" r="1.5" fill="#FFF" />
        <circle cx="52" cy="74" r="1.5" fill="#FFF" />
      </svg>
    ),
  },
  {
    id: "cult_charro",
    name: "Charro",
    category: "Cultura Mexicana",
    color: "#5D4037",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#8D6E63" />
        {/* Sombrero café de charro */}
        <ellipse cx="50" cy="42" rx="38" ry="10" fill="#4E342E" stroke="#E0A96D" strokeWidth="2" />
        <path d="M32 42C32 28 68 28 68 42" fill="#4E342E" stroke="#E0A96D" strokeWidth="2" />
        {/* Rostro amigable */}
        <circle cx="50" cy="62" r="15" fill="#FFCC80" />
        {/* Gran bigote charro */}
        <path d="M40 64C45 66 48 63 50 65C52 63 55 66 60 64C57 69 53 69 50 69C47 69 43 69 40 64Z" fill="#3E2723" />
        <circle cx="44" cy="58" r="2" fill="#3D2010" />
        <circle cx="56" cy="58" r="2" fill="#3D2010" />
      </svg>
    ),
  },
  {
    id: "cult_catrina",
    name: "Catrina",
    category: "Cultura Mexicana",
    color: "#E91E63",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#212121" />
        {/* Rostro calavera */}
        <rect x="34" y="32" width="32" height="36" rx="16" fill="#FFFFFF" />
        <rect x="38" y="58" width="24" height="18" rx="6" fill="#FFFFFF" />
        {/* Ojos decorados de Catrina */}
        <circle cx="42" cy="48" r="7" fill="#E91E63" />
        <circle cx="42" cy="48" r="5" fill="#00E5FF" />
        <circle cx="42" cy="48" r="2" fill="#212121" />
        <circle cx="58" cy="48" r="7" fill="#E91E63" />
        <circle cx="58" cy="48" r="5" fill="#00E5FF" />
        <circle cx="58" cy="48" r="2" fill="#212121" />
        {/* Nariz de calavera */}
        <path d="M50 52L46 58H54L50 52Z" fill="#212121" />
        {/* Dientes */}
        <line x1="44" y1="68" x2="56" y2="68" stroke="#212121" strokeWidth="2" />
        <line x1="46" y1="64" x2="46" y2="72" stroke="#212121" strokeWidth="2" />
        <line x1="50" y1="64" x2="50" y2="72" stroke="#212121" strokeWidth="2" />
        <line x1="54" y1="64" x2="54" y2="72" stroke="#212121" strokeWidth="2" />
        {/* Flores en la cabeza de la Catrina */}
        <circle cx="50" cy="24" r="8" fill="#FF8F00" />
        <circle cx="36" cy="28" r="6" fill="#D81B60" />
        <circle cx="64" cy="28" r="6" fill="#D81B60" />
      </svg>
    ),
  },
  {
    id: "cult_luchador_enm",
    name: "Enmascarado",
    category: "Cultura Mexicana",
    color: "#3F51B5",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#303F9F" />
        {/* Máscara base */}
        <circle cx="50" cy="50" r="26" fill="#D32F2F" />
        {/* Diseños geométricos de la máscara de luchador */}
        <path d="M32 40C38 32 62 32 68 40V60C62 68 38 68 32 60V40Z" fill="#D32F2F" />
        {/* Antifaz dorado */}
        <path d="M38 48C42 42 48 42 50 48C52 42 58 42 62 48C60 56 40 56 38 48Z" fill="#FFD700" />
        {/* Agujeros para ojos */}
        <circle cx="44" cy="48" r="4" fill="#121212" />
        <circle cx="56" cy="48" r="4" fill="#121212" />
        {/* Boca abierta guerrera */}
        <rect x="44" y="60" width="12" height="6" rx="3" fill="#FFFFFF" stroke="#FFD700" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "cult_taco",
    name: "Taco Mexicano",
    category: "Cultura Mexicana",
    color: "#FFEB3B",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FBC02D" />
        {/* Relleno (carne, verdura, salsa) */}
        <circle cx="36" cy="46" r="6" fill="#4E342E" />
        <circle cx="50" cy="42" r="7" fill="#2E7D32" />
        <circle cx="64" cy="46" r="6" fill="#C62828" />
        <rect x="42" y="38" width="16" height="10" rx="3" fill="#D84315" />
        {/* Tortilla de maíz doblada */}
        <path d="M18 52C18 30 82 30 82 52V52C82 66 18 66 18 52Z" fill="#FFE082" stroke="#FFB300" strokeWidth="3" />
        <path d="M22 54C26 42 74 42 78 54" stroke="#FFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "cult_pinata",
    name: "Piñata",
    category: "Cultura Mexicana",
    color: "#00BCD4",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#0097A7" />
        {/* Centro de la piñata */}
        <circle cx="50" cy="50" r="14" fill="#FFEB3B" />
        {/* Picos de colores */}
        {/* Norte */}
        <polygon points="50,16 44,40 56,40" fill="#E91E63" />
        {/* Noreste */}
        <polygon points="76,28 58,42 66,54" fill="#FF5722" />
        {/* Sureste */}
        <polygon points="76,72 58,58 66,46" fill="#3F51B5" />
        {/* Sur */}
        <polygon points="50,84 44,60 56,60" fill="#4CAF50" />
        {/* Suroeste */}
        <polygon points="24,72 42,58 34,46" fill="#9C27B0" />
        {/* Noroeste */}
        <polygon points="24,28 42,42 34,54" fill="#00BCD4" />
      </svg>
    ),
  },

  // --- JALISCO (6) ---
  {
    id: "jal_agave",
    name: "Agave Azul",
    category: "Jalisco",
    color: "#4CAF50",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E0F2F1" />
        {/* Capas traseras */}
        <path d="M50 18L35 60L50 82L65 60Z" fill="#00796B" opacity="0.7" />
        {/* Capas intermedias */}
        <path d="M22 42L44 68L50 82L38 82Z" fill="#00897B" />
        <path d="M78 42L56 68L50 82L62 82Z" fill="#00897B" />
        {/* Capas frontales */}
        <path d="M50 28L42 68L50 82L58 68Z" fill="#00BFA5" />
        {/* Hojas laterales cortas */}
        <path d="M28 58L46 74L50 82Z" fill="#26A69A" />
        <path d="M72 58L54 74L50 82Z" fill="#26A69A" />
      </svg>
    ),
  },
  {
    id: "jal_torta_ahogada",
    name: "Torta Ahogada",
    category: "Jalisco",
    color: "#E64A19",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FBE9E7" />
        {/* Salsa roja en el plato */}
        <ellipse cx="50" cy="72" rx="34" ry="14" fill="#D84315" />
        {/* Pan de birote salado */}
        <path d="M24 50C24 40 76 40 76 50V56C76 60 24 60 24 56Z" fill="#8D6E63" stroke="#5D4037" strokeWidth="2.5" />
        {/* Corte medio con carnitas y cebolla */}
        <rect x="28" y="49" width="44" height="4" fill="#D7CCC8" />
        <circle cx="40" cy="49" r="4" fill="#E64A19" /> {/* Cebolla roja */}
        <circle cx="58" cy="49" r="3.5" fill="#FBC02D" /> {/* Limón chilito */}
        {/* Brillo salsa */}
        <path d="M38 72Q46 76 62 70" stroke="#FF7043" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "jal_jarrito",
    name: "Cantarito",
    category: "Jalisco",
    color: "#FF9800",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FFE0B2" />
        {/* Asa del cantarito */}
        <path d="M60 44C72 44 72 64 60 64" stroke="#D84315" strokeWidth="4.5" strokeLinecap="round" />
        {/* Jarrito de barro */}
        <path d="M34 32C34 26 66 26 66 32V36C66 40 60 42 60 48C60 66 58 76 50 76C42 76 40 66 40 48C40 42 34 40 34 36Z" fill="#E64A19" stroke="#9E2A2B" strokeWidth="2.5" />
        {/* Popote y limón */}
        <line x1="52" y1="20" x2="48" y2="38" stroke="#00C853" strokeWidth="3" strokeLinecap="round" />
        <circle cx="38" cy="30" r="5" fill="#4CAF50" />
        <circle cx="38" cy="30" r="3" fill="#81C784" />
      </svg>
    ),
  },
  {
    id: "jal_estadio",
    name: "Estadio Jalisco",
    category: "Jalisco",
    color: "#607D8B",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ECEFF1" />
        {/* Cancha verde central */}
        <ellipse cx="50" cy="50" rx="20" ry="14" fill="#4CAF50" />
        <ellipse cx="50" cy="50" rx="10" ry="7" stroke="#FFF" strokeWidth="1" fill="none" />
        {/* Graderías ovales concéntricas */}
        <ellipse cx="50" cy="50" rx="36" ry="25" stroke="#90A4AE" strokeWidth="5" fill="none" />
        <ellipse cx="50" cy="50" rx="42" ry="29" stroke="#CFD8DC" strokeWidth="3.5" fill="none" />
        {/* Columnas estructurales */}
        <line x1="14" y1="50" x2="8" y2="50" stroke="#37474F" strokeWidth="3" />
        <line x1="86" y1="50" x2="92" y2="50" stroke="#37474F" strokeWidth="3" />
        <line x1="50" y1="21" x2="50" y2="15" stroke="#37474F" strokeWidth="3" />
        <line x1="50" y1="79" x2="50" y2="85" stroke="#37474F" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: "jal_trompo_pastor",
    name: "Trompo de Pastor",
    category: "Jalisco",
    color: "#FF5722",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FFF3E0" />
        {/* Varilla central de metal */}
        <line x1="50" y1="14" x2="50" y2="86" stroke="#9E9E9E" strokeWidth="4" />
        {/* Trompo de carne apilada */}
        <path d="M30 40C30 30 70 30 70 40L60 72C56 78 44 78 40 72Z" fill="#E64A19" />
        {/* Capas marcadas del pastor */}
        <path d="M32 46Q50 51 68 46" stroke="#D84315" strokeWidth="2" strokeLinecap="round" />
        <path d="M34 54Q50 59 66 54" stroke="#D84315" strokeWidth="2" strokeLinecap="round" />
        <path d="M37 62Q50 67 63 62" stroke="#D84315" strokeWidth="2" strokeLinecap="round" />
        {/* Piña en la cima */}
        <polygon points="44,30 56,30 50,20" fill="#FFC107" />
        <rect x="46" y="27" width="8" height="5" fill="#FFA000" />
      </svg>
    ),
  },
  {
    id: "jal_barril_tequila",
    name: "Barril de Roble",
    category: "Jalisco",
    color: "#795548",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#EFEBE9" />
        {/* Barril de madera */}
        <path d="M32 24C40 24 60 24 68 24C78 40 78 60 68 76C60 76 40 76 32 76C22 60 22 40 32 24Z" fill="#5D4037" stroke="#3E2723" strokeWidth="2.5" />
        {/* Flejes metálicos negros */}
        <path d="M25 40Q50 44 75 40" stroke="#212121" strokeWidth="3" fill="none" />
        <path d="M25 60Q50 64 75 60" stroke="#212121" strokeWidth="3" fill="none" />
        {/* Líneas verticales de tablones */}
        <path d="M42 24Q46 50 42 76" stroke="#4E342E" strokeWidth="1.5" fill="none" />
        <path d="M50 24Q50 50 50 76" stroke="#4E342E" strokeWidth="1.5" fill="none" />
        <path d="M58 24Q54 50 58 76" stroke="#4E342E" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },

  // --- ANIMALES MEXICANOS (6) ---
  {
    id: "anim_ajolote",
    name: "Ajolotito",
    category: "Animales Mexicanos",
    color: "#FF80AB",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FFF0F5" />
        {/* Branquias externas de ajolote */}
        <path d="M24 40Q12 36 18 48Q12 56 24 52" stroke="#FF4081" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M76 40Q88 36 82 48Q88 56 76 52" stroke="#FF4081" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="20" cy="38" r="3" fill="#D81B60" />
        <circle cx="80" cy="38" r="3" fill="#D81B60" />
        {/* Rostro feliz */}
        <circle cx="50" cy="50" r="26" fill="#FF80AB" />
        {/* Ojos negros encendidos */}
        <circle cx="42" cy="46" r="3" fill="#1A1A1A" />
        <circle cx="58" cy="46" r="3" fill="#1A1A1A" />
        <circle cx="43" cy="45" r="1" fill="#FFF" />
        <circle cx="59" cy="45" r="1" fill="#FFF" />
        {/* Mejillas sonrosadas */}
        <circle cx="36" cy="52" r="3" fill="#FF4081" opacity="0.6" />
        <circle cx="64" cy="52" r="3" fill="#FF4081" opacity="0.6" />
        {/* Sonrisa tierna */}
        <path d="M46 54Q50 58 54 54" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "anim_jaguar",
    name: "Jaguar",
    category: "Animales Mexicanos",
    color: "#FFAB00",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#FFFDE7" />
        {/* Orejitas */}
        <polygon points="30,34 44,48 24,54" fill="#FFAB00" stroke="#FF8F00" strokeWidth="1.5" />
        <polygon points="70,34 56,48 76,54" fill="#FFAB00" stroke="#FF8F00" strokeWidth="1.5" />
        <circle cx="32" cy="44" r="4" fill="#FF6D00" />
        <circle cx="68" cy="44" r="4" fill="#FF6D00" />
        {/* Rostro jaguar */}
        <circle cx="50" cy="54" r="24" fill="#FFC107" />
        {/* Manchas de jaguar */}
        <circle cx="34" cy="58" r="2.5" fill="#212121" />
        <circle cx="66" cy="58" r="2.5" fill="#212121" />
        <circle cx="50" cy="38" r="3" fill="#212121" />
        <path d="M42 44C38 46 38 52 42 54" stroke="#212121" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M58 44C62 46 62 52 58 54" stroke="#212121" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Ojos felinos verdes */}
        <circle cx="42" cy="50" r="3.5" fill="#4CAF50" />
        <circle cx="58" cy="50" r="3.5" fill="#4CAF50" />
        <circle cx="42" cy="50" r="1.5" fill="#000" />
        <circle cx="58" cy="50" r="1.5" fill="#000" />
        {/* Hocico y nariz */}
        <path d="M46 58C46 64 54 64 54 58M50 58V62" stroke="#212121" strokeWidth="2" strokeLinecap="round" />
        <polygon points="47,56 53,56 50,59" fill="#121212" />
      </svg>
    ),
  },
  {
    id: "anim_aguila",
    name: "Águila Real",
    category: "Animales Mexicanos",
    color: "#795548",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E8EAF6" />
        {/* Plumaje café de fondo */}
        <path d="M30 46C20 64 36 84 50 84C64 84 80 64 70 46" fill="#4E342E" />
        {/* Cabeza blanca */}
        <circle cx="50" cy="44" r="18" fill="#FFFFFF" stroke="#D7CCC8" strokeWidth="1" />
        <path d="M34 46L42 58L50 48L58 58L66 46Z" fill="#FFFFFF" />
        {/* Gran pico agudo dorado */}
        <path d="M44 42L62 48L50 56C46 56 44 48 44 42Z" fill="#FFC107" />
        {/* Ojo enfocado */}
        <circle cx="42" cy="40" r="2.5" fill="#FFEB3B" />
        <circle cx="42" cy="40" r="1.2" fill="#121212" />
      </svg>
    ),
  },
  {
    id: "anim_zorro",
    name: "Zorro del Desierto",
    category: "Animales Mexicanos",
    color: "#FF5722",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ECEFF1" />
        {/* Orejitas de zorro */}
        <polygon points="26,30 42,50 18,52" fill="#E64A19" />
        <polygon points="74,30 58,50 82,52" fill="#E64A19" />
        <polygon points="28,34 39,48 23,50" fill="#FFF" opacity="0.8" />
        <polygon points="72,34 61,48 77,50" fill="#FFF" opacity="0.8" />
        {/* Rostro geométrico */}
        <polygon points="50,78 28,46 72,46" fill="#FF5722" />
        {/* Cachetes blancos */}
        <polygon points="50,78 28,46 36,66" fill="#FFFFFF" />
        <polygon points="50,78 72,46 64,66" fill="#FFFFFF" />
        {/* Ojos astutos negros */}
        <circle cx="39" cy="52" r="3" fill="#121212" />
        <circle cx="61" cy="52" r="3" fill="#121212" />
        {/* Nariz negra */}
        <circle cx="50" cy="76" r="3.5" fill="#121212" />
      </svg>
    ),
  },
  {
    id: "anim_tlacuache",
    name: "Tlacuache",
    category: "Animales Mexicanos",
    color: "#9E9E9E",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#F5F5F5" />
        {/* Orejas negras redondas */}
        <circle cx="34" cy="38" r="9" fill="#212121" />
        <circle cx="66" cy="38" r="9" fill="#212121" />
        <circle cx="34" cy="38" r="6" fill="#F48FB1" />
        <circle cx="66" cy="38" r="6" fill="#F48FB1" />
        {/* Cara */}
        <path d="M26 48C26 38 74 38 74 48L50 80Z" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="1" />
        {/* Parche del antifaz */}
        <ellipse cx="50" cy="52" rx="16" ry="7" fill="#616161" />
        {/* Ojos brillosos */}
        <circle cx="44" cy="52" r="3.2" fill="#000" />
        <circle cx="56" cy="52" r="3.2" fill="#000" />
        <circle cx="45" cy="51" r="1" fill="#FFF" />
        <circle cx="57" cy="51" r="1" fill="#FFF" />
        {/* Narizita rosa de tlacuache */}
        <ellipse cx="50" cy="78" rx="4.5" ry="3" fill="#F48FB1" />
      </svg>
    ),
  },
  {
    id: "anim_colibri",
    name: "Colibrí",
    category: "Animales Mexicanos",
    color: "#00E676",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E0F7FA" />
        {/* Alitas moradas dinámicas */}
        <path d="M30 42C12 28 42 22 42 42Z" fill="#7E57C2" />
        <path d="M34 50C18 38 43 34 41 50Z" fill="#9C27B0" opacity="0.6" />
        {/* Cuerpo efe de colibrí verde */}
        <path d="M32 64C48 64 68 54 62 40C52 28 44 48 32 64Z" fill="#00B0FF" />
        <circle cx="54" cy="42" r="10" fill="#00E676" />
        {/* Pico largo de colibrí */}
        <line x1="62" y1="41" x2="88" y2="34" stroke="#37474F" strokeWidth="2.5" strokeLinecap="round" />
        {/* Ojo */}
        <circle cx="54" cy="40" r="1.8" fill="#121212" />
      </svg>
    ),
  },

  // --- STEM (6) ---
  {
    id: "stem_robot",
    name: "Androide STEM",
    category: "STEM",
    color: "#0091EA",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#ECEFF1" />
        {/* Antena */}
        <line x1="50" y1="24" x2="50" y2="14" stroke="#78909C" strokeWidth="3" />
        <circle cx="50" cy="12" r="4" fill="#00E5FF" />
        {/* Orejas de tornillo */}
        <rect x="22" y="44" width="6" height="12" rx="2" fill="#546E7A" />
        <rect x="72" y="44" width="6" height="12" rx="2" fill="#546E7A" />
        {/* Cabeza de Robot */}
        <rect x="26" y="32" width="48" height="36" rx="8" fill="#78909C" stroke="#37474F" strokeWidth="2.5" />
        {/* Visor con ojos LED brillantes */}
        <rect x="32" y="40" width="36" height="14" rx="4" fill="#212121" />
        <circle cx="41" cy="47" r="3.5" fill="#00E5FF" />
        <circle cx="59" cy="47" r="3.5" fill="#00E5FF" />
        {/* Rejilla de boca */}
        <line x1="38" y1="60" x2="62" y2="60" stroke="#37474F" strokeWidth="2" />
        <line x1="44" y1="57" x2="44" y2="63" stroke="#37474F" strokeWidth="1.5" />
        <line x1="50" y1="57" x2="50" y2="63" stroke="#37474F" strokeWidth="1.5" />
        <line x1="56" y1="57" x2="56" y2="63" stroke="#37474F" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "stem_atomo",
    name: "Átomo",
    category: "STEM",
    color: "#673AB7",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#311B92" />
        {/* Órbitas de electrones */}
        <ellipse cx="50" cy="50" rx="38" ry="12" stroke="#00E5FF" strokeWidth="1.5" fill="none" transform="rotate(30 50 50)" />
        <ellipse cx="50" cy="50" rx="38" ry="12" stroke="#E040FB" strokeWidth="1.5" fill="none" transform="rotate(90 50 50)" />
        <ellipse cx="50" cy="50" rx="38" ry="12" stroke="#EEFF41" strokeWidth="1.5" fill="none" transform="rotate(150 50 50)" />
        {/* Electrones orbitando */}
        <circle cx="21" cy="34" r="3" fill="#EEFF41" />
        <circle cx="50" cy="12" r="3" fill="#E040FB" />
        <circle cx="79" cy="34" r="3" fill="#00E5FF" />
        {/* Núcleo central de protones */}
        <circle cx="46" cy="46" r="6" fill="#FF1744" />
        <circle cx="54" cy="48" r="6" fill="#2979FF" />
        <circle cx="50" cy="54" r="5.5" fill="#FFEB3B" />
      </svg>
    ),
  },
  {
    id: "stem_matraz",
    name: "Matraz",
    category: "STEM",
    color: "#9C27B0",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#F3E5F5" />
        {/* Vapor o burbujas */}
        <circle cx="42" cy="24" r="3" fill="#EA80FC" />
        <circle cx="58" cy="18" r="4.5" fill="#E045FB" />
        {/* Cuerpo del Matraz Erlenmeyer */}
        <path d="M42 32H58V44L72 70C74 74 71 78 66 78H34C29 78 26 74 28 70L42 44V32Z" fill="none" stroke="#6A1B9A" strokeWidth="3" />
        {/* Líquido coloreado */}
        <path d="M30 73L41 52H59L70 73C70 75 68 76 66 76H34C32 76 30 75 30 73Z" fill="#EA80FC" />
        {/* Líneas de graduación */}
        <line x1="45" y1="58" x2="52" y2="58" stroke="#FFF" strokeWidth="1.5" />
        <line x1="43" y1="66" x2="54" y2="66" stroke="#FFF" strokeWidth="1.5" />
        {/* Borde cuello */}
        <rect x="40" y="28" width="20" height="4" rx="1.5" fill="#6A1B9A" />
      </svg>
    ),
  },
  {
    id: "stem_cohete",
    name: "Cohete Espacial",
    category: "STEM",
    color: "#FF5722",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#0D47A1" />
        {/* Fuego de propulsión */}
        <polygon points="50,86 42,74 58,74" fill="#FF3D00" />
        <polygon points="50,82 46,74 54,74" fill="#FFC107" />
        {/* Alerones laterales del cohete */}
        <path d="M32 72V58L42 66H32Z" fill="#D32F2F" />
        <path d="M68 72V58L58 66H68Z" fill="#D32F2F" />
        {/* Cuerpo principal del cohete */}
        <rect x="42" y="28" width="16" height="42" rx="8" fill="#FFFFFF" />
        <path d="M42 36C42 20 58 20 58 36V40H42V36Z" fill="#D32F2F" />
        {/* Ojo buey/ventana redonda */}
        <circle cx="50" cy="46" r="5" fill="#90CAF9" stroke="#37474F" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "stem_microscopio",
    name: "Microscopio",
    category: "STEM",
    color: "#4CAF50",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E8F5E9" />
        {/* Brazo curvo e inclinador */}
        <path d="M64 42C64 30 52 28 50 28V36C50 36 58 36 58 42C58 48 46 54 46 54" stroke="#546E7A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* Platina portaobjetos */}
        <rect x="32" y="60" width="30" height="4" rx="1" fill="#212121" />
        <line x1="42" y1="58" x2="48" y2="58" stroke="#00E676" strokeWidth="2" /> {/* Luz de muestra */}
        {/* Tubo óptico visor */}
        <rect x="36" y="26" width="8" height="24" rx="2" fill="#78909C" transform="rotate(-15 36 26)" />
        <rect x="42" y="20" width="6" height="5" rx="1" fill="#37474F" transform="rotate(-15 42 20)" /> {/* Ocular */}
        {/* Base sólida */}
        <rect x="32" y="70" width="36" height="8" rx="2" fill="#37474F" />
        <line x1="50" y1="64" x2="50" y2="70" stroke="#37474F" strokeWidth="4" />
      </svg>
    ),
  },
  {
    id: "stem_adn",
    name: "Hélice ADN",
    category: "STEM",
    color: "#00E5FF",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#263238" />
        {/* Enlaces nucleótidos y bases */}
        <line x1="34" y1="28" x2="66" y2="28" stroke="#D81B60" strokeWidth="2.5" />
        <line x1="38" y1="38" x2="62" y2="38" stroke="#00C853" strokeWidth="2.5" />
        <line x1="42" y1="50" x2="58" y2="50" stroke="#00B0FF" strokeWidth="2.5" />
        <line x1="38" y1="62" x2="62" y2="62" stroke="#FFD600" strokeWidth="2.5" />
        <line x1="34" y1="72" x2="66" y2="72" stroke="#AA00FF" strokeWidth="2.5" />
        {/* Hebras helicoidales */}
        <path d="M30 20Q50 50 30 80" stroke="#00E5FF" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M70 20Q50 50 70 80" stroke="#FF1744" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Nodos fosfato */}
        <circle cx="34" cy="28" r="3.5" fill="#00E5FF" />
        <circle cx="66" cy="28" r="3.5" fill="#FF1744" />
        <circle cx="38" cy="38" r="3.5" fill="#00E5FF" />
        <circle cx="62" cy="38" r="3.5" fill="#FF1744" />
        <circle cx="50" cy="50" r="3.5" fill="#00E5FF" />
        <circle cx="38" cy="62" r="3.5" fill="#FF1744" />
        <circle cx="62" cy="62" r="3.5" fill="#00E5FF" />
        <circle cx="34" cy="72" r="3.5" fill="#FF1744" />
        <circle cx="66" cy="72" r="3.5" fill="#00E5FF" />
      </svg>
    ),
  },

  // --- PROFESIONES (6) ---
  {
    id: "prof_cientifico",
    name: "Científico",
    category: "Profesiones",
    color: "#3F51B5",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#1A237E" />
        {/* Pelo alocado científico */}
        <path d="M22 46C18 30 50 20 50 20C50 20 82 30 78 46C74 50 26 50 22 46Z" fill="#CFD8DC" />
        {/* Rostro */}
        <circle cx="50" cy="54" r="16" fill="#FFE0B2" />
        {/* Anteojos grandes redondos */}
        <circle cx="44" cy="52" r="6" stroke="#212121" strokeWidth="2.5" fill="none" />
        <circle cx="56" cy="52" r="6" stroke="#212121" strokeWidth="2.5" fill="none" />
        <line x1="50" y1="52" x2="50" y2="52" stroke="#212121" strokeWidth="2.5" />
        {/* Bata de laboratorio */}
        <path d="M34 70L50 84L66 70" stroke="#FFF" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M46 70L50 78L54 70" stroke="#F44336" strokeWidth="2" /> {/* Corbata o camisa */}
      </svg>
    ),
  },
  {
    id: "prof_cientifica",
    name: "Científica",
    category: "Profesiones",
    color: "#673AB7",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#512DA8" />
        {/* Pelo y ponytail morada */}
        <circle cx="30" cy="38" r="7" fill="#FFD54F" />
        <circle cx="70" cy="38" r="7" fill="#FFD54F" />
        <path d="M30 46C30 30 70 30 70 46V54H30V46Z" fill="#FFD54F" />
        {/* Rostro feliz */}
        <circle cx="50" cy="54" r="16" fill="#FAD1A5" />
        <circle cx="43" cy="52" r="1.5" fill="#000" />
        <circle cx="57" cy="52" r="1.5" fill="#000" />
        {/* Lentes modernos morados */}
        <rect x="36" y="47" width="12" height="8" rx="2" stroke="#E040FB" strokeWidth="2" fill="none" />
        <rect x="52" y="47" width="12" height="8" rx="2" stroke="#E040FB" strokeWidth="2" fill="none" />
        {/* Bata blanca */}
        <path d="M34 70L50 84L66 70Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: "prof_docente",
    name: "Docente",
    category: "Profesiones",
    color: "#009688",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E0F2F1" />
        {/* Pelo formal arreglado */}
        <path d="M32 38C32 24 68 24 68 38V44H32V38Z" fill="#5D4037" />
        {/* Cara */}
        <circle cx="50" cy="50" r="16" fill="#FFD1A9" />
        {/* Lentes de lectura */}
        <rect x="38" y="46" width="10" height="7" rx="1.5" stroke="#3E2723" strokeWidth="2" fill="none" />
        <rect x="52" y="46" width="10" height="7" rx="1.5" stroke="#3E2723" strokeWidth="2" fill="none" />
        {/* Libro rojo o manzana en la base */}
        <rect x="42" y="66" width="16" height="12" rx="2" fill="#D32F2F" />
        <line x1="50" y1="66" x2="50" y2="78" stroke="#FFF" strokeWidth="2" />
        {/* Pizarra verde pequeña de fondo */}
        <rect x="14" y="60" width="20" height="15" rx="1" fill="#004D40" stroke="#8D6E63" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "prof_abogado",
    name: "Abogado",
    category: "Profesiones",
    color: "#455A64",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#37474F" />
        {/* Cabello gris sobrio */}
        <path d="M32 36C32 25 68 25 68 36V40H32V36Z" fill="#90A4AE" />
        {/* Rostro */}
        <circle cx="50" cy="50" r="15" fill="#FFE0B2" />
        <circle cx="44" cy="46" r="1.5" fill="#000" />
        <circle cx="56" cy="46" r="1.5" fill="#000" />
        {/* Traje de abogado */}
        <path d="M32 64L50 82L68 64Z" fill="#1A237E" />
        {/* Camisa blanca y corbata */}
        <path d="M46 64L50 72L54 64Z" fill="#FFF" />
        <line x1="50" y1="64" x2="50" y2="78" stroke="#D32F2F" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    id: "prof_medica",
    name: "Médica",
    category: "Profesiones",
    color: "#00B0FF",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E1F5FE" />
        {/* Cabello castaño castrado */}
        <path d="M30 42C30 26 70 26 70 42V50H30V42Z" fill="#8D6E63" />
        {/* Cara */}
        <circle cx="50" cy="50" r="15" fill="#FAD1A5" />
        {/* Estetoscopio */}
        <path d="M38 52C38 66 62 66 62 52" stroke="#B0BEC5" strokeWidth="2.5" fill="none" />
        <circle cx="50" cy="62" r="3.5" fill="#37474F" />
        {/* Cruz de salud roja en copete */}
        <circle cx="50" cy="30" r="9" fill="#E53935" />
        <path d="M50 25V35M45 30H55" stroke="#FFF" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "prof_ingeniera",
    name: "Ingeniera",
    category: "Profesiones",
    color: "#FFEB3B",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#3E2723" />
        {/* Rostro ingeniera */}
        <circle cx="50" cy="56" r="15" fill="#FFE0B2" />
        {/* Casco amarillo de seguridad */}
        <ellipse cx="50" cy="40" rx="20" ry="12" fill="#FFEB3B" />
        <rect x="32" y="38" width="36" height="4" rx="1.5" fill="#FFA000" />
        {/* Engrane en casco */}
        <circle cx="50" cy="32" r="3" fill="#3E2723" />
        <circle cx="50" cy="32" r="1.5" fill="#FFEB3B" />
        {/* Ojos */}
        <circle cx="44" cy="54" r="1.5" fill="#000" />
        <circle cx="56" cy="54" r="1.5" fill="#000" />
        {/* Chaleco naranja de seguridad */}
        <path d="M32 72L50 86L68 72" stroke="#FF5722" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M44 72L50 80L56 72" stroke="#FFEB3B" strokeWidth="2" />
      </svg>
    ),
  },

  // --- DEPORTES (6) ---
  {
    id: "dep_futbolista",
    name: "Futbolista",
    category: "Deportes",
    color: "#4CAF50",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#1B5E20" />
        {/* Balón de fútbol geométrico */}
        <circle cx="50" cy="50" r="24" fill="#FFFFFF" stroke="#000" strokeWidth="1.5" />
        {/* Paneles del balón */}
        <polygon points="50,38 58,44 55,54 45,54 42,44" fill="#121212" />
        <line x1="50" y1="38" x2="50" y2="26" stroke="#000" strokeWidth="1.5" />
        <line x1="58" y1="44" x2="68" y2="40" stroke="#000" strokeWidth="1.5" />
        <line x1="55" y1="54" x2="62" y2="66" stroke="#000" strokeWidth="1.5" />
        <line x1="45" y1="54" x2="38" y2="66" stroke="#000" strokeWidth="1.5" />
        <line x1="42" y1="44" x2="32" y2="40" stroke="#000" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "dep_boxeador",
    name: "Boxeador",
    category: "Deportes",
    color: "#F44336",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#B71C1C" />
        {/* Dos guantes de box cruzados */}
        <path d="M26 56C26 44 42 40 42 56V66H26V56Z" fill="#EF5350" stroke="#3E2723" strokeWidth="1.5" />
        <rect x="24" y="64" width="20" height="6" rx="1.5" fill="#FFFFFF" />
        <path d="M74 56C74 44 58 40 58 56V66H74V56Z" fill="#EF5350" stroke="#3E2723" strokeWidth="1.5" />
        <rect x="56" y="64" width="20" height="6" rx="1.5" fill="#FFFFFF" />
        {/* Brillos */}
        <circle cx="32" cy="50" r="3" fill="#FFEB3B" />
        <circle cx="68" cy="50" r="3" fill="#FFEB3B" />
      </svg>
    ),
  },
  {
    id: "dep_luchador",
    name: "Luchador",
    category: "Deportes",
    color: "#E91E63",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#880E4F" />
        {/* Cinturón de campeón oro */}
        <rect x="22" y="44" width="56" height="12" rx="2" fill="#E91E63" stroke="#FFD700" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="11" fill="#FFD700" />
        <polygon points="50,44 53,49 59,50 54,54 56,60 50,56 44,60 46,54 41,50 47,49" fill="#FF5722" />
        {/* Brillo */}
        <circle cx="30" cy="50" r="2" fill="#FFF" />
        <circle cx="70" cy="50" r="2" fill="#FFF" />
      </svg>
    ),
  },
  {
    id: "dep_corredor",
    name: "Velocista",
    category: "Deportes",
    color: "#FF9800",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#E65100" />
        {/* Tenis para correr con alitas */}
        <path d="M22 66L32 42L66 42C74 42 78 52 74 66H22Z" fill="#FFFFFF" stroke="#0D47A1" strokeWidth="2" />
        {/* Agujetas */}
        <line x1="38" y1="42" x2="35" y2="34" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />
        <line x1="44" y1="42" x2="41" y2="34" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round" />
        {/* Alitas doradas */}
        <path d="M22 56C10 50 20 38 28 46" stroke="#FFD700" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M22 62C12 56 22 46 28 52" stroke="#FFD700" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "dep_ciclista",
    name: "Ciclista",
    category: "Deportes",
    color: "#00E676",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#121212" />
        {/* Plato dentado de cadena */}
        <circle cx="50" cy="50" r="32" stroke="#D81B60" strokeWidth="3" strokeDasharray="6 4" fill="none" />
        {/* Biela del pedal */}
        <line x1="50" y1="50" x2="50" y2="24" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="76" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
        {/* Pedales */}
        <rect x="42" y="18" width="16" height="6" rx="1.5" fill="#FFD54F" />
        <rect x="42" y="76" width="16" height="6" rx="1.5" fill="#FFD54F" />
      </svg>
    ),
  },
  {
    id: "dep_pesista",
    name: "Halterófilo",
    category: "Deportes",
    color: "#2979FF",
    render: (size) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="#0D47A1" />
        {/* Barra metálica */}
        <line x1="12" y1="50" x2="88" y2="50" stroke="#ECEFF1" strokeWidth="4" />
        {/* Discos de pesas izquierdo */}
        <rect x="22" y="32" width="6" height="36" rx="2" fill="#E53935" />
        <rect x="16" y="36" width="6" height="28" rx="2" fill="#FFEB3B" />
        {/* Discos de pesas derecho */}
        <rect x="72" y="32" width="6" height="36" rx="2" fill="#E53935" />
        <rect x="78" y="36" width="6" height="28" rx="2" fill="#FFEB3B" />
        {/* Agarre de mano (fuerza) */}
        <circle cx="50" cy="50" r="10" stroke="#FFF" strokeWidth="2.5" strokeDasharray="3 3" fill="none" />
      </svg>
    ),
  },
];

export function getAvatarById(id?: string): AvatarItem {
  if (!id) {
    return AVATAR_LIST[0]; // Retorna el primero por defecto
  }
  const found = AVATAR_LIST.find((a) => a.id === id);
  return found || AVATAR_LIST[0];
}

interface AvatarRendererProps {
  id?: string;
  size?: number;
  className?: string;
}

export const AvatarRenderer: React.FC<AvatarRendererProps> = ({
  id,
  size = 48,
  className = "",
}) => {
  const avatar = getAvatarById(id);
  return (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {avatar.render(size)}
    </div>
  );
};
