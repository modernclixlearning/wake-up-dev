/**
 * Iconos 8-bit dibujados con rectángulos de Kaplay.
 * Deterministas, sin depender de glifos de fuente ni emojis.
 */

import { KAPLAYCtx, GameObj } from "kaplay";
import { VERDE, ROJO } from "./theme";

export interface IconoSonido {
  root: GameObj;
  /** Actualiza el icono al estado silenciado/activado. */
  actualizar(silenciado: boolean): void;
}

/**
 * Dibuja un altavoz 8-bit (≈14×14 px) con rectángulos de Kaplay.
 *
 * Layout pixel-art:
 *   Cuerpo del altavoz: rect 4×8 (el "cajón")
 *   Cono: 3 rects escalonados formando el triángulo (izquierda del cuerpo)
 *     no aplica — el cono va a la DERECHA del cuerpo (el altavoz mira a la derecha)
 *
 * Estructura:
 *   ┌──┐           cuerpo: rect 5×7
 *   │  │╲
 *   │  │  ╲  ──   ondas (3 rects a la derecha)
 *   │  │  ╱
 *   └──┘╱
 *
 * Implementación con rects cuadrados (sin polígonos):
 *   Cono = 3 rects horizontales escalonados que van aumentando en y (punta a la derecha)
 *   Ondas = 3 rects cortos escalonados con gaps
 */
export function crearIconoSonido(
  k: KAPLAYCtx,
  x: number,
  y: number,
): IconoSonido {
  // Contenedor padre — sin render propio
  const root = k.add([k.pos(x, y), k.z(10)]);

  // -- CUERPO del altavoz (rect 5×8 centrado en y=0) --
  const cuerpo = root.add([
    k.rect(5, 8),
    k.pos(0, -4),
    k.color(...VERDE),
  ]);

  // -- CONO (izquierda del cuerpo): 3 rects escalonados hacia la izquierda --
  // El cono apunta a la izquierda: el altavoz emite hacia la derecha.
  // Pixel art: el triángulo se forma con 3 rects de 3, 5, 7 px de alto.
  const cono1 = root.add([k.rect(2, 2), k.pos(-2, -1), k.color(...VERDE)]);
  const cono2 = root.add([k.rect(2, 4), k.pos(-4, -2), k.color(...VERDE)]);
  const cono3 = root.add([k.rect(2, 6), k.pos(-6, -3), k.color(...VERDE)]);

  // -- ONDAS (derecha del cuerpo): 2 rects escalonados --
  const onda1 = root.add([k.rect(2, 4), k.pos(5, -2), k.color(...VERDE), k.opacity(1)]);
  const onda2 = root.add([k.rect(2, 8), k.pos(8, -4), k.color(...VERDE), k.opacity(1)]);

  // -- TACHADO (X diagonal): dos rects rotados — solo visibles cuando silenciado --
  // Con rects de 2×12 rotados a 45° / -45° cubrimos el icono completo.
  const tacho1 = root.add([
    k.rect(2, 14),
    k.pos(-2, -7),
    k.rotate(45),
    k.color(...ROJO),
    k.opacity(0),
  ]);
  const tacho2 = root.add([
    k.rect(2, 14),
    k.pos(-2, -7),
    k.rotate(-45),
    k.color(...ROJO),
    k.opacity(0),
  ]);

  function actualizar(silenciado: boolean): void {
    const color = silenciado ? k.rgb(...ROJO) : k.rgb(...VERDE);

    // Colorear todas las partes del altavoz
    for (const parte of [cuerpo, cono1, cono2, cono3]) {
      parte.color = color;
    }

    // Ondas: visibles solo cuando activado
    onda1.opacity = silenciado ? 0 : 1;
    onda2.opacity = silenciado ? 0 : 1;

    // Tachado: visible solo cuando silenciado
    tacho1.opacity = silenciado ? 1 : 0;
    tacho2.opacity = silenciado ? 1 : 0;
  }

  return { root, actualizar };
}
