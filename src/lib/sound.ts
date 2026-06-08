// Centralized Web Audio API Sound Synthesizer for Prepmaster Live 2.0.0
// Functions fully local and offline, with no assets to download or load.

let isSoundSoundEnabled = true;

try {
  const saved = localStorage.getItem("prepmaster_sounds_enabled");
  if (saved !== null) {
    isSoundSoundEnabled = saved === "true";
  }
} catch (e) {
  // Ignore local storage error in sandboxes
}

export function setSoundsEnabled(enabled: boolean) {
  isSoundSoundEnabled = enabled;
  try {
    localStorage.setItem("prepmaster_sounds_enabled", String(enabled));
  } catch (e) {}
}

export function getSoundsEnabled(): boolean {
  return isSoundSoundEnabled;
}

// Lazy loaded AudioContext to comply with browser autoplay policies
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playGameSound(sound: string) {
  if (!isSoundSoundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    switch (sound) {
      // Quiz Live Sounds
      case "inicio": {
        // Triumphant opening major chord
        playTone(ctx, 261.63, "triangle", 0, 0.4, 0.15); // C4
        playTone(ctx, 329.63, "triangle", 0.1, 0.4, 0.15); // E4
        playTone(ctx, 392.00, "triangle", 0.2, 0.4, 0.15); // G4
        playTone(ctx, 523.25, "sine", 0.3, 0.6, 0.3); // C5
        break;
      }
      
      case "cuenta_regresiva": {
        // High crisp retro blip
        playTone(ctx, 880.00, "sine", 0, 0.12, 0.05);
        break;
      }
      
      case "correcta": {
        // Classic high-pitched coin jingle
        playTone(ctx, 523.25, "sine", 0, 0.15, 0.08); // C5
        playTone(ctx, 659.25, "sine", 0.08, 0.3, 0.12); // E5
        break;
      }
      
      case "incorrecta": {
        // Low disappointed sliding buzzer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
      
      case "podio": {
        // Victory fan-fare
        const notes = [293.66, 349.23, 440.00, 587.33]; // D, F, A, D
        notes.forEach((freq, i) => {
          playTone(ctx, freq, "sine", i * 0.12, 0.4, 0.15);
        });
        break;
      }
      
      // 100 Mexicanos Dijeron Sounds
      case "descubrir_respuesta": {
        // Sparkly pleasant retro ding
        playTone(ctx, 587.33, "triangle", 0, 0.15, 0.08); // D5
        playTone(ctx, 880.00, "sine", 0.06, 0.2, 0.1);    // A5
        playTone(ctx, 1174.66, "sine", 0.12, 0.4, 0.2);  // D6
        break;
      }
      
      case "error": {
        // Big dramatic 100 Mexicanos Strike Buzzer (Triple buzz)
        const playStrike = (delay: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(120, now + delay);
          gain.gain.setValueAtTime(0.25, now + delay);
          gain.gain.linearRampToValueAtTime(0.01, now + delay + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.3);
        };
        playStrike(0);
        playStrike(0.12);
        break;
      }
      
      case "aplausos": {
        // Noise generator for applause approximation (filtered white noise)
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1000, now);
        filter.Q.setValueAtTime(1, now);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 1.5);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        break;
      }
      
      case "ganador": {
        // High-pitch major scale arpeggio
        const gNotes = [392.00, 493.88, 587.33, 783.99, 987.77, 1174.66]; // G4, B4, D5, G5, B5, D6
        gNotes.forEach((freq, idx) => {
          playTone(ctx, freq, "sine", idx * 0.08, 0.3, 0.1);
        });
        break;
      }
      
      // Jeopardy Sounds
      case "seleccionar_casilla": {
        // Single quick high block click
        playTone(ctx, 440.00, "triangle", 0, 0.06, 0.03);
        break;
      }
      
      case "daily_double": {
        // sci-fi alarm sweep tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.8);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
        break;
      }
      
      case "final_jeopardy": {
        // Thinking Clock ticks
        let delay = 0;
        for (let i = 0; i < 8; i++) {
          playTone(ctx, 500, "triangle", delay, 0.05, 0.02);
          delay += 0.25;
        }
        playTone(ctx, 250, "sawtooth", delay, 0.4, 0.2); // gong at final
        break;
      }
      
      // Exam Mode
      case "finalizacio_examen":
      case "finalizacion": {
        // Calm resolution bell
        playTone(ctx, 523.25, "sine", 0, 0.5, 0.25); // C5
        playTone(ctx, 659.25, "sine", 0.12, 0.5, 0.25); // E5
        playTone(ctx, 783.99, "sine", 0.24, 0.5, 0.25); // G5
        playTone(ctx, 1046.50, "sine", 0.36, 0.8, 0.4); // C6
        break;
      }
      
      default:
        console.warn("Sonido no definido: " + sound);
    }
  } catch (error) {
    console.error("No se pudo producir sonido offline:", error);
  }
}

function playTone(ctx: AudioContext, freq: number, type: OscillatorType, delay: number, duration: number, decay: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime + delay;
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + duration + 0.02);
}
