import { cargarConfig } from "../ai/config";
import { activarProxySiDisponible, crearProvider } from "../ai/factory";
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
  const config = cargarConfig();
  const st: GameState = {
    // El avance guardado se retoma (score + módulos liberados, vidas llenas);
    // sin partida guardada o con datos corruptos arranca una sesión nueva.
    session: cargarPartida(),
    bancos,
    // El provider sale de la config BYOK guardada; sin key = fallback estático.
    ai: crearProvider(config),
  };

  // Si el jugador no tiene config guardada, intentar activar el proxy en background.
  // Cuando la sonda termine, se reemplaza st.ai para que las escenas vean el proxy.
  // No se guarda nada en localStorage: es una decisión de arranque.
  if (config.provider === "ninguno") {
    activarProxySiDisponible((proxy) => {
      st.ai = proxy;
    });
  }

  return st;
}
