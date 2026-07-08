import { AIProvider } from "../ai/provider";
import { StaticFallback } from "../ai/static-fallback";
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
    ai: new StaticFallback(),
  };
}
