import { KAPLAYCtx } from "kaplay";
import {
  ALTO,
  AMBAR,
  ANCHO,
  CARRIL_INFERIOR,
  CARRIL_SUPERIOR,
  CIAN,
  LIMA,
  NARANJA,
  VERDE,
  VERDE_OSCURO,
  VIOLETA,
  CHARS_MATRIX,
} from "./theme";

/**
 * Fondos pixel-art por módulo (F13): imágenes de escena (960x640, ver el
 * pipeline en docs/niveles.md) que reemplazan al decorado procedural. Se montan
 * como backdrop FIJO a la pantalla (k.fixed), no scrollean con la cámara —
 * un solo "cuarto" atmosférico detrás del combate, sin costuras ni el problema
 * de perspectiva que tendría tilear un pasillo a lo ancho. El catálogo completo
 * de conceptos (los 10, incluidos los 4 sin módulo aún) vive en docs/niveles.md.
 */
const FONDOS = [
  "01-ciudad-digital",
  "02-pasillo-oficina",
  "03-sala-entrenamiento",
  "04-tejado-lluvia",
  "05-cabina-telefonica",
  "06-apartamento-rojo",
  "07-desierto-maquinas",
  "08-nave-subterranea",
  "09-sala-pantallas",
  "10-corredor-hotel",
] as const;

/** Mapa módulo → fondo. Si un módulo no está acá, cae al decorado procedural. */
const FONDO_POR_MODULO: Record<string, string> = {
  "01-fundamentos": "01-ciudad-digital",
  "02-ingenieria": "02-pasillo-oficina",
  "03-arquitectura": "04-tejado-lluvia",
  "04-fundamentos-ia": "09-sala-pantallas",
  "05-herramientas": "03-sala-entrenamiento",
  "09-flujo-desarrollo-ia": "07-desierto-maquinas",
};

/** Carga los fondos una vez al iniciar, junto a los sprites (main.ts). */
export function cargarFondos(k: KAPLAYCtx): void {
  for (const nombre of FONDOS) {
    k.loadSprite(`fondo-${nombre}`, `fondos/${nombre}.png`);
  }
}

/**
 * Decorado por módulo (F11 v2): 100% visual, sin `k.area()` — no toca el
 * movimiento ni las colisiones. Le da a cada nivel una identidad de color
 * distinta con primitivas de Kaplay (grillas, columnas, motivos simples),
 * todo dibujado por debajo de personajes y encuentros (z negativo).
 *
 * A diferencia de la v1, ahora recibe el ancho REAL del nivel (más grande que
 * la pantalla, ver ANCHO vs anchoNivel en level.ts) para que el decorado se
 * extienda a lo largo de todo el recorrido y no solo a la pantalla inicial.
 * También dibuja el "carril" (piso/techo + flechas) que marca la dirección
 * de avance, pedido explícito tras el playtest: sin esto, un cuarto único no
 * comunica "hacia dónde ir".
 */

const ACENTO_POR_MODULO: Record<string, [number, number, number]> = {
  "01-fundamentos": VERDE_OSCURO,
  "02-ingenieria": CIAN,
  "03-arquitectura": AMBAR,
  "04-fundamentos-ia": VIOLETA,
  "05-herramientas": NARANJA,
  "09-flujo-desarrollo-ia": LIMA,
};

function acentoDe(moduloId: string): [number, number, number] {
  return ACENTO_POR_MODULO[moduloId] ?? VERDE_OSCURO;
}

function agregarGrilla(k: KAPLAYCtx, anchoNivel: number, color: [number, number, number], paso: number): void {
  for (let x = paso; x < anchoNivel; x += paso) {
    k.add([k.rect(1, CARRIL_INFERIOR - CARRIL_SUPERIOR), k.pos(x, CARRIL_SUPERIOR), k.color(...color), k.opacity(0.16), k.z(-2)]);
  }
  const pasoY = (CARRIL_INFERIOR - CARRIL_SUPERIOR) / 4;
  for (let y = CARRIL_SUPERIOR + pasoY; y < CARRIL_INFERIOR; y += pasoY) {
    k.add([k.rect(anchoNivel, 1), k.pos(0, y), k.color(...color), k.opacity(0.14), k.z(-2)]);
  }
}

function agregarColumnas(k: KAPLAYCtx, anchoNivel: number, color: [number, number, number]): void {
  const paso = 320;
  for (let x = paso; x < anchoNivel; x += paso) {
    k.add([k.rect(12, CARRIL_INFERIOR - CARRIL_SUPERIOR + 30), k.pos(x, CARRIL_SUPERIOR - 15), k.color(...color), k.opacity(0.22), k.z(-1)]);
  }
}

/** Carril de avance: piso + techo bien marcados y flechas ">>" que refuerzan
 * "seguí a la derecha". Con `soloFlechas` (cuando hay fondo de imagen) omite las
 * líneas de piso/techo — que chocarían con el suelo pintado del fondo — y deja
 * solo las flechas como pista de dirección. */
function agregarCarril(
  k: KAPLAYCtx,
  anchoNivel: number,
  color: [number, number, number],
  soloFlechas = false
): void {
  if (!soloFlechas) {
    k.add([k.rect(anchoNivel, 3), k.pos(0, CARRIL_SUPERIOR - 4), k.color(...color), k.opacity(0.5), k.z(-1)]);
    k.add([k.rect(anchoNivel, 3), k.pos(0, CARRIL_INFERIOR + 4), k.color(...color), k.opacity(0.5), k.z(-1)]);
  }
  const pasoFlecha = 220;
  for (let x = 140; x < anchoNivel - 60; x += pasoFlecha) {
    k.add([
      k.text(">>", { size: 18 }),
      k.pos(x, CARRIL_INFERIOR - 6),
      k.anchor("center"),
      k.color(...color),
      k.opacity(soloFlechas ? 0.45 : 0.28),
      k.z(-1),
    ]);
  }
}

/** Ingeniería / Arquitectura: cajas tipo "blueprint" (solo contorno) dispersas. */
function agregarCajasBlueprint(k: KAPLAYCtx, anchoNivel: number, color: [number, number, number], cantidad: number): void {
  for (let i = 0; i < cantidad; i++) {
    const w = k.rand(60, 140);
    const h = k.rand(40, 90);
    k.add([
      k.rect(w, h),
      k.pos(k.rand(200, anchoNivel - 100), k.rand(CARRIL_SUPERIOR + 10, CARRIL_INFERIOR - h - 10)),
      k.color(...color),
      k.opacity(0.12),
      k.outline(1.5, k.rgb(...color)),
      k.z(-1),
    ]);
  }
}

/** Fundamentos de IA: nodos dispersos, evocando una red simple. */
function agregarNodosRed(k: KAPLAYCtx, anchoNivel: number, color: [number, number, number], cantidad: number): void {
  for (let i = 0; i < cantidad; i++) {
    k.add([
      k.rect(6, 6),
      k.pos(k.rand(200, anchoNivel - 60), k.rand(CARRIL_SUPERIOR + 10, CARRIL_INFERIOR - 10)),
      k.color(...color),
      k.opacity(0.4),
      k.z(-1),
    ]);
  }
}

/** Flujo de Desarrollo con IA: lluvia de código tenue, igual espíritu que la pantalla de título. */
function agregarLluviaTenue(k: KAPLAYCtx, anchoNivel: number, color: [number, number, number]): void {
  k.loop(0.35, () => {
    const char = k.add([
      k.text(k.choose(CHARS_MATRIX), { size: 14 }),
      k.pos(k.rand(0, anchoNivel), -16),
      k.color(...color),
      k.opacity(k.rand(0.12, 0.32)),
      k.move(k.vec2(0, 1), k.rand(50, 100)),
      k.z(-1),
    ]);
    k.wait(8, () => k.destroy(char));
  });
}

/** Backdrop fijo a pantalla: la imagen del fondo, sin scroll, detrás de todo.
 * El fondo procesado es 960x640 y el canvas 960x540; se ancla en y=-50 para
 * centrar verticalmente (recorta 50px arriba y 50px abajo, sin bandas negras). */
function agregarFondoImagen(k: KAPLAYCtx, nombre: string): void {
  k.add([k.sprite(`fondo-${nombre}`), k.pos(0, -(640 - ALTO) / 2), k.z(-100), k.fixed()]);
  // Bandas oscuras arriba (detrás del HUD) y abajo (detrás del tutorial): sin
  // ellas, el texto verde de la UI se vuelve ilegible sobre los fondos claros
  // (la sala de entrenamiento blanca lo dejó invisible). Además asientan a los
  // personajes y separan el piso del combate del suelo pintado (que queda
  // estático mientras ellos scrollean). Suaves para no tapar la escena.
  k.add([k.rect(ANCHO, 56), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.42), k.z(-99), k.fixed()]);
  k.add([k.rect(ANCHO, 110), k.pos(0, ALTO - 110), k.color(0, 0, 0), k.opacity(0.5), k.z(-99), k.fixed()]);
}

/** Dibuja el decorado del nivel según el módulo. Se llama una vez al entrar a la escena. */
export function dibujarEscenario(k: KAPLAYCtx, moduloId: string, anchoNivel: number): void {
  const acento = acentoDe(moduloId);

  // F13: si el módulo tiene fondo de imagen, es el decorado; el procedural se
  // omite (choca con la escena pintada) y solo quedan las flechas de dirección.
  const fondo = FONDO_POR_MODULO[moduloId];
  if (fondo) {
    agregarFondoImagen(k, fondo);
    agregarCarril(k, anchoNivel, acento === VERDE_OSCURO ? VERDE : acento, true);
    return;
  }

  agregarGrilla(k, anchoNivel, acento, moduloId === "03-arquitectura" ? 60 : 96);
  agregarColumnas(k, anchoNivel, acento);
  agregarCarril(k, anchoNivel, acento === VERDE_OSCURO ? VERDE : acento);

  switch (moduloId) {
    case "02-ingenieria":
    case "03-arquitectura":
      agregarCajasBlueprint(k, anchoNivel, acento, 8);
      break;
    case "04-fundamentos-ia":
      agregarNodosRed(k, anchoNivel, acento, 18);
      break;
    case "09-flujo-desarrollo-ia":
      agregarLluviaTenue(k, anchoNivel, acento);
      break;
    default:
      break;
  }
}
