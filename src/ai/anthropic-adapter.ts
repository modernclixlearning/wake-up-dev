import Anthropic from "@anthropic-ai/sdk";
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

export class AnthropicAdapter implements AIProvider {
  readonly nombre = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string, fetchImpl?: typeof fetch) {
    this.model = model;
    this.client = new Anthropic({
      apiKey,
      // BYOK: la key es del jugador y vive en su navegador; no hay backend intermedio.
      dangerouslyAllowBrowser: true,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
  }

  async disponible(): Promise<boolean> {
    return true;
  }

  async preguntarOraculo(contextoModulo: string, pregunta: string): Promise<string> {
    return this.textoSimple(systemOraculo(contextoModulo), pregunta);
  }

  async generarPista(reto: RetoMultipleChoice): Promise<string> {
    return this.textoSimple(systemPista(), promptPista(reto));
  }

  private async textoSimple(system: string, user: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!texto) throw new Error("El modelo no devolvió texto.");
    return texto;
  }

  async evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 300,
      system: systemEvaluador(),
      messages: [{ role: "user", content: promptEvaluacion(reto, respuesta) }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              aprobado: { type: "boolean" },
              feedback: { type: "string" },
            },
            required: ["aprobado", "feedback"],
            additionalProperties: false,
          },
        },
      },
    });
    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return parsearEvaluacion(texto);
  }
}
