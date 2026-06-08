import { useState, useEffect } from "react";
import { 
  Activity, Wifi, WifiOff, AlertTriangle, CheckCircle2, XCircle, Globe, Server, 
  Smartphone, Network, RefreshCw, Download, QrCode, HelpCircle, Laptop, ShieldAlert
} from "lucide-react";

interface DiagnosticData {
  networkName: string;
  preferredIP: string;
  port: number;
  serverStatus: string;
  deviceCount: number;
  internetConnected: boolean;
  localUrl: string;
  appUrl: string;
  qrLocal: string;
  qrApp: string;
}

export default function NetworkDiagnostic() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [testAccessOpen, setTestAccessOpen] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh network diagnostics every 5 seconds
  const runDiagnostic = async (silent = false) => {
    if (!silent) setLoading(true);
    const start = Date.now();
    try {
      const res = await fetch("/api/network-diagnostic");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLatency(Date.now() - start);
        setError(null);
      } else {
        setError("El servidor respondió con un código de error.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servicio de diagnóstico del servidor.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
    const interval = setInterval(() => {
      runDiagnostic(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Increment seconds elapsed to track 30-seconds "no devices connected" threshold
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    runDiagnostic();
  };

  // Determine overall connectivity status color
  // Verde: Servidor operativo y al menos 1 dispositivo conectado.
  // Amarillo: Servidor operativo pero ningún dispositivo conectado.
  // Rojo: Error de respuesta del servidor.
  const getStatus = (): "green" | "yellow" | "red" => {
    if (error || !data) return "red";
    if (data.deviceCount === 0) return "yellow";
    return "green";
  };

  const statusType = getStatus();

  // Export TXT Report handler
  const downloadReport = () => {
    if (!data) return;
    const dateStr = new Date().toISOString();
    const errorsList: string[] = [];
    if (!data.internetConnected) {
      errorsList.push("Sin conexión a internet activa (No afecta partidas locales, pero limita acceso remoto).");
    }
    if (data.deviceCount === 0) {
      errorsList.push("Ningún alumno o dispositivo conectado en el puerto local.");
    }
    if (error) {
      errorsList.push(`Error de conexión al servidor: ${error}`);
    }

    const content = `========================================================
REPORTE DE DIAGNÓSTICO DE RED Y CONECTIVIDAD LOCAL
PREPMASTER LIVE - VERSION 2.0.1
========================================================
Fecha del Reporte: ${dateStr}
Dirección IP Local Detectada: ${data.preferredIP}
Puerto del Servidor: ${data.port}
Estado del Servidor: ${error ? "OFFLINE / ERROR" : "ONLINE / ACCESIBLE"}
Nombre de la Interfaz de Red: ${data.networkName}
Latencia del Servidor: ${latency !== null ? `${latency}ms` : "N/D"}

DETALLES DE CONECTIVIDAD:
--------------------------------------------------------
- Conexión a Internet: ${data.internetConnected ? "ACTIVA / TRÁFICO CORRECTO" : "INACTIVA / SOLO LOCAL"}
- Dispositivos Conectados: ${data.deviceCount} dispositivo(s) activo(s) en sockets.io
- Dirección URL de la partida: ${data.appUrl}

ERRORES O ADVERTENCIAS DETECTADAS:
--------------------------------------------------------
${errorsList.length === 0 ? "- Ningún problema detectado. Excelente estado local." : errorsList.map((e, idx) => `${idx + 1}. ${e}`).join("\n")}

SUGERENCIAS DE RESOLUCIÓN DE CONTEXTO:
--------------------------------------------------------
1. Si los alumnos están en la misma red Wi-Fi pero no pueden entrar, valide que el "Aislamiento de AP (AP Isolation)" esté deshabilitado en el enrutador físico.
2. Compruebe las directivas de seguridad en el "Firewall de Windows" habilitando permisos para Node.js / Puerto ${data.port}.
3. Considere levantar un Hotspot Inalámbrico local desde esta computadora portátil si la red escolar cuenta con restricciones de aislamiento.
========================================================
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostico_red_prepmaster_${data.preferredIP.replace(/\./g, "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-6 shadow-md transition-all text-left" id="network-diagnostic-root">
      
      {/* Header and indicator lights wrapper */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-slate-200">
              ⚡ Utilidad de Red v2.0.1
            </span>
            
            {/* Round status dot */}
            <span className="flex items-center gap-1.5 text-xs font-black">
              <span className={`w-2.5 h-2.5 rounded-full ${
                statusType === "green" 
                  ? "bg-emerald-500 animate-pulse" 
                  : statusType === "yellow" 
                    ? "bg-amber-400 animate-pulse" 
                    : "bg-rose-500 animate-pulse"
              }`} />
              <span className={`${
                statusType === "green" 
                  ? "text-emerald-700" 
                  : statusType === "yellow" 
                    ? "text-amber-600" 
                    : "text-rose-600"
              }`}>
                {statusType === "green" && "Servidor Listo y Alumnos Conectados"}
                {statusType === "yellow" && "Sin alumnos conectados todavía"}
                {statusType === "red" && "Error de Conexión del Servidor"}
              </span>
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-900 font-sans">
            Diagnóstico de Red y Conectividad Local
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Verifica el canal de transmisión de tu salón de clase para que tus alumnos jueguen sin cortes ni problemas.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl cursor-pointer disabled:opacity-40"
            title="Refrescar diagnósticos"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>

          <button
            onClick={downloadReport}
            disabled={!data}
            className="px-4 py-2 bg-indigo-550 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-300 text-white font-sans font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download size={14} />
            <span>Exportar Diagnóstico (.txt)</span>
          </button>
        </div>
      </div>

      {/* Auto verification checklist (Requisito 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Verification Item 1: Server Status */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          error 
            ? "bg-rose-50 border-rose-150 text-rose-850" 
            : data 
              ? "bg-emerald-50/60 border-emerald-150 text-emerald-900" 
              : "bg-slate-50 border-slate-150"
        }`}>
          {error ? (
            <XCircle size={22} className="text-rose-500 shrink-0" />
          ) : data ? (
            <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
          ) : (
            <RefreshCw size={22} className="text-slate-400 animate-spin shrink-0" />
          )}
          <div className="text-left font-sans">
            <p className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-400">Verificación Servidor</p>
            <p className="text-xs font-black">
              {error ? "Fallo de respuesta" : data ? `Activo (${latency || 3}ms)` : "Verificando..."}
            </p>
          </div>
        </div>

        {/* Verification Item 2: IP Detection */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          !data 
            ? "border-slate-150 bg-slate-50" 
            : data.preferredIP && data.preferredIP !== "localhost"
              ? "bg-emerald-50/60 border-emerald-150 text-emerald-900" 
              : "bg-amber-50 border-amber-150 text-amber-900"
        }`}>
          {data && data.preferredIP && data.preferredIP !== "localhost" ? (
            <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
          ) : data ? (
            <AlertTriangle size={22} className="text-amber-500 shrink-0" />
          ) : (
            <RefreshCw size={22} className="text-slate-400 animate-spin shrink-0" />
          )}
          <div className="text-left font-sans">
            <p className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-400">IP del Servidor</p>
            <p className="text-xs font-black truncate max-w-[130px]">
              {data ? data.preferredIP : "Detectando IP..."}
            </p>
          </div>
        </div>

        {/* Verification Item 3: Internet Connectivity */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          !data 
            ? "border-slate-150 bg-slate-50" 
            : data.internetConnected
              ? "bg-emerald-50/60 border-emerald-150 text-emerald-900" 
              : "bg-amber-50 border-amber-150 text-amber-900"
        }`}>
          {data && data.internetConnected ? (
            <Globe size={22} className="text-emerald-500 shrink-0" />
          ) : data ? (
            <WifiOff size={22} className="text-amber-500 shrink-0" />
          ) : (
            <RefreshCw size={22} className="text-slate-400 animate-spin shrink-0" />
          )}
          <div className="text-left font-sans">
            <p className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-400">Conexión Internet</p>
            <p className="text-xs font-black">
              {data ? (data.internetConnected ? "Disponible / Activa" : "Sin Internet / Solo Local") : "Analizando..."}
            </p>
          </div>
        </div>

      </div>

      {/* Network technical parameters and telemetry block */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-150 bg-slate-50 rounded-2xl">
          <div className="text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 font-mono">Nombre de Interfaz de Red</span>
            <p className="text-xs font-bold text-slate-700 font-sans truncate" title={data.networkName}>{data.networkName}</p>
          </div>
          <div className="text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 font-mono">IP Local Activa</span>
            <p className="text-xs font-bold text-slate-700 font-mono">{data.preferredIP}</p>
          </div>
          <div className="text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 font-mono">Puerto de Red</span>
            <p className="text-xs font-bold text-slate-700 font-mono">{data.port || 3000}</p>
          </div>
          <div className="text-left bg-indigo-50/40 p-2 rounded-lg border border-indigo-100">
            <span className="text-[9px] font-black uppercase text-indigo-500 font-mono">Conectados al Servidor</span>
            <p className="text-xs font-extrabold text-slate-800 font-sans">{data.deviceCount} celulares / alumnos</p>
          </div>
        </div>
      )}

      {/* Local access testing drawer tool (Requisito 4) */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => setTestAccessOpen(!testAccessOpen)}
          className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100 text-slate-850 text-xs font-bold flex justify-between items-center transition-colors cursor-pointer border-none"
        >
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-indigo-650" />
            <span className="text-xs font-extrabold">Probar acceso desde otros dispositivos</span>
          </div>
          <span className="text-xs opacity-50">{testAccessOpen ? "Ocultar panel" : "Ver código QR e instrucciones"}</span>
        </button>

        {testAccessOpen && data && (
          <div className="p-5 sm:p-6 bg-white border-t border-slate-150 space-y-5 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Left Column: Instructions */}
              <div className="space-y-3.5 text-left text-xs font-sans text-slate-650 font-semibold">
                <h4 className="text-xs font-black text-slate-850 uppercase tracking-wide">Instrucciones Sencillas:</h4>
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                    <p className="text-[11.5px] leading-relaxed">Conecta tu teléfono celular o tableta a la **misma red Wi-Fi** que esta computadora portátil.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                    <p className="text-[11.5px] leading-relaxed">Escanea el **código QR de la derecha** con la cámara de tu celular, o abre el navegador e ingresa la dirección: <br/>
                      <strong className="text-indigo-600 font-mono select-all font-black text-xs leading-none bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150">{data.appUrl}</strong>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                    <p className="text-[11.5px] leading-relaxed">Deberías ver la pantalla del alumno unida en cuestión de segundos. Si la página no logra cargar, revisa los posibles bloqueos técnicos abajo.</p>
                  </div>
                </div>
              </div>

              {/* Right Column: QR Render card */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-150 rounded-2xl hover:shadow-xs transition-shadow">
                {data.qrApp ? (
                  <img 
                    src={data.qrApp} 
                    alt="Acceso Código QR"
                    referrerPolicy="no-referrer"
                    className="w-40 h-40 object-contain bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-40 h-40 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs font-bold leading-normal font-mono">
                    QR no disponible
                  </div>
                )}
                <span className="text-[10px] text-slate-450 mt-2 font-mono font-bold uppercase tracking-wider">URL de acceso rápido</span>
                <span className="text-[11px] text-indigo-650 font-mono font-extrabold mt-0.5 select-all">{data.appUrl}</span>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Intelligent diagnostics panel (Requisito 5) */}
      {data && data.deviceCount === 0 && secondsElapsed >= 30 && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-4 text-left font-sans" id="intelligent-diagnostic-card">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-rose-600 animate-bounce" />
            <span className="text-xs font-black text-rose-800 uppercase tracking-wide">
              ⚠️ Diagnóstico Inteligente: Se detecta que ningún celular ha logrado conectarse todavía (30s de inactividad)
            </span>
          </div>

          <p className="text-xs text-rose-700 font-semibold max-w-xl">
            Aunque el servidor local está activo, las conexiones entrantes desde otros dispositivos parecen estar bloqueadas. Esto se debe típicamente a uno de los siguientes factores:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white border border-rose-100 p-3.5 rounded-xl space-y-1.5 shadow-2xs">
              <h5 className="text-[11px] font-black text-rose-900 uppercase tracking-widest font-mono">1. Firewall de Windows</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                El sistema de seguridad de Windows puede estar bloqueando las conexiones entrantes al puerto {data.port}. <br/>
                <strong>Solución:</strong> Permite el tráfico entrante a tu programa `Node.js` o habilita acceso de red privada en la configuración de Redes de Windows.
              </p>
            </div>

            <div className="bg-white border border-rose-100 p-3.5 rounded-xl space-y-1.5 shadow-2xs">
              <h5 className="text-[11px] font-black text-rose-900 uppercase tracking-widest font-mono">2. Red Universitaria o Escolar</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Las redes institucionales o de campus suelen prohibir de forma intencionada que los dispositivos se comuniquen entre sí directamente de forma lateral. <br/>
                <strong>Solución:</strong> Cambia al <strong>Modo Hotspot</strong> sugerido a continuación.
              </p>
            </div>

            <div className="bg-white border border-rose-100 p-3.5 rounded-xl space-y-1.5 shadow-2xs">
              <h5 className="text-[11px] font-black text-rose-900 uppercase tracking-widest font-mono">3. AP Isolation (Aislamiento AP)</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Muchos enrutadores domésticos o de salón tienen activo un filtro que aísla al cliente del resto de los clientes del router inalámbrico. <br/>
                <strong>Solución:</strong> Deshabilítalo desde el portal de administración del router Wi-Fi físico.
              </p>
            </div>

            <div className="bg-white border border-rose-105 p-3.5 rounded-xl space-y-1.5 shadow-2xs">
              <h5 className="text-[11px] font-black text-rose-900 uppercase tracking-widest font-mono">4. Puerto de Transmisión Bloqueado</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Otro proceso en tu computadora posee el puerto {data.port} reservado, lo que confunde a las llamadas. <br/>
                <strong>Solución:</strong> Cierra otras pestañas o programas servidores activos antes de iniciar el transmisor Prepmaster.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Guide: Hotspot Mode (Requisito 6) */}
      <div className="bg-indigo-50/50 border border-indigo-150 p-5 rounded-2xl text-left font-sans space-y-3.5">
        <div className="flex items-center gap-2">
          <Laptop size={18} className="text-indigo-600" />
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wide">
            ¿Los alumnos no pueden conectarse? Solución: Activar Modo Hotspot
          </h4>
        </div>

        <p className="text-[11px] text-indigo-750 font-semibold max-w-xl leading-normal">
          Si la red inalámbrica de tu escuela o universidad bloquea la comunicación privada local, puedes evitarlo creando tu propio canal cerrado de comunicación directamente desde tu computadora portátil.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          <div className="bg-white border border-indigo-100 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-indigo-500 font-mono block">PASO 1</span>
            <p className="text-[10px] font-bold text-slate-650 mt-1 leading-relaxed">
              Activa la opción **Zona con cobertura inalámbrica móvil (Hotspot)** en la barra de tareas de tu Laptop.
            </p>
          </div>

          <div className="bg-white border border-indigo-100 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-indigo-500 font-mono block">PASO 2</span>
            <p className="text-[10px] font-bold text-slate-650 mt-1 leading-relaxed">
              Diles a tus alumnos que conecten sus teléfonos celulares a la red Wi-Fi emitida por tu laptop.
            </p>
          </div>

          <div className="bg-white border border-indigo-100 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-indigo-500 font-mono block">PASO 3</span>
            <p className="text-[10px] font-bold text-slate-650 mt-1 leading-relaxed">
              Vuelve a presionar el botón de **Generar QR / Recargar** en Prepmaster para actualizar los parámetros.
            </p>
          </div>

          <div className="bg-white border border-indigo-100 p-3 rounded-xl flex items-center justify-center">
            <button
              onClick={handleRefresh}
              className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-sans font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <RefreshCw size={11} />
              <span>Actualizar QR e IP</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
