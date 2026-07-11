import { GameObj, KAPLAYCtx } from "kaplay";
import { BLANCO, NEGRO, ROJO, VERDE, VERDE_OSCURO } from "./theme";

/**
 * Personajes 100% dibujados por código: siluetas simples (cabeza + torso +
 * piernas) armadas con primitivas de Kaplay — sin sprites ni assets externos.
 * El objeto padre define la posición y el área de colisión (mismos tags que
 * antes: "player" / "agente" / "oraculo"); las partes del cuerpo son hijos
 * puramente visuales posicionados en relativo (anchor top-left, igual que el
 * resto del juego).
 */

export const ANCHO_NEO = 20;
export const ALTO_NEO = 30;
export const ANCHO_AGENTE = 22;
export const ALTO_AGENTE = 32;
export const ESCALA_JEFE = 1.45;

export interface ActorAgente {
  root: GameObj;
  ancho: number;
  alto: number;
}

interface Piernas {
  izquierda: GameObj;
  derecha: GameObj;
}

/**
 * Contorno claro para toda pieza de silueta: sin esto, el relleno negro de
 * trajes/piernas se funde con el fondo negro del canvas (`background: [0,0,0]`
 * en main.ts) y el personaje "desaparece" salvo por sus piezas de color
 * (cabeza, corbata, etc.) — bug real encontrado en el playtest de F11.
 */
function contorno(k: KAPLAYCtx) {
  return k.outline(1.5, k.rgb(...BLANCO));
}

function agregarPiernas(
  k: KAPLAYCtx,
  actor: GameObj,
  ancho: number,
  alto: number,
  color: [number, number, number]
): { piernas: Piernas; yBase: number } {
  const anchoPierna = ancho * 0.32;
  const altoPierna = alto * 0.3;
  const yBase = alto - altoPierna;
  const izquierda = actor.add([
    k.rect(anchoPierna, altoPierna),
    k.pos(ancho * 0.08, yBase),
    k.color(...color),
    contorno(k),
  ]);
  const derecha = actor.add([
    k.rect(anchoPierna, altoPierna),
    k.pos(ancho * 0.6, yBase),
    k.color(...color),
    contorno(k),
  ]);
  return { piernas: { izquierda, derecha }, yBase };
}

/** Ciclo de caminata: alterna la altura de las piernas según lo que se movió el actor este frame. */
function animarCaminata(k: KAPLAYCtx, actor: GameObj, piernas: Piernas, yBase: number): void {
  let anterior = actor.pos.clone();
  let t = 0;
  actor.onUpdate(() => {
    const distancia = actor.pos.dist(anterior);
    anterior = actor.pos.clone();
    if (distancia > 0.5) {
      t += k.dt() * 14;
      const offset = Math.sin(t) * 3;
      piernas.izquierda.pos.y = yBase + offset;
      piernas.derecha.pos.y = yBase - offset;
    } else {
      piernas.izquierda.pos.y = yBase;
      piernas.derecha.pos.y = yBase;
    }
  });
}

/** Idle bob: leve oscilación vertical constante para que nada quede estático en pantalla. */
function animarIdle(k: KAPLAYCtx, parte: GameObj, amplitud = 1.5): void {
  const base = parte.pos.y;
  let t = Math.random() * 10;
  parte.onUpdate(() => {
    t += k.dt() * 4;
    parte.pos.y = base + Math.sin(t) * amplitud;
  });
}

/** Área de colisión rectangular con origen en el top-left del actor (igual que sus partes visuales). */
function areaRectangular(k: KAPLAYCtx, ancho: number, alto: number) {
  return k.area({ shape: new k.Rect(k.vec2(0, 0), ancho, alto) });
}

/** Neo (jugador): gabardina verde sobre traje oscuro, gafas negras. */
export function crearNeo(k: KAPLAYCtx, x: number, y: number): GameObj {
  const neo = k.add([k.pos(x, y), areaRectangular(k, ANCHO_NEO, ALTO_NEO), k.z(2), "player"]);
  const { piernas, yBase } = agregarPiernas(k, neo, ANCHO_NEO, ALTO_NEO, NEGRO);
  neo.add([
    k.rect(ANCHO_NEO + 4, ALTO_NEO * 0.55),
    k.pos(-2, ALTO_NEO * 0.2),
    k.color(...VERDE_OSCURO),
    contorno(k),
  ]); // gabardina, más ancha que el torso
  neo.add([
    k.rect(ANCHO_NEO, ALTO_NEO * 0.5),
    k.pos(0, ALTO_NEO * 0.22),
    k.color(...VERDE),
    contorno(k),
  ]); // torso
  const cabeza = neo.add([
    k.rect(ANCHO_NEO * 0.55, ALTO_NEO * 0.22),
    k.pos(ANCHO_NEO * 0.22, 0),
    k.color(...BLANCO),
    contorno(k),
  ]);
  neo.add([
    k.rect(ANCHO_NEO * 0.55, ALTO_NEO * 0.08),
    k.pos(ANCHO_NEO * 0.22, ALTO_NEO * 0.06),
    k.color(...NEGRO),
  ]); // gafas
  animarCaminata(k, neo, piernas, yBase);
  animarIdle(k, cabeza);
  return neo;
}

/** Agente Smith: traje negro, corbata roja, gafas — el Jefe es la misma silueta escalada. */
export function crearAgente(k: KAPLAYCtx, x: number, y: number, esJefe = false): ActorAgente {
  const escala = esJefe ? ESCALA_JEFE : 1;
  const ancho = ANCHO_AGENTE * escala;
  const alto = ALTO_AGENTE * escala;
  const tags = esJefe ? ["agente", "jefe"] : ["agente"];
  const root = k.add([k.pos(x, y), areaRectangular(k, ancho, alto), k.z(1), ...tags]);
  if (esJefe) {
    root.add([k.rect(ancho + 6, alto + 6), k.pos(-3, -3), k.color(...ROJO), k.opacity(0.18), k.z(-1)]);
  }
  const { piernas, yBase } = agregarPiernas(k, root, ancho, alto, NEGRO);
  root.add([k.rect(ancho, alto * 0.5), k.pos(0, alto * 0.22), k.color(...NEGRO), contorno(k)]); // traje
  root.add([
    k.rect(ancho * 0.16, alto * 0.32),
    k.pos(ancho * 0.42, alto * 0.24),
    k.color(...ROJO),
    contorno(k),
  ]); // corbata
  const cabeza = root.add([
    k.rect(ancho * 0.55, alto * 0.22),
    k.pos(ancho * 0.22, 0),
    k.color(...BLANCO),
    contorno(k),
  ]);
  root.add([k.rect(ancho * 0.55, alto * 0.08), k.pos(ancho * 0.22, alto * 0.06), k.color(...NEGRO)]); // gafas
  animarCaminata(k, root, piernas, yBase);
  animarIdle(k, cabeza, esJefe ? 2.2 : 1.4);
  return { root, ancho, alto };
}

/** El Oráculo: silueta serena, sin piernas (flota), aura suave detrás. */
export function crearOraculo(k: KAPLAYCtx, x: number, y: number): GameObj {
  const ancho = 26;
  const alto = 30;
  const oraculo = k.add([k.pos(x, y), areaRectangular(k, ancho, alto), k.z(1), "oraculo"]);
  oraculo.add([k.rect(ancho + 8, alto + 6), k.pos(-4, -3), k.color(...VERDE_OSCURO), k.opacity(0.25)]); // aura
  oraculo.add([k.rect(ancho, alto * 0.62), k.pos(0, alto * 0.3), k.color(...BLANCO), contorno(k)]); // túnica
  const cabeza = oraculo.add([
    k.rect(ancho * 0.6, alto * 0.28),
    k.pos(ancho * 0.2, 0),
    k.color(...BLANCO),
    contorno(k),
  ]);
  oraculo.add([k.rect(ancho * 0.6, alto * 0.08), k.pos(ancho * 0.2, alto * 0.28), k.color(...VERDE)]); // franja
  animarIdle(k, cabeza, 1.2);
  return oraculo;
}

/** Flash breve de golpe: superpone un rect semitransparente sobre el actor. */
export function flashGolpe(
  k: KAPLAYCtx,
  actor: GameObj,
  ancho: number,
  alto: number,
  color: [number, number, number],
  duracion = 0.12
): void {
  const flash = actor.add([k.rect(ancho, alto), k.color(...color), k.opacity(0.55), k.z(5)]);
  k.wait(duracion, () => k.destroy(flash));
}

/** Explosión simple al derrotar a un Agente: partículas = rects que se dispersan y desaparecen. */
export function crearExplosion(k: KAPLAYCtx, x: number, y: number): void {
  const colores: Array<[number, number, number]> = [ROJO, BLANCO, NEGRO];
  for (let i = 0; i < 6; i++) {
    const angulo = (Math.PI * 2 * i) / 6 + k.rand(-0.3, 0.3);
    const velocidad = k.rand(60, 140);
    const particula = k.add([
      k.rect(4, 4),
      k.pos(x, y),
      k.color(...k.choose(colores)),
      k.opacity(0.9),
      k.move(k.vec2(Math.cos(angulo), Math.sin(angulo)), velocidad),
      k.z(6),
    ]);
    k.wait(0.4, () => k.destroy(particula));
  }
}

export interface BarraHP {
  actualizar(hpActual: number, hpMaximo: number): void;
}

/** Barra de HP como hija del actor: sigue su posición automáticamente al moverse. */
export function crearBarraHP(k: KAPLAYCtx, actor: GameObj, ancho: number): BarraHP {
  const alto = 4;
  const y = -8;
  actor.add([k.rect(ancho, alto), k.pos(0, y), k.color(...NEGRO), k.z(4)]);
  const relleno = actor.add([k.rect(ancho, alto), k.pos(0, y), k.color(...VERDE), k.z(5)]);
  return {
    actualizar(hpActual: number, hpMaximo: number) {
      const proporcion = hpMaximo > 0 ? Math.max(0, hpActual) / hpMaximo : 0;
      relleno.width = ancho * proporcion;
      relleno.color = k.rgb(...(proporcion > 0.34 ? VERDE : ROJO));
    },
  };
}
