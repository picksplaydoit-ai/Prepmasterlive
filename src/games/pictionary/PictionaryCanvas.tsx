import React, { useRef, useEffect, useState } from "react";

interface PictionaryCanvasProps {
  isWritable: boolean; // True for the drawer, false for spectators
  onStrokeStart?: (data: { x: number; y: number; color: string; size: number }) => void;
  onStrokeUpdate?: (data: { x: number; y: number }) => void;
  onClear?: () => void;
  externalActions?: {
    subscribeToStrokeStart: (callback: (data: any) => void) => void;
    subscribeToStrokeUpdate: (callback: (data: any) => void) => void;
    subscribeToClear: (callback: () => void) => void;
  };
}

export default function PictionaryCanvas({
  isWritable,
  onStrokeStart,
  onStrokeUpdate,
  onClear,
  externalActions,
}: PictionaryCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Brush options
  const [color, setColor] = useState("#000000"); // black
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");

  // Preset colors
  const colors = [
    { name: "Negro", value: "#000000" },
    { name: "Rojo", value: "#dc2626" },
    { name: "Azul", value: "#2563eb" },
    { name: "Verde", value: "#16a34a" },
  ];

  // Correct high-DPI sizing and viewport handling
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = (rect.height || 380) * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height || 380}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      contextRef.current = ctx;
    }
  };

  useEffect(() => {
    setupCanvas();

    const handleResize = () => {
      // Create a temporary content backup to keep canvas drawing on resize if possible
      const canvas = canvasRef.current;
      if (!canvas) return;
      const tempImg = canvas.toDataURL();
      setupCanvas();
      
      const ctx = contextRef.current;
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        };
        img.src = tempImg;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync brush properties with ctx
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize, tool]);

  // Hook up external drawing commands for spectators
  useEffect(() => {
    if (externalActions) {
      externalActions.subscribeToStrokeStart((data: any) => {
        const ctx = contextRef.current;
        if (!ctx) return;
        ctx.beginPath();
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.moveTo(data.x, data.y);
        ctx.stroke();
      });

      externalActions.subscribeToStrokeUpdate((data: any) => {
        const ctx = contextRef.current;
        if (!ctx) return;
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      });

      externalActions.subscribeToClear(() => {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }, [externalActions]);

  // Get mouse or touch coordinates relative to canvas
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Check if touch
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isWritable) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    const actualColor = tool === "eraser" ? "#ffffff" : color;
    
    ctx.strokeStyle = actualColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();

    if (onStrokeStart) {
      onStrokeStart({ x, y, color: actualColor, size: brushSize });
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isWritable) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();

    if (onStrokeUpdate) {
      onStrokeUpdate({ x, y });
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full" id="pictionary-canvas-module">
      {/* Tool panel (only shown if drawable / writable) */}
      {isWritable && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-2xl border border-slate-200 select-none">
          <div className="flex items-center gap-1.5">
            {/* Tool toggler */}
            <button
              onClick={() => setTool("pencil")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg cursor-pointer border ${
                tool === "pencil"
                  ? "bg-indigo-600 border-indigo-750 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              ✏️ Lápiz
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg cursor-pointer border ${
                tool === "eraser"
                  ? "bg-indigo-600 border-indigo-750 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              🧼 Borrador
            </button>
          </div>

          {/* Preset Colors */}
          {tool === "pencil" && (
            <div className="flex items-center gap-1">
              {colors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-lg cursor-pointer border transition-all ${
                    color === c.value
                      ? "border-slate-800 scale-110 shadow-sm"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          {/* Size sliders */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Grosor:</span>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-black text-slate-700 font-mono w-5">{brushSize}px</span>
          </div>

          <button
            onClick={clearCanvas}
            className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-black rounded-lg cursor-pointer transition-all"
          >
            🗑️ Limpiar lienzo
          </button>
        </div>
      )}

      {/* Canvas container */}
      <div 
        ref={containerRef} 
        className="relative w-full h-[360px] bg-white border-2 border-slate-300 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 block w-full h-full"
        />
        
        {!isWritable && (
          <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full shadow-md select-none touch-none pointer-events-none">
            📺 Espectador - Transmisión en Vivo
          </div>
        )}
      </div>
    </div>
  );
}
