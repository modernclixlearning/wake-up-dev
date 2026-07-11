/** Paleta Matrix: verde fósforo sobre negro. */
export const VERDE: [number, number, number] = [0, 255, 70];
export const VERDE_OSCURO: [number, number, number] = [0, 120, 40];
export const ROJO: [number, number, number] = [255, 60, 60];
export const BLANCO: [number, number, number] = [220, 255, 220];
export const NEGRO: [number, number, number] = [0, 0, 0];

/** Colores de acento por módulo (F11): dan una identidad visual distinta a cada nivel sin tocar el motor de movimiento. */
export const CIAN: [number, number, number] = [0, 220, 220];
export const AMBAR: [number, number, number] = [230, 170, 0];
export const VIOLETA: [number, number, number] = [150, 90, 230];
export const NARANJA: [number, number, number] = [230, 120, 30];
export const LIMA: [number, number, number] = [170, 230, 0];

export const ANCHO = 960;
export const ALTO = 540;

/** Carril de movimiento vertical dentro del nivel (F11 v2): da un "pasillo" claro
 * sin necesitar tilemap ni colisión de paredes — solo un clamp de posición. */
export const CARRIL_SUPERIOR = 60;
export const CARRIL_INFERIOR = ALTO - 70;

export const CHARS_MATRIX = "アイウエオ01<>{}/#$%&=+*;:凡例文字ラドクリフ".split("");
