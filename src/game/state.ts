import { cargarConfig } from "../ai/config";
import { crearProvider } from "../ai/factory";
import { AIProvider } from "../ai/provider";
import { BancoModulo } from "../domain/reto";
import { GameSession } from "../domain/session";

/** Estado global de la partida compartido entre escenas. */
export interface GameState {
  session: GameSession;
  bancos: BancoModulo[];
  ai: AIProvider;
}

export function crearEstadoInicial(bancos: BancoModulo[]): GameState {
  return {
    session: new GameSession(),
    bancos,
    // El provider sale de la config BYOK guardada; sin key = fallback estático.
    ai: crearProvider(cargarConfig()),
  };
}
