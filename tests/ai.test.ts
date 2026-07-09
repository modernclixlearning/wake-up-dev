import { describe, expect, it } from "vitest";
import { AnthropicAdapter } from "../src/ai/anthropic-adapter";
import { ClaudeHeadlessAdapter } from "../src/ai/claude-headless-adapter";
import { AIConfig, cargarConfig, configCompleta, guardarConfig } from "../src/ai/config";
import { crearProvider, hayIA } from "../src/ai/factory";
import { GeminiAdapter } from "../src/ai/gemini-adapter";
import { OpenAIAdapter } from "../src/ai/openai-adapter";
import { parsearEvaluacion, systemOraculo } from "../src/ai/prompts";
import { StaticFallback } from "../src/ai/static-fallback";
import { RetoAbierta } from "../src/domain/reto";

const retoAbierta: RetoAbierta = {
  id: "x-1",
  modulo: "x",
  tipo: "abierta",
  pregunta: "Explica X",
  rubrica: "Debe mencionar X",
  fallbackId: "x-0",
  dificultad: 2,
  tags: [],
  bonus2026: false,
};

function storageFalso(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

function fetchFalso(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("config BYOK", () => {
  it("devuelve config vacía si no hay nada guardado o el JSON es inválido", () => {
    const s = storageFalso();
    expect(cargarConfig(s).provider).toBe("ninguno");
    s.setItem("wake-up-dev:ai-config", "{basura");
    expect(cargarConfig(s).provider).toBe("ninguno");
  });

  it("guarda y recupera la config", () => {
    const s = storageFalso();
    guardarConfig({ provider: "anthropic", apiKey: "sk-test", model: "m" }, s);
    const config = cargarConfig(s);
    expect(config.provider).toBe("anthropic");
    expect(config.apiKey).toBe("sk-test");
  });

  it("configCompleta exige provider y key", () => {
    expect(configCompleta({ provider: "ninguno", apiKey: "", model: "" })).toBe(false);
    expect(configCompleta({ provider: "openai", apiKey: "  ", model: "" })).toBe(false);
    expect(configCompleta({ provider: "openai", apiKey: "k", model: "" })).toBe(true);
  });

  it("el headless no necesita key", () => {
    expect(configCompleta({ provider: "claude-headless", apiKey: "", model: "" })).toBe(true);
  });
});

describe("factory", () => {
  it("sin key devuelve el fallback estático", () => {
    const p = crearProvider({ provider: "anthropic", apiKey: "", model: "" });
    expect(p).toBeInstanceOf(StaticFallback);
    expect(hayIA(p)).toBe(false);
  });

  const casos: Array<[AIConfig["provider"], string]> = [
    ["anthropic", "anthropic"],
    ["openai", "openai"],
    ["gemini", "gemini"],
    ["claude-headless", "claude-headless"],
  ];
  it.each(casos)("con key resuelve %s", (provider, nombre) => {
    const p = crearProvider({ provider, apiKey: "k", model: "" });
    expect(p.nombre).toBe(nombre);
    expect(hayIA(p)).toBe(true);
  });
});

describe("prompts", () => {
  it("el system del Oráculo incluye el contexto del módulo", () => {
    expect(systemOraculo("CONTEXTO-XYZ")).toContain("CONTEXTO-XYZ");
  });

  it("parsearEvaluacion tolera texto alrededor del JSON", () => {
    const r = parsearEvaluacion('Claro: {"aprobado": true, "feedback": "bien"} — fin');
    expect(r.aprobado).toBe(true);
    expect(r.feedback).toBe("bien");
  });

  it("parsearEvaluacion lanza si no hay JSON válido", () => {
    expect(() => parsearEvaluacion("no hay json acá")).toThrow();
  });
});

describe("OpenAIAdapter (fetch mockeado)", () => {
  it("extrae el texto del Oráculo de choices[0].message.content", async () => {
    const adapter = new OpenAIAdapter(
      "k",
      "gpt-test",
      fetchFalso({ choices: [{ message: { content: "hola neo" } }] })
    );
    expect(await adapter.preguntarOraculo("ctx", "¿qué es git?")).toBe("hola neo");
  });

  it("evalúa abiertas parseando el JSON del modelo", async () => {
    const adapter = new OpenAIAdapter(
      "k",
      "gpt-test",
      fetchFalso({
        choices: [{ message: { content: '{"aprobado": false, "feedback": "le falta X"}' } }],
      })
    );
    const r = await adapter.evaluarAbierta(retoAbierta, "respuesta floja");
    expect(r.aprobado).toBe(false);
    expect(r.feedback).toBe("le falta X");
  });

  it("lanza con status de error", async () => {
    const adapter = new OpenAIAdapter("k", "gpt-test", fetchFalso({ error: "nope" }, 401));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("OpenAI 401");
  });
});

describe("GeminiAdapter (fetch mockeado)", () => {
  it("extrae el texto de candidates[0].content.parts", async () => {
    const adapter = new GeminiAdapter(
      "k",
      "gemini-test",
      fetchFalso({ candidates: [{ content: { parts: [{ text: "hola " }, { text: "neo" }] } }] })
    );
    expect(await adapter.preguntarOraculo("ctx", "?")).toBe("hola neo");
  });
});

describe("ClaudeHeadlessAdapter (fetch mockeado)", () => {
  const retoMC = {
    id: "x-0",
    modulo: "x",
    tipo: "multiple-choice" as const,
    pregunta: "¿?",
    opciones: ["a", "b"],
    correcta: 0,
    explicacion: "",
    dificultad: 1 as const,
    tags: [],
    bonus2026: false,
  };

  it("disponible() devuelve true si /salud responde ok, false si no hay bridge", async () => {
    expect(await new ClaudeHeadlessAdapter("http://x", fetchFalso({ ok: true })).disponible()).toBe(true);
    const fetchCaido = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await new ClaudeHeadlessAdapter("http://x", fetchCaido).disponible()).toBe(false);
  });

  it("consulta al Oráculo vía /oraculo", async () => {
    const adapter = new ClaudeHeadlessAdapter("http://x", fetchFalso({ respuesta: "seguí al conejo blanco" }));
    expect(await adapter.preguntarOraculo("ctx", "?")).toBe("seguí al conejo blanco");
  });

  it("evalúa abiertas vía /evaluar", async () => {
    const adapter = new ClaudeHeadlessAdapter("http://x", fetchFalso({ aprobado: true, feedback: "bien" }));
    const r = await adapter.evaluarAbierta(retoAbierta, "respuesta");
    expect(r.aprobado).toBe(true);
  });

  it("genera pistas vía /pista", async () => {
    const adapter = new ClaudeHeadlessAdapter("http://x", fetchFalso({ pista: "pensá en FIFO" }));
    expect(await adapter.generarPista(retoMC)).toBe("pensá en FIFO");
  });
});

describe("AnthropicAdapter (fetch inyectado)", () => {
  it("extrae el texto de los bloques text de la respuesta", async () => {
    const adapter = new AnthropicAdapter(
      "sk-test",
      "claude-test",
      fetchFalso({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-test",
        content: [{ type: "text", text: "sos la elegida" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
    expect(await adapter.preguntarOraculo("ctx", "?")).toBe("sos la elegida");
  });

  it("evalúa abiertas con el JSON estructurado", async () => {
    const adapter = new AnthropicAdapter(
      "sk-test",
      "claude-test",
      fetchFalso({
        id: "msg_2",
        type: "message",
        role: "assistant",
        model: "claude-test",
        content: [{ type: "text", text: '{"aprobado": true, "feedback": "correcto"}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
    const r = await adapter.evaluarAbierta(retoAbierta, "buena respuesta");
    expect(r.aprobado).toBe(true);
  });
});
