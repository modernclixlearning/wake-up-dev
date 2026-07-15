/**
 * Audio del juego (F12): música de fondo por archivo + SFX 8-bit sintetizados.
 *
 * - Música: archivos del jugador en `public/audio/` (hechos con Suno, estilo
 *   8-bit drum and bass). Si un archivo no existe o el navegador bloquea el
 *   autoplay, el juego sigue en silencio — misma invariante que la capa IA:
 *   nunca romper el juego por un recurso opcional.
 * - SFX: chiptunes generados con WebAudio (osciladores square/triangle y
 *   ruido) — sin assets, estética 8-bit garantizada.
 * - M = mute global (persistido en localStorage). El listener ignora las
 *   teclas tipeadas dentro de inputs/textarea de los overlays DOM.
 */

const CLAVE_MUTE = "wakeupdev.mute";

let ctx: AudioContext | null = null;
let pista: HTMLAudioElement | null = null;
let volumenPista = 0.5;
let muteado = false;

try {
  muteado = localStorage.getItem(CLAVE_MUTE) === "1";
} catch {
  // localStorage bloqueado (modo incógnito estricto): arranca sin mute.
}

function contexto(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface OpcionesTono {
  tipo?: OscillatorType;
  volumen?: number;
  /** Barrido de frecuencia hasta este valor al final del tono (pew, caídas). */
  hasta?: number;
  /** Retardo en segundos (para encadenar arpegios). */
  demora?: number;
}

function tono(freq: number, duracion: number, opciones: OpcionesTono = {}): void {
  if (muteado) return;
  const audio = contexto();
  if (!audio) return;
  const { tipo = "square", volumen = 0.12, hasta, demora = 0 } = opciones;
  const t0 = audio.currentTime + demora;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (hasta !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, hasta), t0 + duracion);
  gain.gain.setValueAtTime(volumen, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duracion);
}

/** Ráfaga de ruido blanco con caída — la "explosión" clásica de los 8 bits. */
function ruido(duracion: number, volumen = 0.2): void {
  if (muteado) return;
  const audio = contexto();
  if (!audio) return;
  const muestras = Math.floor(audio.sampleRate * duracion);
  const buffer = audio.createBuffer(1, muestras, audio.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras);
  const fuente = audio.createBufferSource();
  fuente.buffer = buffer;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(volumen, audio.currentTime);
  fuente.connect(gain).connect(audio.destination);
  fuente.start();
}

export const sfx = {
  /** Piña de Neo que conecta: golpe seco grave. */
  pina(): void {
    tono(180, 0.09, { hasta: 70, volumen: 0.18 });
    tono(320, 0.05, { tipo: "triangle", volumen: 0.1 });
  },
  /** Piña al aire: whoosh corto y suave. */
  pinaAlAire(): void {
    tono(300, 0.08, { tipo: "triangle", hasta: 120, volumen: 0.06 });
  },
  /** Disparo (de Neo o del Jefe): pew descendente. */
  disparo(): void {
    tono(900, 0.12, { hasta: 180, volumen: 0.1 });
  },
  /** Golpe/tiro enemigo que te conecta: caída áspera. */
  golpeRecibido(): void {
    tono(220, 0.25, { tipo: "sawtooth", hasta: 55, volumen: 0.16 });
  },
  /** Enemigo aturdido: tres notas iguales rápidas (campanita de stun). */
  aturdido(): void {
    for (let i = 0; i < 3; i++) tono(880, 0.06, { demora: i * 0.08, volumen: 0.1 });
  },
  /** Respuesta correcta: arpegio ascendente (do-mi-sol). */
  acierto(): void {
    [523, 659, 784].forEach((f, i) => tono(f, 0.1, { demora: i * 0.09 }));
  },
  /** Respuesta incorrecta: dos tonos descendentes. */
  fallo(): void {
    tono(300, 0.14, { hasta: 200, volumen: 0.14 });
    tono(200, 0.2, { hasta: 110, volumen: 0.14, demora: 0.14 });
  },
  /** Agente derrotado: explosión de ruido + caída grave. */
  explosion(): void {
    ruido(0.35);
    tono(140, 0.3, { hasta: 40, volumen: 0.14 });
  },
  /** Nivel liberado / portal: fanfarria corta ascendente. */
  victoria(): void {
    [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.14, { demora: i * 0.12, volumen: 0.12 }));
  },
};

/**
 * Reproduce (en loop) una pista de `public/audio/`. Ruta relativa a propósito:
 * respeta el `base: "./"` de Vite (funciona igual en local y GitHub Pages).
 * Si ya está sonando esa misma pista, no la reinicia.
 */
export function reproducirMusica(archivo: string, volumen = 0.5): void {
  if (pista?.dataset.archivo === archivo) return;
  detenerMusica();
  const audio = new Audio(`audio/${archivo}`);
  audio.loop = true;
  audio.volume = muteado ? 0 : volumen;
  audio.dataset.archivo = archivo;
  // Archivo faltante o autoplay bloqueado: silencio, el juego sigue.
  audio.addEventListener("error", () => {
    if (pista === audio) pista = null;
  });
  void audio.play().catch(() => {});
  pista = audio;
  volumenPista = volumen;
}

export function detenerMusica(): void {
  if (!pista) return;
  pista.pause();
  pista.src = "";
  pista = null;
}

export function alternarMute(): boolean {
  muteado = !muteado;
  if (pista) pista.volume = muteado ? 0 : volumenPista;
  try {
    localStorage.setItem(CLAVE_MUTE, muteado ? "1" : "0");
  } catch {
    // Sin persistencia: el toggle vale solo para esta sesión.
  }
  return muteado;
}

export function estaMuteado(): boolean {
  return muteado;
}

/**
 * Engancha el audio a los gestos del usuario. Llamar una vez desde main.ts:
 * - Primer tecla/click: desbloquea el AudioContext y reintenta la música que
 *   el autoplay haya bloqueado (los navegadores exigen un gesto previo).
 * - Tecla M fuera de un input: alterna el mute global.
 */
export function iniciarAudio(): void {
  const desbloquear = () => {
    contexto();
    if (pista && pista.paused && !muteado) void pista.play().catch(() => {});
  };
  window.addEventListener("keydown", (ev) => {
    desbloquear();
    const enInput =
      ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement;
    if (!enInput && (ev.key === "m" || ev.key === "M")) alternarMute();
  });
  window.addEventListener("pointerdown", desbloquear);
}
