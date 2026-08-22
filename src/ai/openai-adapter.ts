import { RetoAbierta, RetoMultipleChoice } from "../domain/reto";
import { AIProvider, EvaluacionAbierta } from "./provider";
import {
  parsearEvaluacion,
  promptEvaluacion,
  promptPista,
  systemEvaluador,
  systemOraculo,
  systemPista,
} from "./prompts";

export class OpenAIAdapter implements AIProvider {
  readonly nombre = "openai";

  /** Milisegundos antes de abortar una peticion colgada (30 s). */
  static readonly TIMEOUT_MS = 30_000;

  constructor(
    private apiKey: string,
    private model: string,
    // Envuelto en arrow para no perder el binding de window.fetch ("Illegal invocation").
    private fetchImpl: typeof fetch = (...args) => fetch(...args)
  ) {}

  async disponible(): Promise<boolean> {
    return true;
  }

  async preguntarOraculo(contextoModulo: string, pregunta: string): Promise<string> {
    return this.chat(systemOraculo(contextoModulo), pregunta);
  }

  async evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta> {
    const texto = await this.chat(systemEvaluador(), promptEvaluacion(reto, respuesta), true);
    return parsearEvaluacion(texto);
  }

  async generarPista(reto: RetoMultipleChoice): Promise<string> {
    return this.chat(systemPista(), promptPista(reto));
  }

  private async chat(system: string, user: string, json = false): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OpenAIAdapter.TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 500,
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("OpenAI timeout: la peticion tardo demasiado.");
      }
      throw new Error(`OpenAI error de red: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`OpenAI clave invalida (${res.status}): revisa tu API key en ajustes.`);
    }
    if (!res.ok) {
      throw new Error(`OpenAI error de red (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const texto = data.choices?.[0]?.message?.content;
    if (!texto) throw new Error("OpenAI no devolvio texto.");
    return texto;
  }
}