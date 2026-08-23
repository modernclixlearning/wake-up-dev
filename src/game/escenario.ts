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
  NEGRO,
  ROJO,
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

/** Carga los fondos una vez al iniciar, junto a los sprites (main.ts).
 * Por cada fondo carga también su textura de piso `piso-*.png` (F14 v4):
 * suelo OPACO generado por script (adoquín/losetas/tablones/alfombra/arena
 * según el escenario, con la paleta muestreada del fondo real) que se tilea
 * en coordenadas de MUNDO. La v3 recortaba la franja del propio fondo, pero
 * en niveles sin piso pintado en esa banda (la ciudad son edificios) el
 * suelo se leía "transparente" — pedido del alumno con mockup. */
export function cargarFondos(k: KAPLAYCtx): void {
  for (const nombre of FONDOS) {
    k.loadSprite(`fondo-${nombre}`, `fondos/${nombre}.png`);
    k.loadSprite(`piso-${nombre}`, `fondos/piso-${nombre}.png`);
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

/** Semi-alto del suelo: IGUAL al máximo, o sea banda plana de borde a borde.
 * El suelo tiene que verse como un suelo normal a lo Double Dragon — la mitad
 * inferior de la pantalla caminable, sin serpenteo (pedido explícito tras ver
 * la primera versión curva: "forma normal de suelo"). Con el presupuesto de
 * ondulación en cero, crearCamino degenera a la banda rectangular clásica y el
 * clamp de level.ts se comporta como siempre. La infraestructura del camino
 * curvo queda en domain/camino.ts por si un nivel futuro la quiere. */
const SEMI_ALTO_ESTRECHO = (PIES_MAX - PIES_MIN) / 2;
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
/** Alto del bordillo frontal brillante y del faldón oscuro que cae debajo. */
const ALTO_BORDILLO = 6;
const ALTO_FALDON = 14;

/**
 * Suelo de imagen (F14 v4): tilea la textura opaca `piso-*.png` en coordenadas
 * de mundo, así scrollea con la cámara mientras el backdrop queda fijo. Los
 * tiles impares van espejados (flipX): las costuras quedan continuas por
 * construcción, porque cada borde empalma consigo mismo reflejado.
 */
function agregarSueloImagen(k: KAPLAYCtx, nombre: string, anchoNivel: number): void {
  const tiles = Math.ceil(anchoNivel / ANCHO) + 1;
  for (let i = 0; i < tiles; i++) {
    k.add([k.sprite(`piso-${nombre}`, { flipX: i % 2 === 1 }), k.pos(i * ANCHO, PIES_MIN), k.z(-3)]);
  }
  if (FONDOS_EXTERIOR.has(nombre)) {
    dibujarValla(k, anchoNivel);
  } else {
    // Interiores: junta pared/piso (zócalo) — una sombra fina y un filo de luz.
    k.add([k.rect(anchoNivel, 3), k.pos(0, PIES_MIN), k.color(0, 0, 0), k.opacity(0.5), k.z(-2)]);
    k.add([k.rect(anchoNivel, 2), k.pos(0, PIES_MIN + 3), k.color(255, 255, 255), k.opacity(0.1), k.z(-2)]);
  }
}

/**
 * Valla del horizonte (exteriores, mockup del alumno): silueta oscura de
 * postes y dos travesaños plantada donde termina el fondo y empieza el piso.
 * Scrollea con el mundo (z -2, sobre el piso y bajo los personajes).
 */
function dibujarValla(k: KAPLAYCtx, anchoNivel: number): void {
  const SILUETA: [number, number, number] = [7, 14, 8];
  const ALTO_POSTE = 26;
  const yBase = PIES_MIN + 2;
  k.add([k.rect(anchoNivel, 3), k.pos(0, yBase - ALTO_POSTE + 6), k.color(...SILUETA), k.z(-2)]);
  k.add([k.rect(anchoNivel, 3), k.pos(0, yBase - 12), k.color(...SILUETA), k.z(-2)]);
  for (let x = 0; x < anchoNivel; x += 56) {
    k.add([k.rect(5, ALTO_POSTE, ), k.pos(x, yBase - ALTO_POSTE), k.color(...SILUETA), k.z(-2)]);
  }
  // Sombra al pie de la valla: asienta la silueta sobre el piso.
  k.add([k.rect(anchoNivel, 4), k.pos(0, yBase), k.color(0, 0, 0), k.opacity(0.35), k.z(-2)]);
}

/** Un tono del acento: el mismo matiz, escalado en brillo (0..1). */
function tono(color: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.min(255, Math.round(color[0] * factor)),
    Math.min(255, Math.round(color[1] * factor)),
    Math.min(255, Math.round(color[2] * factor)),
  ];
}

/**
 * Dibuja el camino como SUELO SÓLIDO, a la Double Dragon: una vereda opaca que
 * ocupa la banda pisable, con su línea de contacto contra el fondo, un bordillo
 * brillante en el borde frontal con faldón oscuro debajo (el "espesor" de la
 * acera) y trazos diagonales paralelos sobre la superficie — son esas diagonales
 * las que venden la fuga hacia la derecha y la profundidad del piso. La versión
 * anterior era una banda translúcida y se leía como un overlay de debug, no
 * como un lugar donde pisar.
 *
 * Sigue sin `k.area()`: el suelo no colisiona, solo acota (el clamp vive en
 * level.ts) — paredes de verdad traerían riesgo de softlock (ver AGENTS.md).
 *
 * Los bordes se dibujan con rectángulos, no con polígonos. El truco para que
 * una curva hecha de rectángulos no se vea como una ESCALERA es que cada
 * segmento cubra el salto hasta el siguiente: se muestrea el camino en `x` y en
 * `x + paso`, y el rectángulo se estira para tapar ambas alturas.
 */
function dibujarCamino(k: KAPLAYCtx, camino: Camino, anchoNivel: number, color: [number, number, number]): void {
  const suelo = tono(color, 0.2);
  const bordeFondo = tono(color, 0.7);
  const faldon = tono(color, 0.12);
  const ancho = PASO_CAMINO + 1;

  for (let x = 0; x < anchoNivel; x += PASO_CAMINO) {
    const aqui = camino.bandaEn(x);
    const siguiente = camino.bandaEn(x + PASO_CAMINO);
    const arriba = Math.min(aqui.min, siguiente.min);
    const abajo = Math.max(aqui.max, siguiente.max);

    // Cuerpo del suelo: OPACO. Tapa la base de los carretes (z -4/-6) y el
    // suelo pintado de los fondos F13, y así asienta a los personajes.
    k.add([k.rect(ancho, abajo - arriba), k.pos(x, arriba), k.color(...suelo), k.z(-3)]);

    // Línea de contacto con el fondo (donde la "pared" encuentra el piso).
    const bordeSuperior = Math.abs(aqui.min - siguiente.min) + GROSOR_BORDE;
    k.add([k.rect(ancho, bordeSuperior), k.pos(x, arriba), k.color(...bordeFondo), k.z(-2)]);

    // Bordillo frontal brillante + faldón oscuro debajo: el canto de la vereda.
    const saltoInferior = Math.abs(aqui.max - siguiente.max);
    k.add([
      k.rect(ancho, saltoInferior + ALTO_BORDILLO),
      k.pos(x, Math.min(aqui.max, siguiente.max) - ALTO_BORDILLO),
      k.color(...color),
      k.z(-2),
    ]);
    k.add([k.rect(ancho, ALTO_FALDON), k.pos(x, abajo), k.color(...faldon), k.z(-2)]);
  }

  // Trazos diagonales sobre el suelo (las "rayas" de Double Dragon): paralelos,
  // inclinados hacia la derecha, siguiendo la curva. Son los que dan la fuga.
  const diagonal = tono(color, 0.42);
  for (let x = 40; x < anchoNivel - 20; x += 96) {
    const centro = camino.centroEn(x);
    const semi = camino.semiAltoEn(x);
    k.add([
      k.rect(3, semi * 1.7),
      k.pos(x, centro),
      k.anchor("center"),
      k.rotate(34),
      k.color(...diagonal),
      k.z(-2),
    ]);
  }
  // Rayas cortas del bordillo (el patrón del canto, como la banda de la vereda).
  for (let x = 24; x < anchoNivel; x += 48) {
    k.add([
      k.rect(3, ALTO_BORDILLO + 6),
      k.pos(x, camino.bandaEn(x).max - ALTO_BORDILLO / 2),
      k.anchor("center"),
      k.rotate(34),
      k.color(...tono(color, 0.55)),
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

/** Fondos de EXTERIOR: los únicos donde los carretes tienen sentido — siluetas
 * de edificios, cercas y postes flotando dentro del apartamento rojo o del dojo
 * blanco rompían la escena en vez de darle profundidad. */
const FONDOS_EXTERIOR = new Set([
  "01-ciudad-digital",
  "04-tejado-lluvia",
  "05-cabina-telefonica",
  "07-desierto-maquinas",
]);

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

/** Banda oscura tras el HUD: sin ella el texto verde es ilegible sobre fondos
 * claros (WCAG AA con opacity 0.72, ver el cálculo en la nota de abajo). */
function agregarBandaHud(k: KAPLAYCtx): void {
  k.add([k.rect(ANCHO, 56), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.72), k.z(-99), k.fixed()]);
}

/** Factor de parallax del paisaje lejano: casi quieto, pero se mueve. */
const PARALLAX_LEJANO = 0.22;

/**
 * Carrete LEJANO de exterior (F14 v5): el paisaje. La imagen entera del fondo
 * se encaja EN PEQUEÑO en la banda entre el borde superior y el horizonte del
 * piso, repetida a lo ancho — se ven los edificios completos a lo lejos, en
 * vez de un recorte gigante de la franja del medio (mockup del alumno). Y es
 * un CARRETE, no un backdrop fijo: scrollea despacio (parallax 0.22) mientras
 * el piso corre 1:1. El modelo es dos carretes — el cercano es el piso que
 * pisa el personaje, el lejano son las imágenes de BG.
 */
function agregarFondoLejano(k: KAPLAYCtx, nombre: string, anchoNivel: number): void {
  const ALTO_IMAGEN = 640;
  const escala = PIES_MIN / ALTO_IMAGEN;
  const anchoTile = Math.round(ANCHO * escala);
  const capa = crearCapaParallax(k, PARALLAX_LEJANO, -100);
  // En espacio de carrete la cámara avanza a `factor`, y al principio del
  // nivel el borde izquierdo mira espacio NEGATIVO (gotcha ya pagado con los
  // carretes): se siembra desde -2 tiles hasta cubrir todo el recorrido.
  const hasta = anchoNivel * PARALLAX_LEJANO + ANCHO;
  for (let x = -2 * anchoTile; x < hasta; x += anchoTile) {
    capa.add([k.sprite(`fondo-${nombre}`), k.pos(x, 0), k.scale(escala)]);
  }
  agregarBandaHud(k);
}

/** Backdrop de INTERIOR, fijo a pantalla: la imagen del fondo a tamaño real —
 * la pared del cuarto está cerca y el recorte de cuerpo entero funciona.
 * El fondo procesado es 960x640 y el canvas 960x540; se ancla en y=-50 para
 * centrar verticalmente (recorta 50px arriba y 50px abajo, sin bandas negras). */
function agregarFondoImagen(k: KAPLAYCtx, nombre: string): void {
  k.add([k.sprite(`fondo-${nombre}`), k.pos(0, -(640 - ALTO) / 2), k.z(-100), k.fixed()]);
  // Cálculo de la banda del HUD: el texto VERDE (0,255,70) necesita 4.5:1
  // (WCAG AA) sobre el fondo más claro (el dojo blanco); con opacity=0.72
  // sobre blanco el fondo efectivo da ratio ~6.8:1. La banda inferior que
  // existía con el mismo fin ya no: el suelo tileado (F14 v3) la tapaba — los
  // avisos de abajo llevan ahora su propio respaldo (level.ts).
  agregarBandaHud(k);
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

  // F13: si el módulo tiene fondo de imagen, es el decorado. El suelo es la
  // franja recortada del propio fondo, tileada en mundo (F14 v3): así cada
  // escenario camina sobre SU suelo pintado, no sobre una calzada genérica.
  const fondo = FONDO_POR_MODULO[moduloId];
  if (fondo) {
    // Modelo de DOS carretes (pedido del alumno): el cercano es el piso que
    // pisa el personaje (1:1 con la cámara) y el lejano son las imágenes de BG
    // en pequeño con parallax lento. Los carretes procedurales intermedios
    // (cercas/postes brillantes) quedaron redundantes y ensuciaban la escena.
    // Interior: la pared del cuarto a tamaño real, fija.
    if (FONDOS_EXTERIOR.has(fondo)) {
      agregarFondoLejano(k, fondo, anchoNivel);
    } else {
      agregarFondoImagen(k, fondo);
    }
    agregarSueloImagen(k, fondo, anchoNivel);
    // Sin flechas ">>" sobre el suelo: hacían falta cuando el escenario era un
    // cuarto único sin señal de avance, pero con el piso texturizado que
    // scrollea y el paisaje en parallax la dirección ya se lee sola (F14 v6).
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

// ---------------------------------------------------------------------------
// Puerta de salida por escenario (F17)
// ---------------------------------------------------------------------------
//
// La salida era un rectángulo verde con la palabra EXIT, igual en los diez
// niveles. Ahora cada escenario tiene la suya, construida con las mismas
// primitivas que el resto del decorado: marco + hoja + un detalle propio del
// lugar. Un solo `switch` con las diferencias (DRY): la estructura común se
// dibuja una vez y cada estilo solo añade lo suyo.

export const ANCHO_PORTAL = 72;
export const ALTO_PORTAL = 190;

/** Estilos de puerta; cada fondo apunta a uno. */
type EstiloPuerta =
  | "cabina-codigo"
  | "oficina"
  | "shoji"
  | "azotea"
  | "telefono"
  | "hotel"
  | "apartamento"
  | "compuerta"
  | "escotilla"
  | "monitor";

const PUERTA_POR_FONDO: Record<string, EstiloPuerta> = {
  "01-ciudad-digital": "cabina-codigo",
  "02-pasillo-oficina": "oficina",
  "03-sala-entrenamiento": "shoji",
  "04-tejado-lluvia": "azotea",
  "05-cabina-telefonica": "telefono",
  "06-apartamento-rojo": "apartamento",
  "07-desierto-maquinas": "compuerta",
  "08-nave-subterranea": "escotilla",
  "09-sala-pantallas": "monitor",
  "10-corredor-hotel": "hotel",
};

/**
 * Crea la puerta de salida del nivel: un objeto con `area()` y tag "portal"
 * (level.ts engancha la colisión) más las piezas visuales como hijos, que
 * siguen al padre sin recalcular posiciones.
 *
 * El halo latiendo es lo que la hace leer como SALIDA y no como decorado: tras
 * limpiar el nivel, el jugador tiene que encontrarla de un vistazo.
 */
export function crearPortal(k: KAPLAYCtx, x: number, y: number, moduloId: string): GameObj {
  const acento = acentoDe(moduloId);
  const vivo: [number, number, number] = acento === VERDE_OSCURO ? VERDE : acento;
  const fondo = FONDO_POR_MODULO[moduloId];
  const estilo = PUERTA_POR_FONDO[fondo ?? ""] ?? "cabina-codigo";

  const portal = k.add([k.pos(x, y), areaPortal(k), k.z(1), "portal"]);
  const pieza = (
    dx: number,
    dy: number,
    ancho: number,
    alto: number,
    color: readonly [number, number, number],
    opacidad = 1,
    z = 1
  ) =>
    portal.add([
      k.rect(ancho, alto),
      k.pos(dx, dy),
      k.color(color[0], color[1], color[2]),
      k.opacity(opacidad),
      k.z(z),
    ]);

  // Halo: aura tenue que late detrás del marco. Común a todas las puertas.
  const halo = portal.add([
    k.rect(ANCHO_PORTAL + 16, ALTO_PORTAL + 16),
    k.pos(-8, -8),
    k.color(...vivo),
    k.opacity(0.16),
    k.z(-1),
  ]);
  let t = 0;
  halo.onUpdate(() => {
    t += k.dt();
    halo.opacity = 0.12 + 0.12 * (1 + Math.sin(t * 3)) * 0.5;
  });

  // Estructura común: marco iluminado + hoja oscura + umbral en el suelo.
  pieza(0, 0, ANCHO_PORTAL, ALTO_PORTAL, vivo, 0.85);
  pieza(4, 4, ANCHO_PORTAL - 8, ALTO_PORTAL - 4, NEGRO, 0.92, 2);
  pieza(-6, ALTO_PORTAL - 4, ANCHO_PORTAL + 12, 5, vivo, 0.5, 3);

  const centro = ANCHO_PORTAL / 2;
  switch (estilo) {
    case "cabina-codigo": {
      // Lluvia de código congelada dentro del vano: la puerta a la Matrix.
      for (let i = 0; i < 7; i++) {
        pieza(12 + (i % 3) * 16, 18 + i * 22, 3, 12, vivo, 0.55, 3);
      }
      break;
    }
    case "oficina": {
      // Puerta de oficina: ventanita superior, placa y picaporte.
      pieza(14, 20, ANCHO_PORTAL - 28, 44, vivo, 0.3, 3);
      pieza(14, 20, ANCHO_PORTAL - 28, 2, vivo, 0.7, 3);
      pieza(18, 86, ANCHO_PORTAL - 36, 12, vivo, 0.45, 3);
      pieza(ANCHO_PORTAL - 20, 118, 8, 4, vivo, 0.9, 3);
      break;
    }
    case "shoji": {
      // Puerta corredera japonesa: retícula de papel, encaja con el dojo.
      for (let fx = 12; fx < ANCHO_PORTAL - 10; fx += 16) pieza(fx, 8, 2, ALTO_PORTAL - 14, vivo, 0.4, 3);
      for (let fy = 20; fy < ALTO_PORTAL - 10; fy += 30) pieza(8, fy, ANCHO_PORTAL - 16, 2, vivo, 0.4, 3);
      break;
    }
    case "azotea": {
      // Puerta metálica de azotea: refuerzos diagonales y barra antipánico.
      pieza(10, 30, ANCHO_PORTAL - 20, 3, vivo, 0.5, 3);
      pieza(10, ALTO_PORTAL - 50, ANCHO_PORTAL - 20, 3, vivo, 0.5, 3);
      // Refuerzo en diagonal: 96px y anclado al CENTRO del vano — con 120px
      // desde y=34 el rectángulo rotado se salía por la esquina del marco.
      portal.add([
        k.rect(4, 96),
        k.pos(centro, ALTO_PORTAL / 2),
        k.anchor("center"),
        k.rotate(38),
        k.color(vivo[0], vivo[1], vivo[2]),
        k.opacity(0.35),
        k.z(3),
      ]);
      pieza(8, 104, ANCHO_PORTAL - 16, 6, vivo, 0.8, 3);
      break;
    }
    case "telefono": {
      // Cabina: cristal alto, auricular colgado y el rótulo encendido arriba.
      pieza(12, 26, ANCHO_PORTAL - 24, ALTO_PORTAL - 60, vivo, 0.22, 3);
      pieza(12, 26, ANCHO_PORTAL - 24, 2, vivo, 0.6, 3);
      pieza(6, 8, ANCHO_PORTAL - 12, 12, vivo, 0.75, 3);
      pieza(20, 70, 6, 22, vivo, 0.7, 3);
      pieza(20, 70, 16, 5, vivo, 0.7, 3);
      break;
    }
    case "hotel": {
      // Puerta de habitación: placa con número, mirilla y picaporte.
      pieza(centro - 16, 26, 32, 16, vivo, 0.5, 3);
      portal.add([
        k.text("101", { size: 11 }),
        k.pos(centro, 34),
        k.anchor("center"),
        k.color(...NEGRO),
        k.z(4),
      ]);
      pieza(centro - 2, 58, 4, 4, vivo, 0.9, 3);
      pieza(ANCHO_PORTAL - 22, 116, 10, 4, vivo, 0.9, 3);
      break;
    }
    case "apartamento": {
      // El cuarto de la píldora: mirilla, cadena de seguridad descolgada y la
      // rendija de luz roja por debajo de la hoja.
      pieza(centro - 3, 46, 6, 6, vivo, 0.9, 3);
      pieza(14, 74, 26, 3, vivo, 0.55, 3);
      pieza(14, 74, 3, 12, vivo, 0.55, 3);
      pieza(ANCHO_PORTAL - 24, 112, 12, 5, vivo, 0.9, 3);
      pieza(6, ALTO_PORTAL - 12, ANCHO_PORTAL - 12, 4, ROJO, 0.55, 3);
      break;
    }
    case "compuerta": {
      // Compuerta industrial: dos hojas que se abren al medio, con remaches.
      pieza(centro - 1, 6, 2, ALTO_PORTAL - 14, vivo, 0.6, 3);
      for (let fy = 20; fy < ALTO_PORTAL - 20; fy += 26) {
        pieza(10, fy, 4, 4, vivo, 0.65, 3);
        pieza(ANCHO_PORTAL - 14, fy, 4, 4, vivo, 0.65, 3);
      }
      break;
    }
    case "escotilla": {
      // Escotilla de nave: aro exterior, volante central y luces de estado.
      pieza(10, 40, ANCHO_PORTAL - 20, ANCHO_PORTAL - 20, vivo, 0.18, 3);
      pieza(10, 40, ANCHO_PORTAL - 20, 3, vivo, 0.6, 3);
      pieza(10, 40 + ANCHO_PORTAL - 23, ANCHO_PORTAL - 20, 3, vivo, 0.6, 3);
      pieza(centro - 14, 70, 28, 4, vivo, 0.8, 3);
      pieza(centro - 2, 58, 4, 28, vivo, 0.8, 3);
      pieza(centro - 12, 150, 6, 6, vivo, 0.9, 3);
      pieza(centro + 6, 150, 6, 6, ROJO, 0.7, 3);
      break;
    }
    case "monitor": {
      // Portal-monitor: pantalla encendida con líneas de escaneo.
      pieza(10, 16, ANCHO_PORTAL - 20, ALTO_PORTAL - 44, vivo, 0.2, 3);
      for (let fy = 24; fy < ALTO_PORTAL - 34; fy += 8) {
        pieza(12, fy, ANCHO_PORTAL - 24, 1, vivo, 0.4, 4);
      }
      pieza(centro - 10, ALTO_PORTAL - 22, 20, 5, vivo, 0.7, 3);
      break;
    }
  }

  // Rótulo: fuera del vano para no taparlo, sobre el dintel.
  portal.add([
    k.text("SALIDA", { size: 12 }),
    k.pos(centro, -22),
    k.anchor("center"),
    k.color(...vivo),
    k.z(4),
  ]);
  return portal;
}

function areaPortal(k: KAPLAYCtx) {
  return k.area({ shape: new k.Rect(k.vec2(0, 0), ANCHO_PORTAL, ALTO_PORTAL) });
}
