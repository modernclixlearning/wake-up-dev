import { RetoAbierta } from "../domain/reto";
import { EvaluacionAbierta } from "./provider";

/** Prompts compartidos por todos los adapters — la lógica de negocio de la capa IA. */

export function systemOraculo(contextoModulo: string): string {
  return [
    "Sos el Oráculo del juego educativo 'Wake Up, Dev', ambientado en Matrix.",
    "El jugador es un estudiante del Máster en Desarrollo con IA repasando un módulo.",
    "Respondé sus dudas sobre el contenido del módulo de forma didáctica, en español,",
    "en 120 palabras o menos. Usá analogías simples cuando ayuden.",
    "Nunca des la respuesta literal de un reto del juego: guiá para que la deduzca.",
    "Mantené un tono sereno y levemente enigmático, como el Oráculo de Matrix,",
    "pero priorizá siempre la claridad didáctica sobre el personaje.",
    "",
    "Contexto del módulo actual:",
    contextoModulo,
  ].join("\n");
}

export function systemEvaluador(): string {
  return [
    "Sos el evaluador de un juego educativo. Calificás la respuesta de un estudiante",
    "contra una rúbrica. Sé justo: no exijas terminología exacta si el concepto está bien;",
    "no aprobés respuestas vacías, incoherentes o que no cumplen la rúbrica.",
    "Respondé SOLO con un JSON válido con esta forma exacta:",
    '{"aprobado": true|false, "feedback": "explicación breve y didáctica en español (máx 60 palabras)"}',
  ].join("\n");
}

export function promptEvaluacion(reto: RetoAbierta, respuesta: string): string {
  return [
    `PREGUNTA: ${reto.pregunta}`,
    `RÚBRICA: ${reto.rubrica}`,
    `RESPUESTA DEL ESTUDIANTE: ${respuesta}`,
  ].join("\n\n");
}

/** Parsea la respuesta del modelo evaluador tolerando texto alrededor del JSON. */
export function parsearEvaluacion(texto: string): EvaluacionAbierta {
  const match = texto.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const data = JSON.parse(match[0]) as { aprobado?: unknown; feedback?: unknown };
      if (typeof data.aprobado === "boolean") {
        return {
          aprobado: data.aprobado,
          feedback: typeof data.feedback === "string" ? data.feedback : "",
        };
      }
    } catch {
      // cae al error de abajo
    }
  }
  throw new Error(`Respuesta del evaluador no parseable: ${texto.slice(0, 200)}`);
}
