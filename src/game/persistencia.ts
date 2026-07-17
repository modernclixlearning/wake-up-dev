import { GameSession, restaurarSesion, serializarSesion } from "../domain/session";

/**
 * Persistencia del avance en localStorage (mismo patrón tolerante que la
 * config BYOK): si el storage está bloqueado o los datos vienen corruptos, el
 * juego sigue con una sesión nueva — nunca se rompe por no poder guardar.
 */

const CLAVE_PARTIDA = "wakeupdev.partida";

export function cargarPartida(): GameSession {
  try {
    const crudo = localStorage.getItem(CLAVE_PARTIDA);
    if (!crudo) return new GameSession();
    return restaurarSesion(JSON.parse(crudo));
  } catch {
    return new GameSession();
  }
}

export function guardarPartida(session: GameSession): void {
  try {
    localStorage.setItem(CLAVE_PARTIDA, JSON.stringify(serializarSesion(session)));
  } catch {
    // Sin storage (incógnito estricto): la partida vive solo en memoria.
  }
}

export function borrarPartida(): void {
  try {
    localStorage.removeItem(CLAVE_PARTIDA);
  } catch {
    // Sin storage no hay nada que borrar.
  }
}
