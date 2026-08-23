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
 * Dibuja un altavoz 8-bit (≈24×14 px) con rectángulos de Kaplay.
 *
 * Layout — coordenadas relativas al root (ancla = esquina sup-izq del cuerpo):
 *
 *   Cuerpo (cajón): rect 8×14, x=0..8, y=-7..7
 *
 *   Cono (triángulo escalonado, punta a la derecha):
 *     col base:  rect 3×14  x=8..11  y=-7..7    (columna más ancha, pegada al cuerpo)
 *     col media: rect 3×10  x=11..14 y=-5..5
 *     col punta: rect 3×6   x=14..17 y=-3..3
 *
 *   Ondas (solo estado ON):
 *     onda1: rect 3×8   x=19..22 y=-4..4
 *     onda2: rect 3×12  x=23..26 y=-6..6
 *
 *   Tachado (solo estado OFF): una barra diagonal roja, anchor center,
 *     centrada sobre el altavoz (cuerpo+cono, x=0..17, y=-7..7),
 *     centro ≈ (8, 0), grosor 4px, longitud 24px, ángulo 45°.
 *     Una sola diagonal (no X) = el símbolo "prohibido" reconocible.
 *
 * Fondo del juego es negro: todas las piezas usan VERDE (visible).
 * outline() solo funciona sobre shapes, no sobre text/sprite — OK aquí.
 * k.fixed() lo aplica la escena, no este módulo.
 */
export function crearIconoSonido(
  k: KAPLAYCtx,
  x: number,
  y: number,
): IconoSonido {
  // Contenedor padre — sin render propio
  const root = k.add([k.pos(x, y), k.z(10)]);

  // -- CUERPO del altavoz (cajón 8×14) --
  root.add([k.rect(8, 14), k.pos(0, -7), k.color(...VERDE)]);

  // -- CONO: 3 columnas escalonadas hacia la derecha --
  // Cada columna es más estrecha → simula el triángulo del altavoz.
  root.add([k.rect(3, 14), k.pos(8, -7), k.color(...VERDE)]);   // base
  root.add([k.rect(3, 10), k.pos(11, -5), k.color(...VERDE)]);  // medio
  root.add([k.rect(3, 6), k.pos(14, -3), k.color(...VERDE)]);   // punta

  // -- ONDAS: 2 barras verticales (visibles solo con sonido ON) --
  // Están un píxel separadas del cono para dar sensación de "aire".
  const onda1 = root.add([
    k.rect(3, 8),
    k.pos(19, -4),
    k.color(...VERDE),
    k.opacity(1),
  ]);
  const onda2 = root.add([
    k.rect(3, 12),
    k.pos(23, -6),
    k.color(...VERDE),
    k.opacity(1),
  ]);

  // -- TACHADO: barra diagonal roja (visible solo con sonido OFF) --
  // Cruza el altavoz (cuerpo+cono) de esquina sup-izq a inf-der.
  // Centro del altavoz: x≈8, y=0. anchor("center") centra la rotación.
  // 4px grosor, 24px longitud, 45° → cubre bien un rect 17×14.
  const tacho = root.add([
    k.rect(4, 24),
    k.pos(8, 0),
    k.anchor("center"),
    k.rotate(45),
    k.color(...ROJO),
    k.opacity(0),
  ]);

  function actualizar(silenciado: boolean): void {
    onda1.opacity = silenciado ? 0 : 1;
    onda2.opacity = silenciado ? 0 : 1;
    tacho.opacity = silenciado ? 1 : 0;
  }

  return { root, actualizar };
}
