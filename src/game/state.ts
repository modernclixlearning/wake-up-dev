import { cargarConfig } from "../ai/config";
import { crearProvider } from "../ai/factory";
import { AIProvider } from "../ai/provider";
import { BancoModulo } from "../domain/reto";
import { GameSession } from "../domain/session";
import { cargarPartida } from "./persistencia";

/** Estado global de la partida compartido entre escenas. */
export interface GameState {
  session: GameSession;
  bancos: BancoModulo[];
  ai: AIProvider;
}

export function crearEstadoInicial(bancos: BancoModulo[]): GameState {
  return {
    // El avance guardado se retoma (score + módulos liberados, vidas llenas);
    // sin partida guardada o con datos corruptos arranca una sesión nueva.
    session: cargarPartida(),
    bancos,
    // El provider sale de la config BYOK guardada; sin key = fallback estático.
    ai: crearProvider(cargarConfig()),
  };
}
