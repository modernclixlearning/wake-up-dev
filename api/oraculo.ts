/**
 * Vercel serverless proxy al Oráculo (OpenAI).
 *
 * La OPENAI_API_KEY vive SOLO como variable de entorno del servidor en Vercel.
 * NUNCA se expone al cliente ni se commitea en el repositorio.
 *
 * Contrato HTTP:
 *   GET  /api/oraculo → { "disponible": boolean }
 *   POST /api/oraculo → discriminado por body.tipo (oraculo | pista | evaluar)
 *
 * Errores: siempre JSON { "error": string } con el status HTTP adecuado.
 */

// process.env está disponible en el runtime de Vercel (Node.js).
// La declaración evita depender de @types/node en el tsconfig del proyecto.
declare const process: { env: Record<string, string | undefined> };

// ---------------------------------------------------------------------------
// Rate limiting en memoria por instancia
// ---------------------------------------------------------------------------
// ⚠ IMPORTANTE: Este límite es POR INSTANCIA de la función serverless.
// Vercel puede escalar a múltiples réplicas en paralelo; cada una tiene su
// propio contador independiente. La defensa REAL contra el gasto descontrolado
// es el TOPE DE FACTURACIÓN de la cuenta OpenAI (billing hard limit en el
// panel de platform.openai.com), no este rate limiter.
// Tratalo como una capa de cortesía para frenar usos obvios, no como seguridad dura.

const rlMap = new Map<string, { count: number; windowStart: number }>();

/** Máximo de peticiones permitidas por IP en una ventana. */
export const RL_MAX = 20;
/** Duración de la ventana de rate limit en milisegundos (10 minutos). */
export const RL_WINDOW_MS = 10 * 60 * 1000;

/**
 * Verifica y registra una petición para la IP dada.
 * Acepta un mapa y límite inyectables para facilitar las pruebas unitarias.
 * @returns true si la petición está permitida, false si fue bloqueada.
 */
export function checkRateLimit(
  ip: string,
  map: Map<string, { count: number; windowStart: number }> = rlMap,
  max = RL_MAX,
  windowMs = RL_WINDOW_MS
): boolean {
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    map.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Prompts — ESPEJO EXACTO de src/ai/prompts.ts
// Mantener sincronizados con ese archivo ante cualquier cambio de prompts.
// No se importan desde src/ para evitar dependencias de bundler en el runtime
// de Vercel (que tiene su propio proceso de build separado).
// ---------------------------------------------------------------------------

function systemOraculo(contextoModulo: string): string {
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

function systemEvaluador(): string {
  return [
    "Sos el evaluador de un juego educativo. Calificás la respuesta de un estudiante",
    "contra una rúbrica. Sé justo: no exijas terminología exacta si el concepto está bien;",
    "no aprobés respuestas vacías, incoherentes o que no cumplen la rúbrica.",
    "Respondé SOLO con un JSON válido con esta forma exacta:",
    '{"aprobado": true|false, "feedback": "explicación breve y didáctica en español (máx 60 palabras)"}',
  ].join("\n");
}

function systemPista(): string {
  return [
    "Sos el Oráculo de un juego educativo. El estudiante está trabado en una pregunta.",
    "Dale UNA pista breve (máximo 30 palabras, en español) que lo oriente al concepto",
    "correcto SIN revelar la respuesta ni descartar opciones explícitamente.",
    "Respondé SOLO con la pista.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tipos del contrato HTTP
// ---------------------------------------------------------------------------

interface BodyOraculo {
  tipo: "oraculo";
  contexto: string;
  pregunta: string;
}
interface BodyPista {
  tipo: "pista";
  pregunta: string;
  opciones: string[];
}
interface BodyEvaluar {
  tipo: "evaluar";
  pregunta: string;
  rubrica: string;
  respuesta: string;
}
export type BodyProxy = BodyOraculo | BodyPista | BodyEvaluar;

// ---------------------------------------------------------------------------
// Validación y sanitización de entrada
// ---------------------------------------------------------------------------

/**
 * Valida y parsea el body crudo del POST.
 * Lanza un Error descriptivo si el shape no es correcto.
 */
export function validarBody(raw: unknown): BodyProxy {
  if (typeof raw !== "object" || raw === null) throw new Error("body inválido");
  const b = raw as Record<string, unknown>;
  const tipo = b["tipo"];

  if (tipo === "oraculo") {
    if (typeof b["contexto"] !== "string" || typeof b["pregunta"] !== "string")
      throw new Error("campos faltantes para tipo oraculo");
    return { tipo: "oraculo", contexto: b["contexto"], pregunta: b["pregunta"] };
  }
  if (tipo === "pista") {
    if (typeof b["pregunta"] !== "string" || !Array.isArray(b["opciones"]))
      throw new Error("campos faltantes para tipo pista");
    return { tipo: "pista", pregunta: b["pregunta"], opciones: b["opciones"] as string[] };
  }
  if (tipo === "evaluar") {
    if (
      typeof b["pregunta"] !== "string" ||
      typeof b["rubrica"] !== "string" ||
      typeof b["respuesta"] !== "string"
    )
      throw new Error("campos faltantes para tipo evaluar");
    return {
      tipo: "evaluar",
      pregunta: b["pregunta"],
      rubrica: b["rubrica"],
      respuesta: b["respuesta"],
    };
  }
  throw new Error(`tipo desconocido: ${String(tipo)}`);
}

/**
 * Recorta los campos de texto para controlar el coste del upstream.
 * - pregunta / respuesta → máx. 1 000 caracteres
 * - contexto             → máx. 4 000 caracteres
 */
export function recortarBody(b: BodyProxy): BodyProxy {
  if (b.tipo === "oraculo")
    return { ...b, contexto: b.contexto.slice(0, 4000), pregunta: b.pregunta.slice(0, 1000) };
  if (b.tipo === "pista")
    return { ...b, pregunta: b.pregunta.slice(0, 1000) };
  return { ...b, pregunta: b.pregunta.slice(0, 1000), respuesta: b.respuesta.slice(0, 1000) };
}

// ---------------------------------------------------------------------------
// Parseo tolerante de respuesta evaluadora (igual lógica que src/ai/prompts.ts)
// ---------------------------------------------------------------------------

function parsearEvaluacion(texto: string): { aprobado: boolean; feedback: string } {
  const match = texto.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const data = JSON.parse(match[0]) as Record<string, unknown>;
      if (typeof data["aprobado"] === "boolean") {
        return {
          aprobado: data["aprobado"],
          feedback: typeof data["feedback"] === "string" ? data["feedback"] : "",
        };
      }
    } catch {
      // cae al error de abajo
    }
  }
  throw new Error(`Respuesta del evaluador no parseable: ${texto.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Helper de respuesta JSON (compatible con Node 18+)
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Llamada al modelo upstream con timeout de 20 s
// ---------------------------------------------------------------------------

interface UpstreamError extends Error {
  upstreamStatus: number;
}

function upstreamError(mensaje: string, status: number): UpstreamError {
  const e = new Error(mensaje) as UpstreamError;
  e.upstreamStatus = status;
  return e;
}

async function llamarModelo(
  system: string,
  user: string,
  model: string,
  apiKey: string,
  maxTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError")
      throw upstreamError("timeout al llamar a OpenAI", 502);
    throw upstreamError("error de red al llamar a OpenAI", 502);
  }
  clearTimeout(timer);

  if (res.status === 429) throw upstreamError("rate limit en OpenAI", 429);
  if (!res.ok) throw upstreamError(`OpenAI respondió ${res.status}`, 502);

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const texto = data.choices?.[0]?.message?.content;
  if (!texto) throw upstreamError("OpenAI no devolvió texto", 502);
  return texto;
}

// ---------------------------------------------------------------------------
// Configuración del runtime de Vercel
// ---------------------------------------------------------------------------

// Runtime EDGE, y no es un detalle cosmético: el handler de abajo usa la firma
// Web estándar —recibe un `Request` y devuelve un `Response`—, que es la del
// runtime edge. Con `runtime: "nodejs"` Vercel invoca con la firma de Node
// `(req, res)`, el `Response` devuelto se descarta y la petición NO se contesta
// nunca: todas las llamadas mueren con FUNCTION_INVOCATION_TIMEOUT (504),
// incluso un DELETE que debería salir por el 405 inmediato. Verificado contra
// el despliegue real.
//
// Edge además le viene bien a un proxy: arranque en frío casi nulo y ejecución
// cerca del usuario. `fetch` y `process.env` están disponibles.
//
// Ojo con el otro valor inválido: `runtime` solo acepta "nodejs" | "edge" |
// "experimental-edge" — una versión concreta como "nodejs20.x" hace fallar el
// build con `unsupported "runtime" value in config`.
export const config = { runtime: "edge" };

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  // Rechazar métodos distintos de GET y POST con 405
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
  const disponible = typeof apiKey === "string" && apiKey.trim().length > 0;

  // ── GET: consulta de disponibilidad del proxy ────────────────────────────
  if (req.method === "GET") {
    return jsonResponse({ disponible });
  }

  // ── POST: proxy al modelo ────────────────────────────────────────────────

  // 503 si la API key no está configurada en el servidor
  if (!disponible) {
    return jsonResponse(
      { error: "Servicio no configurado: falta la variable OPENAI_API_KEY en el servidor." },
      503
    );
  }

  // Rate limit por IP (primer valor de x-forwarded-for, o "unknown")
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return jsonResponse(
      { error: "Límite de uso alcanzado. Volvé a intentar en 10 minutos." },
      429
    );
  }

  // Parseo y validación del body
  let body: BodyProxy;
  try {
    const raw: unknown = await req.json();
    body = recortarBody(validarBody(raw));
  } catch (err) {
    return jsonResponse(
      { error: `Body inválido: ${err instanceof Error ? err.message : String(err)}` },
      400
    );
  }

  // Llamada al modelo según tipo
  try {
    if (body.tipo === "oraculo") {
      const texto = await llamarModelo(
        systemOraculo(body.contexto),
        body.pregunta,
        model,
        apiKey,
        300
      );
      return jsonResponse({ texto });
    }

    if (body.tipo === "pista") {
      const userPrompt = `PREGUNTA: ${body.pregunta}\n\nOPCIONES: ${body.opciones.join(" | ")}`;
      const texto = await llamarModelo(systemPista(), userPrompt, model, apiKey, 80);
      return jsonResponse({ texto });
    }

    // tipo === "evaluar"
    const userPrompt = [
      `PREGUNTA: ${body.pregunta}`,
      `RÚBRICA: ${body.rubrica}`,
      `RESPUESTA DEL ESTUDIANTE: ${body.respuesta}`,
    ].join("\n\n");
    const texto = await llamarModelo(systemEvaluador(), userPrompt, model, apiKey, 300);
    const evaluacion = parsearEvaluacion(texto);
    return jsonResponse(evaluacion);
  } catch (err) {
    if (err instanceof Error && "upstreamStatus" in err) {
      const status = (err as UpstreamError).upstreamStatus;
      if (status === 429)
        return jsonResponse({ error: "Límite de uso alcanzado en el servicio IA." }, 429);
      return jsonResponse({ error: "Error del servicio IA. Reintentá más tarde." }, 502);
    }
    return jsonResponse({ error: "Error interno del servidor." }, 502);
  }
}
