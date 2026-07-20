/**
 * Bridge headless — el modo "píldora roja" de Wake Up, Dev.
 *
 * Proceso local que expone una mini API HTTP y resuelve cada petición
 * lanzando una instancia headless de un CLI de agente — Claude Code
 * (`claude -p`) o GitHub Copilot CLI — el mismo patrón de orquestación
 * que se enseña en los módulos 9 y 13 del máster. El motor se elige por
 * request (campo `motor`, default "claude"): un solo bridge sirve ambos.
 *
 * Uso:   node bridge/server.mjs
 *        (requiere el CLI del motor elegido instalado y autenticado)
 * Env:   BRIDGE_PORT (default 8137)
 *        BRIDGE_CLAUDE_ARGS  (args extra para claude, ej: "--model claude-haiku-4-5")
 *        BRIDGE_COPILOT_ARGS (args extra para copilot, ej: "--model gpt-5.4")
 *        BRIDGE_COPILOT_JS   (ruta al npm-loader.js de @github/copilot si no
 *                             está en la instalación global npm por defecto)
 *
 * Seguridad: escucha SOLO en 127.0.0.1. CORS abierto a localhost (dev y build
 * local). El prompt NUNCA pasa por un shell: a claude viaja por stdin; a
 * copilot como elemento del array de args con shell:false (spawn directo de
 * node sobre el entry JS del CLI — sin interpretación de shell posible).
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.BRIDGE_PORT ?? 8137);
const TIMEOUT_MS = 120_000;

const argsDe = (env) => (process.env[env] ?? "").split(" ").filter(Boolean);

/** El Copilot CLI no lee el prompt por stdin: hay que pasarlo como argumento.
 *  Para hacerlo sin shell (inyección) spawneamos node directo sobre su entry
 *  JS (el shim copilot.cmd hace exactamente eso). */
function resolverCopilotJs() {
  const candidatos = [
    process.env.BRIDGE_COPILOT_JS,
    process.env.APPDATA && join(process.env.APPDATA, "npm/node_modules/@github/copilot/npm-loader.js"),
    "/usr/local/lib/node_modules/@github/copilot/npm-loader.js",
    process.env.HOME && join(process.env.HOME, ".npm-global/lib/node_modules/@github/copilot/npm-loader.js"),
  ].filter(Boolean);
  return candidatos.find((p) => existsSync(p)) ?? null;
}
const COPILOT_JS = resolverCopilotJs();

function ejecutar(cmd, args, opciones, prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...opciones, stdio: ["pipe", "pipe", "pipe"] });
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
      else reject(new Error(`el motor salió con código ${code}: ${err.slice(0, 300)}`));
    });

    if (prompt !== undefined) proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

const MOTORES = {
  claude: {
    disponible: () => true,
    // shell:true para que Windows resuelva claude.cmd; los args son estáticos,
    // el prompt viaja por stdin (nunca por shell) — sin riesgo de inyección.
    correr: (prompt) =>
      ejecutar(
        "claude",
        ["-p", "--output-format", "text", ...argsDe("BRIDGE_CLAUDE_ARGS")],
        { shell: true },
        prompt
      ),
  },
  copilot: {
    disponible: () => COPILOT_JS !== null,
    correr: (prompt) => {
      if (!COPILOT_JS) {
        throw new Error(
          "Copilot CLI no encontrado: instalalo (npm i -g @github/copilot) o seteá BRIDGE_COPILOT_JS"
        );
      }
      // El prompt va como elemento del array con shell:false — spawn no lo
      // interpreta, llega literal al CLI.
      return ejecutar(
        process.execPath,
        [COPILOT_JS, "-p", prompt, "-s", "--no-color", ...argsDe("BRIDGE_COPILOT_ARGS")],
        { shell: false }
      );
    },
  },
};

function motorDe(body) {
  const motor = body.motor ?? "claude";
  if (!Object.hasOwn(MOTORES, motor)) throw new Error(`motor desconocido: ${motor}`);
  return MOTORES[motor];
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
  "/oraculo": async (body) => {
    const { contexto, pregunta } = body;
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
    return { respuesta: await motorDe(body).correr(prompt) };
  },

  "/evaluar": async (body) => {
    const { pregunta, rubrica, respuesta } = body;
    const prompt = [
      "Evaluá la respuesta de un estudiante contra la rúbrica. Sé justo: no exijas",
      "terminología exacta si el concepto está bien; no aprobés respuestas vacías o incoherentes.",
      'Respondé SOLO con JSON: {"aprobado": true|false, "feedback": "breve, didáctico, en español, máx 60 palabras"}',
      "",
      `PREGUNTA: ${pregunta}`,
      `RÚBRICA: ${rubrica}`,
      `RESPUESTA DEL ESTUDIANTE: ${respuesta}`,
    ].join("\n");
    const json = extraerJson(await motorDe(body).correr(prompt));
    return { aprobado: Boolean(json.aprobado), feedback: String(json.feedback ?? "") };
  },

  "/pista": async (body) => {
    const { pregunta, opciones } = body;
    const prompt = [
      "Sos el Oráculo de un juego educativo. El estudiante está trabado en esta pregunta.",
      "Dale UNA pista breve (máx 30 palabras, en español) que lo oriente al concepto",
      "correcto SIN revelar la respuesta ni descartar opciones explícitamente.",
      "Respondé SOLO con la pista.",
      "",
      `PREGUNTA: ${pregunta}`,
      `OPCIONES: ${(opciones ?? []).join(" | ")}`,
    ].join("\n");
    return { pista: await motorDe(body).correr(prompt) };
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
      const motores = Object.fromEntries(
        Object.entries(MOTORES).map(([nombre, m]) => [nombre, m.disponible()])
      );
      res.writeHead(200).end(JSON.stringify({ ok: true, servicio: "wake-up-dev-bridge", motores }));
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
  console.log(`   Motores: claude ✔ · copilot ${COPILOT_JS ? "✔" : "✘ (npm i -g @github/copilot)"}`);
  console.log("   El juego lo detecta eligiendo un provider headless en los ajustes (tecla A en Zion).");
});
