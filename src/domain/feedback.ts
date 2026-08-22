/**
 * Lógica pura de duración del cartel de feedback didáctico.
 * Sin dependencias de Kaplay, DOM ni IA — solo texto → segundos.
 */

/** Caracteres por segundo que un lector promedio procesa cómodamente. */
const CHARS_POR_SEGUNDO = 18;

/** Duración mínima del cartel de explicación (segundos). */
export const DURACION_MIN_FEEDBACK = 3;

/** Duración máxima del cartel de explicación (segundos). */
export const DURACION_MAX_FEEDBACK = 12;

/**
 * Calcula cuántos segundos debe permanecer visible la explicación de un reto,
 * proporcional a la longitud del texto con un mínimo y un máximo.
 */
export function calcularDuracionFeedback(texto: string): number {
  const segundos = texto.length / CHARS_POR_SEGUNDO;
  return Math.min(DURACION_MAX_FEEDBACK, Math.max(DURACION_MIN_FEEDBACK, segundos));
}
