/**
 * Combate por golpes contra un Agente (F11): dominio puro, sin Kaplay.
 * Un Agente ya no cae con 1 acierto: hace falta golpearlo varias veces.
 */

export const HP_AGENTE_NORMAL = 2;
export const HP_JEFE = 4;

export interface EstadoCombate {
  hpActual: number;
  hpMaximo: number;
}

export function crearCombate(hpMaximo: number): EstadoCombate {
  return { hpActual: hpMaximo, hpMaximo };
}

/** Un acierto contra el Agente le resta 1 HP (nunca por debajo de 0). */
export function golpear(estado: EstadoCombate): EstadoCombate {
  return { ...estado, hpActual: Math.max(0, estado.hpActual - 1) };
}

export function derrotado(estado: EstadoCombate): boolean {
  return estado.hpActual <= 0;
}

export const BONUS_POR_BALA_ESQUIVADA = 10;
export const BONUS_ESQUIVE_PERFECTO = 30;

/**
 * Bonus de score de la secuencia de esquive "bullet time" previa a cada ronda.
 * Esquivar todas las balas suma un extra sobre el bonus lineal.
 */
export function calcularBonusEsquive(esquivadas: number, total: number): number {
  if (total <= 0 || esquivadas <= 0) return 0;
  const esquivadasClamp = Math.min(esquivadas, total);
  const base = esquivadasClamp * BONUS_POR_BALA_ESQUIVADA;
  return esquivadasClamp === total ? base + BONUS_ESQUIVE_PERFECTO : base;
}
