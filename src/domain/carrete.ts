import { entre, prng } from "./aleatorio";

/**
 * CARRETES de decorado (F14).
 *
 * Un carrete es una secuencia de piezas sencillas sembradas a lo largo del
 * nivel —una mata de pasto, una cerca, un muro con graffiti— que el renderer
 * dibuja en una capa con parallax. Al scrollear la cámara, esa capa se mueve
 * más lento que el suelo y la mirada lee profundidad: es lo que convierte
 * "el personaje se desliza sobre un fondo quieto" en "el personaje avanza".
 *
 * Acá vive solo la SECUENCIA (qué pieza, en qué X, con qué variación). El
 * dibujo de cada pieza es cosa de `src/game/escenario.ts`: este módulo es
 * dominio puro y no sabe nada de kaplay.
 *
 * La secuencia es determinista por semilla: el mismo módulo tiene siempre el
 * mismo decorado, así se puede testear y así el nivel se ve igual en cada
 * partida (un decorado que cambia cada vez se lee como ruido, no como lugar).
 */

export type PiezaCarrete =
  | "pasto"
  | "cerca"
  | "muro"
  | "poste"
  | "barril"
  | "antena"
  | "edificio";

export interface ItemCarrete {
  /** Posición en el eje del carrete (no es X de mundo: el parallax la escala). */
  x: number;
  tipo: PiezaCarrete;
  /** 0..1 — el renderer la usa para variar tamaño y detalle sin volver a sortear. */
  variacion: number;
}

export interface PesoPieza {
  tipo: PiezaCarrete;
  /** Peso relativo dentro del repertorio (no hace falta que sumen 1). */
  peso: number;
}

export interface OpcionesCarrete {
  semilla: number;
  desde: number;
  hasta: number;
  /** Separación mínima entre piezas. */
  pasoMin: number;
  /** Separación máxima entre piezas. */
  pasoMax: number;
  repertorio: PesoPieza[];
  /**
   * Cuántas piezas IGUALES seguidas se toleran. Sin este tope, el sorteo
   * produce rachas ("muro, muro, muro") que se leen como un error de tileado
   * en vez de como variedad. Por defecto 2.
   */
  repeticionMaxima?: number;
}

/** Elige un tipo respetando los pesos del repertorio. */
function elegirTipo(repertorio: PesoPieza[], sorteo: number): PiezaCarrete {
  const total = repertorio.reduce((acc, p) => acc + p.peso, 0);
  let acumulado = 0;
  const objetivo = sorteo * total;
  for (const pieza of repertorio) {
    acumulado += pieza.peso;
    if (objetivo < acumulado) return pieza.tipo;
  }
  return repertorio[repertorio.length - 1].tipo;
}

/**
 * Genera la secuencia de piezas del carrete. Las X salen estrictamente
 * crecientes y separadas entre `pasoMin` y `pasoMax`.
 */
export function generarCarrete(o: OpcionesCarrete): ItemCarrete[] {
  if (o.repertorio.length === 0 || o.hasta <= o.desde) return [];
  const repeticionMaxima = Math.max(1, o.repeticionMaxima ?? 2);
  const aleatorio = prng(o.semilla);
  const items: ItemCarrete[] = [];

  let x = o.desde;
  let ultimoTipo: PiezaCarrete | null = null;
  let repeticiones = 0;

  while (x < o.hasta) {
    let tipo = elegirTipo(o.repertorio, aleatorio());
    // Racha cortada: si ya se repitió el tope, se fuerza cualquier otro tipo.
    if (tipo === ultimoTipo && repeticiones >= repeticionMaxima && o.repertorio.length > 1) {
      const alternativas = o.repertorio.filter((p) => p.tipo !== tipo);
      tipo = elegirTipo(alternativas, aleatorio());
    }
    repeticiones = tipo === ultimoTipo ? repeticiones + 1 : 1;
    ultimoTipo = tipo;

    items.push({ x, tipo, variacion: aleatorio() });
    x += entre(aleatorio, o.pasoMin, o.pasoMax);
  }

  return items;
}
