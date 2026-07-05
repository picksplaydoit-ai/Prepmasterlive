import { buildJoinUrl } from "./joinUrlService";

export interface DiagnosticResult {
  expressOk: boolean;
  socketOk: boolean;
  sqliteOk: boolean;
  ipDetected: boolean;
  ip: string;
  port: number;
  qrOk: boolean;
  localNetworkOk: boolean;
  deviceCount: number;
  joinUrl: string;
  errorMessage: string | null;
  suggestion: string | null;
}

export async function runFullDiagnostic(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    expressOk: false,
    socketOk: false,
    sqliteOk: false,
    ipDetected: false,
    ip: "No detectada",
    port: 3000,
    qrOk: false,
    localNetworkOk: false,
    deviceCount: 0,
    joinUrl: "",
    errorMessage: null,
    suggestion: null
  };

  try {
    const res = await fetch("/api/network-diagnostic");
    if (!res.ok) throw new Error("Express no responde");
    const data = await res.json();
    
    result.expressOk = true;
    result.socketOk = typeof data.deviceCount === "number"; 
    result.deviceCount = data.deviceCount || 0;
    result.ip = data.preferredIP || "No detectada";
    result.port = data.port || 3000;
    
    if (result.ip && result.ip !== "localhost" && result.ip !== "127.0.0.1") {
      result.ipDetected = true;
      result.localNetworkOk = true; 
    }
  } catch (e) {
    result.errorMessage = "El servidor interno no está respondiendo.";
    return result; // Cannot continue if Express is down
  }

  try {
    const res = await fetch("/api/questionnaires");
    if (res.ok) {
      result.sqliteOk = true;
    }
  } catch (e) {
    result.sqliteOk = false;
  }

  try {
    const mockPin = "TEST";
    const url = await buildJoinUrl({ pin: mockPin });
    result.joinUrl = url.replace("?pin=TEST", ""); // just get base url
    if (result.joinUrl) {
      result.qrOk = true;
    }
  } catch (e) {
    if (!result.errorMessage) {
      result.errorMessage = "No fue posible generar el enlace para estudiantes.";
    }
  }

  // If no IP is detected, set standard help message
  if (!result.ipDetected) {
    result.errorMessage = "No se detectó una red local.";
    result.suggestion = "Si los estudiantes no pueden ingresar, conecta la computadora a una red Wi-Fi o utiliza la Zona con cobertura inalámbrica móvil (Hotspot) de Windows.";
  }

  // If all is well but no IP
  if (result.ipDetected && result.expressOk && result.sqliteOk && result.socketOk && result.qrOk) {
    // All good
  }

  return result;
}
