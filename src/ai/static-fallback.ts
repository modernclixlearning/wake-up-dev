import { RetoAbierta } from "../domain/reto";
import { AIProvider, EvaluacionAbierta } from "./provider";

/**
 * Provider sin IA: el juego completo funciona solo con el banco JSON.
 * Los retos abiertos se sustituyen por su variante multiple-choice (ver QuizEngine.fallbackDe)
 * y el Oráculo responde con un mensaje fijo.
 */
export class StaticFallback implements AIProvider {
  readonly nombre = "static-fallback";

  async disponible(): Promise<boolean> {
    return true;
  }

  async preguntarOraculo(): Promise<string> {
    return (
      "El Oráculo duerme... Conecta una API key en ajustes (o el bridge local) " +
      "para despertarla. Mientras tanto: la respuesta está en tus notas del curso."
    );
  }

  async evaluarAbierta(_reto: RetoAbierta, _respuesta: string): Promise<EvaluacionAbierta> {
    throw new Error(
      "StaticFallback no evalúa respuestas abiertas — usar la variante fallback del reto."
    );
  }
}
