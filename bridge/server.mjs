/**
 * Bridge headless — el modo "píldora roja" de Wake Up, Dev.
 *
 * Proceso local que expone una mini API HTTP y resuelve cada petición
 * lanzando una instancia headless de Claude Code (`claude -p`), el mismo
 * patrón de orquestación que se enseña en los módulos 9 y 13 del máster.
 *
 * Uso:   node bridge/server.mjs          (requiere el CLI `claude` instalado y autenticado)
 * Env:   BRIDGE_PORT (default 8137) · BRIDGE_CLAUDE_ARGS (args extra, ej: "--model claude-haiku-4-5")
 *
 * Seguridad: escucha SOLO en 127.0.0.1. CORS abierto a localhost (dev y build local).
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.BRIDGE_PORT ?? 8137);
const ARGS_EXTRA = (process.env.BRIDGE_CLAUDE_ARGS ?? "").split(" ").filter(Boolean);
const TIMEOUT_MS = 120_000;

function ejecutarClaude(prompt) {
  return new Promise((resolve, reject) => {
    // shell:true para que Windows resuelva claude.cmd; los args son estáticos,
    // el prompt viaja por stdin (nunca por shell) — sin riesgo de inyección.
    const proc = spawn("claude", ["-p", "--output-format", "text", ...ARGS_EXTRA], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("timeout: la instancia headless no respondió a tiempo"));
    }, TIMEOUT_MS);

    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude salió con código ${code}: ${err.slice(0, 300)}`));
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function leerBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 100_000) reject(new Error("body demasiado grande"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
  });
}

function extraerJson(texto) {
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("la respuesta del modelo no contiene JSON");
  return JSON.parse(match[0]);
}

const rutas = {
  "/oraculo": async ({ contexto, pregunta }) => {
    const prompt = [
      "Sos el Oráculo del juego educativo 'Wake Up, Dev' (ambientado en Matrix).",
      "Respondé la duda del estudiante sobre el módulo en español, didáctico,",
      "máximo 120 palabras, tono sereno y levemente enigmático. No des respuestas",
      "literales de retos del juego. Respondé SOLO con el texto para el jugador.",
      "",
      `CONTEXTO DEL MÓDULO:\n${contexto ?? ""}`,
      "",
      `PREGUNTA: ${pregunta}`,
    ].join("\n");
    return { respuesta: await ejecutarClaude(prompt) };
  },

  "/evaluar": async ({ pregunta, rubrica, respuesta }) => {
    const prompt = [
      "Evaluá la respuesta de un estudiante contra la rúbrica. Sé justo: no exijas",
      "terminología exacta si el concepto está bien; no aprobés respuestas vacías o incoherentes.",
      'Respondé SOLO con JSON: {"aprobado": true|false, "feedback": "breve, didáctico, en español, máx 60 palabras"}',
      "",
      `PREGUNTA: ${pregunta}`,
      `RÚBRICA: ${rubrica}`,
      `RESPUESTA DEL ESTUDIANTE: ${respuesta}`,
    ].join("\n");
    const json = extraerJson(await ejecutarClaude(prompt));
    return { aprobado: Boolean(json.aprobado), feedback: String(json.feedback ?? "") };
  },

  "/pista": async ({ pregunta, opciones }) => {
    const prompt = [
      "Sos el Oráculo de un juego educativo. El estudiante está trabado en esta pregunta.",
      "Dale UNA pista breve (máx 30 palabras, en español) que lo oriente al concepto",
      "correcto SIN revelar la respuesta ni descartar opciones explícitamente.",
      "Respondé SOLO con la pista.",
      "",
      `PREGUNTA: ${pregunta}`,
      `OPCIONES: ${(opciones ?? []).join(" | ")}`,
    ].join("\n");
    return { pista: await ejecutarClaude(prompt) };
  },
};

const server = createServer(async (req, res) => {
  const origin = req.headers.origin ?? "";
  const cors = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : "";
  res.setHeader("access-control-allow-origin", cors || "http://localhost:5173");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("content-type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/salud") {
      res.writeHead(200).end(JSON.stringify({ ok: true, servicio: "wake-up-dev-bridge" }));
      return;
    }
    const ruta = rutas[req.url ?? ""];
    if (req.method === "POST" && ruta) {
      const body = await leerBody(req);
      const resultado = await ruta(body);
      res.writeHead(200).end(JSON.stringify(resultado));
      return;
    }
    res.writeHead(404).end(JSON.stringify({ error: "ruta desconocida" }));
  } catch (e) {
    res.writeHead(500).end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🕶️  Bridge píldora roja escuchando en http://127.0.0.1:${PORT}`);
  console.log("   El juego lo detecta eligiendo 'Claude Code headless' en los ajustes (tecla A en Zion).");
});
