import { GameObj, KAPLAYCtx } from "kaplay";
import { semillaDe } from "../domain/aleatorio";
import { Camino, crearCamino } from "../domain/camino";
import { generarCarrete, ItemCarrete, PiezaCarrete } from "../domain/carrete";
import { ALTO_NEO } from "./actores";
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
  // Calidad = sala de control de la nave: monitores, alertas, observabilidad.
  "10-calidad": "08-nave-subterranea",
  // Infra/cloud = la cabina telefonica: el punto de conexion y de salida (el deploy).
  "11-infraestructura-cloud": "05-cabina-telefonica",
  // Seguridad = el corredor del hotel: perimetro, intrusion y persecucion.
  "12-seguridad": "10-corredor-hotel",
  // Desarrollo con IA = el apartamento rojo: el cuarto donde se toma la pildora.
  "13-desarrollo-potenciado-ia": "06-apartamento-rojo",
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

// ---------------------------------------------------------------------------
// Camino y carretes (F14)
// ---------------------------------------------------------------------------
//
// Hasta F13 el nivel era un rectángulo con un fondo quieto: se podía caminar por
// cualquier parte de una banda constante y, al avanzar, nada en pantalla se
// movía salvo los personajes. Dos arreglos, uno de mecánica y otro de percepción:
//
//  1. El CAMINO (`src/domain/camino.ts`) es una banda pisable que serpentea a lo
//     largo del nivel. Da un lugar concreto que pisar y obliga a corregir con
//     las flechas mientras avanzás. Se dibuja acá; el clamp lo aplica level.ts.
//  2. Los CARRETES (`src/domain/carrete.ts`) son capas de decorado a distintas
//     profundidades que scrollean MÁS LENTO que el suelo (parallax). Son las que
//     dan la sensación de avance: con un fondo fijo y nada más, caminar hacia la
//     derecha no se distingue de estar quieto.

/** Y mínima donde pueden estar los pies: el techo del carril más la altura de Neo. */
export const PIES_MIN = CARRIL_SUPERIOR + ALTO_NEO;
/** Y máxima donde pueden estar los pies: el borde frontal del carril. */
export const PIES_MAX = CARRIL_INFERIOR;

/** Semi-alto del camino en el tramo de recorrido (la banda mide el doble). */
const SEMI_ALTO_ESTRECHO = 66;
/** La entrada se mantiene abierta hasta acá: es donde vive el Oráculo. */
const ENTRADA_DESDE = 120;
const ENTRADA_HASTA = 420;
/** La arena del Jefe empieza a abrirse a esta distancia del final del nivel. */
const ARENA_ANTES_DEL_FINAL = 900;
const ARENA_ABIERTA_ANTES_DEL_FINAL = 620;

/**
 * El camino de un módulo. Determinista por `moduloId`: cada nivel tiene su
 * propia forma y es siempre la misma partida tras partida.
 */
export function caminoDelNivel(moduloId: string, anchoNivel: number): Camino {
  return crearCamino({
    semilla: semillaDe(moduloId),
    largo: anchoNivel,
    pisoMin: PIES_MIN,
    pisoMax: PIES_MAX,
    semiAltoEstrecho: SEMI_ALTO_ESTRECHO,
    entradaDesde: ENTRADA_DESDE,
    entradaHasta: ENTRADA_HASTA,
    // En un nivel corto la arena podría solaparse con la entrada: los `max`
    // evitan que el tramo estrecho desaparezca (o quede invertido) en ese caso.
    arenaDesde: Math.max(ENTRADA_HASTA + 240, anchoNivel - ARENA_ANTES_DEL_FINAL),
    arenaHasta: Math.max(ENTRADA_HASTA + 380, anchoNivel - ARENA_ABIERTA_ANTES_DEL_FINAL),
  });
}

/** Paso de muestreo al dibujar el camino: más fino se ve curvo, más grueso escalona. */
const PASO_CAMINO = 8;
/** Grosor de los bordes de la calzada. */
const GROSOR_BORDE = 3;

/**
 * Dibuja el camino: la calzada tenue, sus dos bordes, una línea discontinua
 * central (el signo universal de "esto es un camino") y las flechas de dirección
 * siguiendo la curva. Todo estático y sin `k.area()`: el camino no colisiona,
 * solo acota — paredes de verdad traerían riesgo de softlock (ver AGENTS.md).
 *
 * Los bordes se dibujan con rectángulos, no con polígonos, para no salirse de
 * las primitivas que ya usa el resto del juego. El truco para que una curva
 * hecha de rectángulos no se vea como una ESCALERA (que es exactamente como se
 * veía en el primer intento, con paso de 16) es que cada segmento cubra el
 * salto hasta el siguiente: se muestrea el camino en `x` y en `x + paso`, y el
 * rectángulo se estira para tapar ambas alturas. Con eso los tramos se solapan
 * y la diagonal queda continua.
 */
function dibujarCamino(k: KAPLAYCtx, camino: Camino, anchoNivel: number, color: [number, number, number]): void {
  const ancho = PASO_CAMINO + 1;
  for (let x = 0; x < anchoNivel; x += PASO_CAMINO) {
    const aqui = camino.bandaEn(x);
    const siguiente = camino.bandaEn(x + PASO_CAMINO);

    const arriba = Math.min(aqui.min, siguiente.min);
    const abajo = Math.max(aqui.max, siguiente.max);
    k.add([k.rect(ancho, abajo - arriba), k.pos(x, arriba), k.color(...color), k.opacity(0.14), k.z(-3)]);

    // Borde de fondo: cubre desde la más alta de las dos muestras hasta la más
    // baja, más el grosor — así el escalón entre segmentos queda relleno.
    const bordeSuperior = Math.abs(aqui.min - siguiente.min) + GROSOR_BORDE;
    k.add([
      k.rect(ancho, bordeSuperior),
      k.pos(x, Math.min(aqui.min, siguiente.min)),
      k.color(...color),
      k.opacity(0.55),
      k.z(-2),
    ]);
    const bordeInferior = Math.abs(aqui.max - siguiente.max) + GROSOR_BORDE;
    k.add([
      k.rect(ancho, bordeInferior),
      k.pos(x, Math.min(aqui.max, siguiente.max) - GROSOR_BORDE),
      k.color(...color),
      k.opacity(0.55),
      k.z(-2),
    ]);
  }
  // Línea discontinua del medio: refuerza la curva del recorrido. Rayas cortas
  // (16px) a propósito: una raya larga sobre una pendiente se ve torcida.
  for (let x = 0; x < anchoNivel; x += 64) {
    k.add([k.rect(16, 2), k.pos(x, camino.centroEn(x + 8)), k.color(...color), k.opacity(0.3), k.z(-2)]);
  }
  for (let x = 140; x < anchoNivel - 60; x += 220) {
    k.add([
      k.text(">>", { size: 18 }),
      k.pos(x, camino.centroEn(x) + camino.semiAltoEn(x) - 16),
      k.anchor("center"),
      k.color(...color),
      k.opacity(0.45),
      k.z(-2),
    ]);
  }
}

/** Glifos de graffiti: subconjunto seguro de CHARS_MATRIX (sin corchetes, que
 * Kaplay parsea como tags de texto estilado y revientan el frame). */
const GRAFFITI = "01<>#$%&=+*".split("");

/**
 * Capa con parallax: un contenedor cuyos hijos se posicionan en "espacio de
 * carrete". Moviendo el padre a `camX * (1 - factor)` cada frame, los hijos
 * quedan en pantalla a `x - camX * factor`, o sea que se desplazan a `factor`
 * veces la velocidad del suelo. Un solo `onUpdate` mueve la capa entera.
 */
function crearCapaParallax(k: KAPLAYCtx, factor: number, z: number): GameObj {
  const capa = k.add([k.pos(0, 0), k.z(z)]);
  capa.onUpdate(() => {
    capa.pos.x = k.getCamPos().x * (1 - factor);
  });
  return capa;
}

/** Dibuja una pieza del carrete apoyada en la línea `base` (crece hacia arriba). */
function dibujarPieza(
  k: KAPLAYCtx,
  capa: GameObj,
  item: ItemCarrete,
  base: number,
  color: [number, number, number],
  opacidad: number
): void {
  const v = item.variacion;
  const trozo = (
    dx: number,
    dy: number,
    ancho: number,
    alto: number,
    op = opacidad,
    tinte: [number, number, number] = color
  ) => {
    capa.add([
      k.rect(ancho, alto),
      k.pos(item.x + dx, base + dy),
      k.color(...tinte),
      k.opacity(Math.min(1, op)),
      k.z(0),
    ]);
  };

  switch (item.tipo) {
    case "pasto": {
      // Matitas de altura despareja: lo más barato que lee como "suelo vivo".
      for (let i = 0; i < 4; i++) {
        const alto = 9 + v * 12 + (i % 2) * 5;
        trozo(i * 5, -alto, 3, alto, opacidad * 0.9);
      }
      break;
    }
    case "cerca": {
      const ancho = 40;
      trozo(0, -28, 4, 28);
      trozo(ancho - 4, -28, 4, 28);
      trozo(0, -24, ancho, 3, opacidad * 0.8);
      trozo(0, -14, ancho, 3, opacidad * 0.8);
      break;
    }
    case "muro": {
      const ancho = 48 + v * 40;
      const alto = 30 + v * 16;
      trozo(0, -alto, ancho, alto, opacidad * 0.55);
      trozo(0, -alto + alto / 3, ancho, 1, opacidad * 0.9);
      trozo(0, -alto + (alto * 2) / 3, ancho, 1, opacidad * 0.9);
      capa.add([
        k.text(GRAFFITI[Math.floor(v * GRAFFITI.length) % GRAFFITI.length], { size: 14 }),
        k.pos(item.x + ancho / 2, base - alto / 2),
        k.anchor("center"),
        k.color(...VERDE),
        k.opacity(Math.min(1, opacidad * 1.8)),
        k.z(0),
      ]);
      break;
    }
    case "poste": {
      const alto = 56 + v * 26;
      trozo(0, -alto, 4, alto);
      trozo(-5, -alto, 14, 5, opacidad * 1.3);
      break;
    }
    case "barril": {
      trozo(0, -24, 18, 24, opacidad * 0.8);
      trozo(0, -19, 18, 2);
      trozo(0, -9, 18, 2);
      break;
    }
    case "antena": {
      const alto = 70 + v * 45;
      trozo(0, -alto, 3, alto, opacidad * 0.8);
      trozo(-6, -alto + 12, 15, 2);
      trozo(-4, -alto - 4, 10, 4, opacidad * 1.3);
      break;
    }
    case "edificio": {
      const ancho = 38 + v * 44;
      const alto = 70 + v * 80;
      trozo(0, -alto, ancho, alto, opacidad * 0.6);
      for (let fy = -alto + 12; fy < -18; fy += 22) {
        for (let fx = 7; fx < ancho - 10; fx += 18) {
          trozo(fx, fy, 5, 7, opacidad * 1.4, VERDE);
        }
      }
      break;
    }
  }
}

/** Un carrete: repertorio de piezas, profundidad (parallax) y línea de apoyo. */
interface Carrete {
  factor: number;
  z: number;
  base: number;
  opacidad: number;
  pasoMin: number;
  pasoMax: number;
  repertorio: { tipo: PiezaCarrete; peso: number }[];
}

const CARRETES: Carrete[] = [
  // Lejano: el horizonte. Casi quieto (0.28), muy tenue, siluetas altas.
  {
    factor: 0.28,
    z: -6,
    base: PIES_MIN - 24,
    opacidad: 0.16,
    pasoMin: 130,
    pasoMax: 300,
    repertorio: [
      { tipo: "edificio", peso: 3 },
      { tipo: "antena", peso: 2 },
      { tipo: "muro", peso: 1 },
    ],
  },
  // Medio: la capa que hace el trabajo. Se apoya justo detrás del borde de
  // fondo del camino, así la calzada (z mayor) le tapa la base y se lee "atrás".
  {
    factor: 0.62,
    z: -4,
    base: PIES_MIN + 8,
    opacidad: 0.55,
    pasoMin: 95,
    pasoMax: 215,
    repertorio: [
      { tipo: "pasto", peso: 5 },
      { tipo: "cerca", peso: 3 },
      { tipo: "muro", peso: 2 },
      { tipo: "poste", peso: 2 },
      { tipo: "barril", peso: 1 },
    ],
  },
];

/**
 * Siembra los carretes del nivel. Cada capa lleva su propia semilla (módulo +
 * factor) para que no queden alineadas entre sí, que es lo que delataría el truco.
 */
function dibujarCarretes(k: KAPLAYCtx, moduloId: string, anchoNivel: number, color: [number, number, number]): void {
  for (const carrete of CARRETES) {
    const capa = crearCapaParallax(k, carrete.factor, carrete.z);
    const items = generarCarrete({
      semilla: semillaDe(`${moduloId}:${carrete.factor}`),
      // Empieza antes de 0: con parallax, al principio del nivel el borde
      // izquierdo de la pantalla mira espacio de carrete negativo.
      desde: -320,
      // El espacio de carrete avanza a `factor` de la cámara: con este tope
      // sobra decorado hasta el final del recorrido.
      hasta: anchoNivel * carrete.factor + ANCHO,
      pasoMin: carrete.pasoMin,
      pasoMax: carrete.pasoMax,
      repertorio: carrete.repertorio,
    });
    for (const item of items) {
      dibujarPieza(k, capa, item, carrete.base, color, carrete.opacidad);
    }
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
  // estático mientras ellos scrollean). Opacidad calculada para que el texto
  // VERDE (0,255,70) alcance al menos 4.5:1 sobre fondos claros (WCAG AA):
  // con opacity=0.72 sobre blanco el fondo efectivo da ratio ~6.8:1.
  k.add([k.rect(ANCHO, 56), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.72), k.z(-99), k.fixed()]);
  k.add([k.rect(ANCHO, 110), k.pos(0, ALTO - 110), k.color(0, 0, 0), k.opacity(0.72), k.z(-99), k.fixed()]);
}

/**
 * Dibuja el decorado del nivel según el módulo. Se llama una vez al entrar a la
 * escena y DEVUELVE el camino que dibujó: level.ts lo necesita para acotar a Neo
 * y a los Agentes a la misma banda que se ve en pantalla — si cada uno lo
 * calculara por su cuenta podrían desincronizarse y los personajes pisarían fuera.
 */
export function dibujarEscenario(k: KAPLAYCtx, moduloId: string, anchoNivel: number): Camino {
  const acento = acentoDe(moduloId);
  const colorCamino = acento === VERDE_OSCURO ? VERDE : acento;
  const camino = caminoDelNivel(moduloId, anchoNivel);

  // F13: si el módulo tiene fondo de imagen, es el decorado; el procedural se
  // omite (choca con la escena pintada) y quedan los carretes y el camino.
  const fondo = FONDO_POR_MODULO[moduloId];
  if (fondo) {
    agregarFondoImagen(k, fondo);
    // Los carretes van con el color VIVO, no con el acento crudo: sobre los
    // fondos pintados (la ciudad del módulo 1 es densísima) un verde oscuro al
    // 40% desaparece y la capa de parallax deja de comunicar profundidad.
    dibujarCarretes(k, moduloId, anchoNivel, colorCamino);
    dibujarCamino(k, camino, anchoNivel, colorCamino);
    return camino;
  }

  agregarGrilla(k, anchoNivel, acento, moduloId === "03-arquitectura" ? 60 : 96);
  agregarColumnas(k, anchoNivel, acento);
  dibujarCarretes(k, moduloId, anchoNivel, colorCamino);
  dibujarCamino(k, camino, anchoNivel, colorCamino);

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

  return camino;
}
