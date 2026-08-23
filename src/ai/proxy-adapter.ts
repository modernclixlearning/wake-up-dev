import { RetoAbierta, RetoMultipleChoice } from "../domain/reto";
import { AIProvider, EvaluacionAbierta } from "./provider";

const ENDPOINT = "/api/oraculo";

export class ProxyAdapter implements AIProvider {
  readonly nombre = "proxy";

  constructor(
    // Envuelto en arrow para no perder el binding de window.fetch ("Illegal invocation").
    private fetchImpl: typeof fetch = (...args) => fetch(...args)
  ) {}

  async disponible(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(ENDPOINT);
      if (!res.ok) return false;
      const data = (await res.json()) as { disponible?: unknown };
      return data.disponible === true;
    } catch {
      return false;
    }
  }

  async preguntarOraculo(contextoModulo: string, pregunta: string): Promise<string> {
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: "oraculo", contexto: contextoModulo, pregunta }),
    });
    return this.extraerTexto(res);
  }

  async evaluarAbierta(reto: RetoAbierta, respuesta: string): Promise<EvaluacionAbierta> {
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: "evaluar", pregunta: reto.pregunta, rubrica: reto.rubrica, respuesta }),
    });
    await this.verificarRespuesta(res);
    const data = (await res.json()) as { aprobado?: boolean; feedback?: string };
    if (typeof data.aprobado !== "boolean" || typeof data.feedback !== "string") {
      throw new Error("Proxy: respuesta de evaluación inesperada.");
    }
    return { aprobado: data.aprobado, feedback: data.feedback };
  }

  async generarPista(reto: RetoMultipleChoice): Promise<string> {
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: "pista", pregunta: reto.pregunta, opciones: reto.opciones }),
    });
    return this.extraerTexto(res);
  }

  private async verificarRespuesta(res: Response): Promise<void> {
    if (res.status === 429) {
      throw new Error(
        "El Oráculo está saturado, probá en unos minutos."
      );
    }
    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      throw new Error(`Proxy error (${res.status}): ${texto.slice(0, 200)}`);
    }
  }

  private async extraerTexto(res: Response): Promise<string> {
    await this.verificarRespuesta(res);
    const data = (await res.json()) as { texto?: string };
    if (typeof data.texto !== "string") {
      throw new Error("Proxy: respuesta sin campo 'texto'.");
    }
    return data.texto;
  }
}
