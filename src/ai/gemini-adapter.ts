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

export class GeminiAdapter implements AIProvider {
  readonly nombre = "gemini";

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
    return this.generar(systemOraculo(contextoModulo), pregunta);
  }

  async evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta> {
    const texto = await this.generar(systemEvaluador(), promptEvaluacion(reto, respuesta), true);
    return parsearEvaluacion(texto);
  }

  async generarPista(reto: RetoMultipleChoice): Promise<string> {
    return this.generar(systemPista(), promptPista(reto));
  }

  private async generar(system: string, user: string, json = false): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: 500,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texto = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!texto) throw new Error("Gemini no devolvió texto.");
    return texto;
  }
}
