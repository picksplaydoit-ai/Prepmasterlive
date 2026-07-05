import { useState, useEffect } from "react";
import { runFullDiagnostic, DiagnosticResult } from "../services/networkDiagnosticService";
import { CheckCircle2, XCircle, Copy, RefreshCw, Info } from "lucide-react";

export default function NetworkDiagnostic() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const runTest = async () => {
    setLoading(true);
    const result = await runFullDiagnostic();
    setDiagnostic(result);
    setLoading(false);
  };

  useEffect(() => {
    runTest();
  }, []);

  const handleCopy = () => {
    if (diagnostic?.joinUrl) {
      navigator.clipboard.writeText(diagnostic.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !diagnostic) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
        <h3 className="font-sans font-bold text-slate-700">Verificando sistema...</h3>
      </div>
    );
  }

  const isAllGood = diagnostic && diagnostic.expressOk && diagnostic.socketOk && diagnostic.sqliteOk && diagnostic.ipDetected && diagnostic.qrOk;

  const StatusItem = ({ label, value, ok }: { label: string; value?: string | number; ok: boolean }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="flex items-center gap-3">
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
        )}
        <span className="font-sans font-semibold text-slate-700 text-sm">{label}</span>
      </div>
      {value !== undefined && (
        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
          {value}
        </span>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 max-w-2xl mx-auto text-left" id="network-diagnostic-root">
      
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-slate-900 font-sans tracking-tight mb-2">Diagnóstico de Conexión</h2>
        <p className="text-sm text-slate-500 font-medium font-sans">
          Verifica que todo el sistema esté listo antes de iniciar la actividad con los estudiantes.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <StatusItem label="Servidor interno (Express)" ok={diagnostic?.expressOk || false} />
        <StatusItem label="Conexiones en tiempo real (Socket.io)" ok={diagnostic?.socketOk || false} value={diagnostic?.deviceCount ? `${diagnostic.deviceCount} conectado(s)` : undefined} />
        <StatusItem label="Base de datos interna (SQLite)" ok={diagnostic?.sqliteOk || false} />
        <StatusItem label="Red local disponible" ok={diagnostic?.localNetworkOk || false} />
        <StatusItem label="Dirección IP detectada" ok={diagnostic?.ipDetected || false} value={diagnostic?.ip} />
        <StatusItem label="Puerto de red utilizado" ok={diagnostic?.expressOk || false} value={diagnostic?.port} />
        <StatusItem label="Generador de enlaces y QR listos" ok={diagnostic?.qrOk || false} />
      </div>

      {isAllGood ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold text-emerald-800 text-lg mb-1">¡Todo está listo!</h3>
          <p className="text-emerald-700 text-sm font-medium">Los estudiantes pueden conectarse sin problemas.</p>
        </div>
      ) : diagnostic?.errorMessage ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-rose-800 text-base mb-1">{diagnostic.errorMessage}</h3>
              {diagnostic.suggestion && (
                <p className="text-rose-700 text-sm font-medium leading-relaxed">
                  {diagnostic.suggestion}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={runTest}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold font-sans transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          Probar conexión
        </button>

        <button
          onClick={handleCopy}
          disabled={loading || !diagnostic?.joinUrl}
          className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 p-4 rounded-xl font-bold font-sans transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-emerald-700">¡Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5 text-slate-600" />
              <span>Copiar enlace de acceso</span>
            </>
          )}
        </button>
      </div>

      {(!diagnostic?.ipDetected && diagnostic?.expressOk) && (
        <div className="mt-6 flex items-start gap-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium leading-relaxed font-sans">
            ¿Sabías que no necesitas internet para usar Prepmaster Live? 
            Si tu escuela no tiene Wi-Fi, activa la opción <strong>Zona con cobertura inalámbrica móvil (Hotspot)</strong> en Windows, pide a tus alumnos que se conecten a tu red y presiona "Probar conexión" nuevamente.
          </p>
        </div>
      )}

    </div>
  );
}
