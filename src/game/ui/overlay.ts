import { AIConfig, MODELOS_DEFAULT, ProviderId, cargarConfig, guardarConfig } from "../../ai/config";
import { AIProvider, EvaluacionAbierta } from "../../ai/provider";
import { RetoAbierta } from "../../domain/reto";
import { ANCHO, ALTO } from "../theme";

/**
 * Overlays DOM sobre el canvas (ajustes, Oráculo, retos abiertos).
 * Se usa DOM en lugar del canvas porque necesitamos inputs de texto reales.
 * Mientras un overlay está abierto, las escenas deben ignorar el teclado
 * (consultar hayOverlayAbierto()); además el overlay corta la propagación.
 */

let overlayActual: HTMLDivElement | null = null;
/** Listener de resize del overlay abierto, para removerlo al cerrar. */
let overlayResize: (() => void) | null = null;

export function hayOverlayAbierto(): boolean {
  return overlayActual !== null;
}

/**
 * Rectángulo REAL del juego dentro de la ventana. Kaplay usa letterbox: el
 * canvas llena la ventana y dibuja el juego 960x540 escalado y centrado, con
 * franjas negras a los costados. Los overlays deben ceñirse a ESE rectángulo
 * (no a la ventana): si no, el panel del Oráculo se va a la franja negra fuera
 * del fondo y corta la inmersión. Misma matemática de letterbox que Kaplay.
 */
function rectDelJuego(): { left: number; top: number; width: number; height: number } {
  const escala = Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
  const width = ANCHO * escala;
  const height = ALTO * escala;
  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

const TECLAS_JUEGO = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

/**
 * Suelta las teclas de movimiento en el motor. Si el jugador llegó al overlay
 * manteniendo una flecha, el keyup real ocurre con el overlay abierto y nunca
 * pasa por los listeners del juego (el canvas es hermano del overlay en el DOM):
 * Kaplay queda con la tecla "pisada" y al cerrar, Neo camina solo hacia el NPC
 * en loop. Emitimos keyup sintéticos a todos los posibles targets del motor.
 */
function liberarTeclasDeJuego(): void {
  const candidatos: Array<EventTarget | null> = [
    document.querySelector("canvas"),
    document.body,
    document,
    window,
  ];
  const targets = candidatos.filter((t): t is EventTarget => t !== null);
  for (const key of TECLAS_JUEGO) {
    for (const target of targets) {
      target.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true, cancelable: true }));
    }
  }
}

function cerrarOverlay(): void {
  overlayActual?.remove();
  overlayActual = null;
  if (overlayResize) {
    window.removeEventListener("resize", overlayResize);
    overlayResize = null;
  }
  liberarTeclasDeJuego();
  // Devolver el foco al canvas: Kaplay escucha el teclado en el canvas (lo
  // enfoca al iniciar), y al interactuar con el overlay el foco pasa al DOM.
  // Cuando el overlay se remueve, el foco cae en <body> y TODO el teclado del
  // juego queda muerto hasta que el jugador clickea el canvas a mano.
  document.querySelector<HTMLCanvasElement>("canvas")?.focus();
}

function crearOverlay(
  titulo: string,
  onCerrar?: () => void,
  opciones?: { lateral?: boolean }
): HTMLDivElement {
  cerrarOverlay();
  const root = document.createElement("div");
  // Modo lateral (chat del Oráculo): panel a la derecha. El backdrop es un
  // degradado — transparente en toda la mitad izquierda para que el Oráculo
  // quede a pleno brillo (AL FRENTE) mientras habla, y oscurece solo hacia la
  // derecha detrás del panel. Un backdrop plano cubría todo el canvas (es un
  // div por encima del canvas: el z de Kaplay no compite contra él) y opacaba
  // al personaje aunque le subamos el z dentro del juego.
  const lateral = opciones?.lateral ?? false;
  root.style.cssText = [
    "position:fixed", "z-index:1000", "box-sizing:border-box",
    "display:flex", "align-items:center",
    lateral ? "justify-content:flex-end" : "justify-content:center",
    // padding en % del propio rect (= área del juego), no de la ventana.
    lateral ? "padding-right:3%" : "",
    lateral
      ? "background:linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)"
      : "background:rgba(0,0,0,0.75)",
    "font-family:'Courier New',monospace",
  ].join(";");
  // Ceñir el overlay al rectángulo real del juego (dentro del letterbox) y
  // mantenerlo al redimensionar la ventana.
  const ajustarAlJuego = () => {
    const r = rectDelJuego();
    root.style.left = `${r.left}px`;
    root.style.top = `${r.top}px`;
    root.style.width = `${r.width}px`;
    root.style.height = `${r.height}px`;
  };
  ajustarAlJuego();
  overlayResize = ajustarAlJuego;
  window.addEventListener("resize", ajustarAlJuego);

  const panel = document.createElement("div");
  // Ancho/alto en % del rect del juego (el root ya está ceñido a él): así el
  // panel queda SIEMPRE dentro del fondo, sin desbordar a la franja negra.
  panel.style.cssText = [
    "background:#000", "border:2px solid #00ff46", "color:#dcffdc",
    "padding:24px", lateral ? "width:min(520px,46%)" : "width:min(640px,88%)",
    "max-height:82%", "overflow-y:auto",
    "box-shadow:0 0 24px rgba(0,255,70,0.4)",
  ].join(";");

  const h = document.createElement("div");
  h.textContent = titulo;
  h.style.cssText = "color:#00ff46;font-size:18px;margin-bottom:14px;letter-spacing:1px";
  panel.appendChild(h);
  root.appendChild(panel);

  // Que el juego no reciba las teclas mientras se escribe en el overlay.
  // Se corta la propagación de keydown/keypress para que el juego no reciba
  // las teclas mientras se escribe. Los keyup se dejan pasar a propósito: si
  // se tragan, Kaplay queda con la tecla "pisada" (p.ej. la flecha con la que
  // llegaste al Oráculo) y al cerrar el overlay el jugador camina solo hacia
  // el NPC, reabriéndolo en loop.
  for (const tipo of ["keydown", "keypress"] as const) {
    root.addEventListener(tipo, (e) => {
      e.stopPropagation();
      if (tipo === "keydown" && (e as KeyboardEvent).key === "Escape") {
        cerrarOverlay();
        onCerrar?.();
      }
    });
  }

  document.body.appendChild(root);
  overlayActual = root;
  return panel;
}

function boton(texto: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = texto;
  b.style.cssText = [
    "background:#001a08", "color:#00ff46", "border:1px solid #00ff46",
    "padding:8px 16px", "margin:12px 8px 0 0", "cursor:pointer",
    "font-family:inherit", "font-size:14px",
  ].join(";");
  b.onclick = onClick;
  return b;
}

function campo(parent: HTMLElement, etiqueta: string): HTMLInputElement {
  const label = document.createElement("label");
  label.textContent = etiqueta;
  label.style.cssText = "display:block;margin:10px 0 4px;color:#00ff46;font-size:13px";
  const input = document.createElement("input");
  input.style.cssText = [
    "width:100%", "box-sizing:border-box", "background:#000", "color:#dcffdc",
    "border:1px solid #007a28", "padding:8px", "font-family:inherit", "font-size:14px",
  ].join(";");
  parent.appendChild(label);
  parent.appendChild(input);
  return input;
}

/** Panel de ajustes BYOK. Llama a onGuardado con la nueva config al guardar. */
export function abrirAjustes(onGuardado: (config: AIConfig) => void): void {
  const panel = crearOverlay("AJUSTES — CONEXIÓN CON LA IA (BYOK)");
  const config = cargarConfig();

  const info = document.createElement("p");
  info.textContent =
    "Tu API key se guarda SOLO en el localStorage de este navegador y se usa " +
    "para llamar directo al proveedor. Sin key, el juego funciona igual (sin Oráculo ni retos abiertos).";
  info.style.cssText = "font-size:12px;color:#7ab87a;margin:0 0 8px";
  panel.appendChild(info);

  const labelSel = document.createElement("label");
  labelSel.textContent = "Proveedor";
  labelSel.style.cssText = "display:block;margin:10px 0 4px;color:#00ff46;font-size:13px";
  const select = document.createElement("select");
  select.style.cssText =
    "width:100%;background:#000;color:#dcffdc;border:1px solid #007a28;padding:8px;font-family:inherit";
  for (const [valor, texto] of [
    ["ninguno", "Sin IA (fallback estático)"],
    ["anthropic", "Anthropic (Claude)"],
    ["openai", "OpenAI (GPT)"],
    ["gemini", "Google (Gemini)"],
    ["claude-headless", "🕶 Claude Code headless (bridge local, sin key)"],
    ["copilot-headless", "🤖 GitHub Copilot headless (bridge local, sin key)"],
  ]) {
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = texto;
    select.appendChild(opt);
  }
  select.value = config.provider;
  panel.appendChild(labelSel);
  panel.appendChild(select);

  const inputKey = campo(panel, "API key");
  inputKey.type = "password";
  inputKey.value = config.apiKey;

  const inputModel = campo(panel, "Modelo (vacío = default del proveedor)");
  inputModel.value = config.model;
  const actualizarPlaceholder = () => {
    const p = select.value as ProviderId;
    inputModel.placeholder = p !== "ninguno" ? MODELOS_DEFAULT[p as keyof typeof MODELOS_DEFAULT] : "";
  };
  select.onchange = actualizarPlaceholder;
  actualizarPlaceholder();

  panel.appendChild(
    boton("GUARDAR", () => {
      const nueva: AIConfig = {
        provider: select.value as ProviderId,
        apiKey: inputKey.value.trim(),
        model: inputModel.value.trim(),
      };
      guardarConfig(nueva);
      cerrarOverlay();
      onGuardado(nueva);
    })
  );
  panel.appendChild(boton("CANCELAR (ESC)", () => cerrarOverlay()));
}

/** Chat con el Oráculo. Bloquea el juego hasta cerrarse (ESC o botón). */
export function abrirOraculo(ai: AIProvider, contextoModulo: string, onCerrar: () => void): void {
  const panel = crearOverlay("EL ORÁCULO", onCerrar, { lateral: true });

  const log = document.createElement("div");
  log.style.cssText =
    "min-height:120px;max-height:40vh;overflow-y:auto;border:1px solid #007a28;padding:10px;font-size:14px;line-height:1.5";
  panel.appendChild(log);

  const agregar = (quien: string, texto: string, color: string) => {
    const p = document.createElement("p");
    p.textContent = `${quien}: ${texto}`;
    p.style.cssText = `margin:6px 0;color:${color};white-space:pre-wrap`;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  };

  agregar(
    "Oráculo",
    "Sabía que vendrías. Preguntame lo que no entiendas de este módulo... la respuesta ya está en vos.",
    "#00ff46"
  );

  const input = campo(panel, "Tu pregunta (ENTER para enviar)");
  let esperando = false;

  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || esperando) return;
    const pregunta = input.value.trim();
    if (!pregunta) return;
    input.value = "";
    agregar("Vos", pregunta, "#dcffdc");
    esperando = true;
    const pensando = agregar("Oráculo", "...", "#7ab87a");
    try {
      const respuesta = await ai.preguntarOraculo(contextoModulo, pregunta);
      pensando.textContent = `Oráculo: ${respuesta}`;
      pensando.style.color = "#00ff46";
    } catch (err) {
      pensando.textContent = `Oráculo: (la conexión con la Matrix falló: ${err instanceof Error ? err.message : err})`;
      pensando.style.color = "#ff5555";
    } finally {
      esperando = false;
    }
  });

  panel.appendChild(
    boton("VOLVER AL NIVEL (ESC)", () => {
      cerrarOverlay();
      onCerrar();
    })
  );
  input.focus();
}

/** Reto abierto calificado por IA. Resuelve con la evaluación, o null si hay que caer al fallback MC. */
export function abrirRetoAbierto(ai: AIProvider, reto: RetoAbierta): Promise<EvaluacionAbierta | null> {
  return new Promise((resolve) => {
    const panel = crearOverlay("AGENTE SMITH TE BLOQUEA — RESPUESTA LIBRE", () => resolve(null));

    const p = document.createElement("p");
    p.textContent = reto.pregunta;
    p.style.cssText = "font-size:15px;line-height:1.5";
    panel.appendChild(p);

    const nota = document.createElement("p");
    nota.textContent = "Tu respuesta será evaluada por la IA contra una rúbrica. ESC = rendirse (pregunta de opciones).";
    nota.style.cssText = "font-size:11px;color:#7ab87a";
    panel.appendChild(nota);

    const area = document.createElement("textarea");
    area.rows = 5;
    area.style.cssText =
      "width:100%;box-sizing:border-box;background:#000;color:#dcffdc;border:1px solid #007a28;padding:8px;font-family:inherit;font-size:14px;margin-top:8px";
    panel.appendChild(area);

    const resultado = document.createElement("p");
    resultado.style.cssText = "font-size:13px;min-height:18px";
    panel.appendChild(resultado);

    let enviando = false;
    panel.appendChild(
      boton("ENVIAR RESPUESTA", async () => {
        if (enviando) return;
        const respuesta = area.value.trim();
        if (respuesta.length < 10) {
          resultado.textContent = "Escribí una respuesta un poco más desarrollada.";
          resultado.style.color = "#ff5555";
          return;
        }
        enviando = true;
        resultado.textContent = "El evaluador está leyendo tu respuesta...";
        resultado.style.color = "#7ab87a";
        try {
          const evaluacion = await ai.evaluarAbierta(reto, respuesta);
          cerrarOverlay();
          resolve(evaluacion);
        } catch (err) {
          // La IA falló: no penalizamos — cae a la variante multiple-choice.
          cerrarOverlay();
          resolve(null);
        }
      })
    );
    area.focus();
  });
}
