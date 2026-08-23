/**
 * Cuenta atrás para responder un reto (F15).
 *
 * El Agente queda aturdido un rato, no para siempre: si el jugador no responde
 * dentro del límite, Smith se despierta y conecta el golpe. Sin esto, la
 * pregunta congelaba el combate indefinidamente y se podía buscar la respuesta
 * con calma en otra pestaña — el reloj es lo que hace que el repaso valga.
 *
 * Dominio puro: sin kaplay, sin DOM, sin temporizadores reales. Acá vive el
 * CÁLCULO del estado a partir del tiempo restante; quien corre el reloj es la
 * escena (`k.onUpdate`) o el overlay DOM.
 */

/** Segundos para responder un reto de opciones. */
export const SEGUNDOS_MULTIPLE_CHOICE = 60;

/**
 * Segundos para un reto de respuesta abierta: más que en los de opciones
 * porque hay que redactar, no solo elegir.
 */
export const SEGUNDOS_ABIERTA = 120;

/** Por debajo de este resto, la cuenta atrás pasa a estado de alarma. */
export const UMBRAL_URGENTE = 10;

export interface EstadoCuentaAtras {
  /** Segundos enteros que quedan, nunca negativo (se muestran tal cual). */
  segundos: number;
  /** Etiqueta lista para pintar, formato `M:SS`. */
  texto: string;
  /** true en los últimos segundos: la UI lo usa para pintar en rojo. */
  urgente: boolean;
  /** true cuando se acabó el tiempo: el Agente se despierta y golpea. */
  agotado: boolean;
  /** 1 al empezar, 0 al agotarse — para barras de progreso. */
  fraccion: number;
}

/**
 * Estado de la cuenta atrás a partir del tiempo restante en segundos.
 *
 * Redondea hacia ARRIBA a propósito: con 0,4s restantes el jugador todavía
 * puede responder, así que debe leer "1" y no "0". El cartel llega a cero
 * exactamente cuando el tiempo se agota, no un segundo antes.
 */
export function calcularCuentaAtras(restante: number, total: number): EstadoCuentaAtras {
  const seguro = Number.isFinite(restante) ? restante : 0;
  const acotado = Math.max(0, seguro);
  const segundos = Math.ceil(acotado);
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return {
    segundos,
    texto: `${minutos}:${String(resto).padStart(2, "0")}`,
    urgente: acotado <= UMBRAL_URGENTE,
    agotado: acotado <= 0,
    fraccion: total > 0 ? Math.min(1, Math.max(0, acotado / total)) : 0,
  };
}

/** Límite de tiempo que le toca a un reto según su tipo. */
export function limiteDe(tipo: "multiple-choice" | "abierta"): number {
  return tipo === "abierta" ? SEGUNDOS_ABIERTA : SEGUNDOS_MULTIPLE_CHOICE;
}
