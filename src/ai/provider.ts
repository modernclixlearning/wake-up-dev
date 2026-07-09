import { RetoAbierta, RetoMultipleChoice } from "../domain/reto";

/** Resultado de evaluar una respuesta abierta contra su rúbrica. */
export interface EvaluacionAbierta {
  aprobado: boolean;
  feedback: string;
}

/**
 * Contrato de la capa IA del juego. Implementaciones:
 * - AnthropicAdapter / OpenAIAdapter / GeminiAdapter (BYOK, browser) — F4
 * - ClaudeHeadlessAdapter (bridge local, modo "píldora roja") — F8
 * - StaticFallback (sin IA; el juego siempre funciona) — F3
 */
export interface AIProvider {
  readonly nombre: string;
  /** true si el provider puede responder ahora (key configurada, bridge vivo, etc.). */
  disponible(): Promise<boolean>;
  /** El Oráculo: responde una duda del jugador con el contexto del módulo actual. */
  preguntarOraculo(contextoModulo: string, pregunta: string): Promise<string>;
  /** Califica una respuesta abierta contra la rúbrica del reto. */
  evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta>;
  /** Smith adaptativo: pista breve que orienta sin revelar la respuesta. */
  generarPista(reto: RetoMultipleChoice): Promise<string>;
}
