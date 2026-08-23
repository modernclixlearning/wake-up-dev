/**
 * Aleatoriedad DETERMINISTA para el escenario (F14).
 *
 * El decorado del nivel (camino y carretes) tiene que verse "pseudo random"
 * pero ser el MISMO en cada partida y en cada máquina: si dependiera de
 * `Math.random`, el mismo módulo tendría un camino distinto cada vez que entrás
 * y no habría forma de testear la geometría ni de reproducir un bug de nivel.
 * Con una semilla derivada del id del módulo, cada nivel tiene su propia forma
 * estable y los tests pueden afirmar cosas concretas sobre ella.
 *
 * Dominio puro: sin kaplay, sin DOM.
 */

/** Hash FNV-1a de 32 bits: convierte el id de un módulo en una semilla numérica. */
export function semillaDe(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // >>> 0 para quedarnos con un entero sin signo (el imul puede dar negativos).
  return hash >>> 0;
}

/**
 * PRNG mulberry32: generador rápido de 32 bits, suficiente para decorado.
 * Devuelve una función que da números en [0, 1). No usar para criptografía.
 */
export function prng(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número aleatorio en [min, max). */
export function entre(aleatorio: () => number, min: number, max: number): number {
  return min + aleatorio() * (max - min);
}

/** Interpolación lineal. */
export function mezclar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Recorta `v` al rango [min, max]. */
export function acotar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Smoothstep: rampa suave de 0 a 1 en [0,1] con derivada nula en los extremos.
 * La usamos para abrir y cerrar el camino sin un codo brusco.
 */
export function suave(t: number): number {
  const x = acotar(t, 0, 1);
  return x * x * (3 - 2 * x);
}
