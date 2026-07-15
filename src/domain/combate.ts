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

/**
 * Fase de combate arcade (F12): antes de cada pregunta hay que pelear de
 * verdad — conectar golpes (piñas contra Smiths, tiros contra el Jefe) hasta
 * aturdir al enemigo. Recién ahí se abre la pregunta, que es la que baja el
 * HP real del Agente. Si no peleás, el enemigo te pega a vos y perdés vidas.
 */

export const GOLPES_PARA_ATURDIR = 3;
export const BONUS_POR_GOLPE_CONECTADO = 10;
export const BONUS_FASE_SIN_DANO = 30;

export interface FaseCombate {
  golpesConectados: number;
  golpesRecibidos: number;
}

export function crearFase(): FaseCombate {
  return { golpesConectados: 0, golpesRecibidos: 0 };
}

export function conectarGolpe(fase: FaseCombate): FaseCombate {
  return { ...fase, golpesConectados: fase.golpesConectados + 1 };
}

export function recibirGolpe(fase: FaseCombate): FaseCombate {
  return { ...fase, golpesRecibidos: fase.golpesRecibidos + 1 };
}

/** El enemigo queda aturdido (y se abre la pregunta) al conectarle suficientes golpes. */
export function enemigoAturdido(fase: FaseCombate): boolean {
  return fase.golpesConectados >= GOLPES_PARA_ATURDIR;
}

/**
 * Bonus de score al completar una fase de combate: lineal por golpe conectado,
 * con extra si el jugador no recibió ningún golpe en la fase.
 */
export function calcularBonusFase(fase: FaseCombate): number {
  if (fase.golpesConectados <= 0) return 0;
  const base = fase.golpesConectados * BONUS_POR_GOLPE_CONECTADO;
  return fase.golpesRecibidos === 0 ? base + BONUS_FASE_SIN_DANO : base;
}
