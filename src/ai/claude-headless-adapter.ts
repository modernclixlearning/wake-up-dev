import { RetoAbierta, RetoMultipleChoice } from "../domain/reto";
import { AIProvider, EvaluacionAbierta } from "./provider";

export const BRIDGE_URL_DEFAULT = "http://127.0.0.1:8137";

/**
 * Modo "píldora roja" (F8): habla con el bridge local (bridge/server.mjs),
 * que resuelve cada petición lanzando una instancia headless de Claude Code.
 * No requiere API key — usa la sesión del CLI del jugador.
 */
export class ClaudeHeadlessAdapter implements AIProvider {
  readonly nombre = "claude-headless";

  constructor(
    private baseUrl: string = BRIDGE_URL_DEFAULT,
    // Envuelto en arrow: window.fetch guardado como propiedad pierde su binding
    // a window y lanza "Illegal invocation" al invocarse.
    private fetchImpl: typeof fetch = (...args) => fetch(...args)
  ) {}

  async disponible(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await this.fetchImpl(`${this.baseUrl}/salud`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  async preguntarOraculo(contextoModulo: string, pregunta: string): Promise<string> {
    const data = await this.post<{ respuesta: string }>("/oraculo", {
      contexto: contextoModulo,
      pregunta,
    });
    return data.respuesta;
  }

  async evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta> {
    return this.post<EvaluacionAbierta>("/evaluar", {
      pregunta: reto.pregunta,
      rubrica: reto.rubrica,
      respuesta,
    });
  }

  async generarPista(reto: RetoMultipleChoice): Promise<string> {
    const data = await this.post<{ pista: string }>("/pista", {
      pregunta: reto.pregunta,
      opciones: reto.opciones,
    });
    return data.pista;
  }

  private async post<T>(ruta: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new Error(`bridge ${res.status}: ${texto.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
}
