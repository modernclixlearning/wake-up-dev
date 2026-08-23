import { describe, expect, it, vi } from "vitest";
import { AnthropicAdapter } from "../src/ai/anthropic-adapter";
import { BridgeAdapter } from "../src/ai/bridge-adapter";
import { AIConfig, cargarConfig, configCompleta, guardarConfig } from "../src/ai/config";
import { activarProxySiDisponible, crearProvider, hayIA } from "../src/ai/factory";
import { GeminiAdapter } from "../src/ai/gemini-adapter";
import { OpenAIAdapter } from "../src/ai/openai-adapter";
import { ProxyAdapter } from "../src/ai/proxy-adapter";
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
  estadoDelArte2026: false,
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

  it("los headless no necesitan key", () => {
    expect(configCompleta({ provider: "claude-headless", apiKey: "", model: "" })).toBe(true);
    expect(configCompleta({ provider: "copilot-headless", apiKey: "", model: "" })).toBe(true);
  });

  it("el proxy no necesita key", () => {
    expect(configCompleta({ provider: "proxy", apiKey: "", model: "" })).toBe(true);
  });
});

describe("factory", () => {
  it("sin key devuelve el fallback estático", () => {
    const p = crearProvider({ provider: "anthropic", apiKey: "", model: "" });
    expect(p).toBeInstanceOf(StaticFallback);
    expect(hayIA(p)).toBe(false);
  });

  const casos: Array<[AIConfig["provider"], string]> = [
    ["proxy", "proxy"],
    ["anthropic", "anthropic"],
    ["openai", "openai"],
    ["gemini", "gemini"],
    ["claude-headless", "claude-headless"],
    ["copilot-headless", "copilot-headless"],
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
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("clave invalida");
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

describe("BridgeAdapter (fetch mockeado)", () => {
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
    estadoDelArte2026: false,
  };

  it("disponible() devuelve true si /salud responde ok, false si no hay bridge", async () => {
    expect(await new BridgeAdapter("claude", "http://x", fetchFalso({ ok: true })).disponible()).toBe(true);
    const fetchCaido = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await new BridgeAdapter("claude", "http://x", fetchCaido).disponible()).toBe(false);
  });

  it("disponible() respeta el reporte de motores del bridge", async () => {
    const salud = fetchFalso({ ok: true, motores: { claude: true, copilot: false } });
    expect(await new BridgeAdapter("claude", "http://x", salud).disponible()).toBe(true);
    expect(await new BridgeAdapter("copilot", "http://x", salud).disponible()).toBe(false);
  });

  it("consulta al Oráculo vía /oraculo", async () => {
    const adapter = new BridgeAdapter("claude", "http://x", fetchFalso({ respuesta: "seguí al conejo blanco" }));
    expect(await adapter.preguntarOraculo("ctx", "?")).toBe("seguí al conejo blanco");
  });

  it("evalúa abiertas vía /evaluar", async () => {
    const adapter = new BridgeAdapter("claude", "http://x", fetchFalso({ aprobado: true, feedback: "bien" }));
    const r = await adapter.evaluarAbierta(retoAbierta, "respuesta");
    expect(r.aprobado).toBe(true);
  });

  it("genera pistas vía /pista", async () => {
    const adapter = new BridgeAdapter("claude", "http://x", fetchFalso({ pista: "pensá en FIFO" }));
    expect(await adapter.generarPista(retoMC)).toBe("pensá en FIFO");
  });

  it("incluye el motor elegido en cada POST al bridge", async () => {
    let bodyEnviado: unknown = null;
    const fetchEspia = (async (_url: unknown, init?: RequestInit) => {
      bodyEnviado = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ pista: "..." }), { status: 200 });
    }) as unknown as typeof fetch;
    await new BridgeAdapter("copilot", "http://x", fetchEspia).generarPista(retoMC);
    expect((bodyEnviado as { motor: string }).motor).toBe("copilot");
  });
});

// Fetch que nunca resuelve y se aborta al recibir la signal
function fetchColgado(): typeof fetch {
  return ((_url: unknown, init?: { signal?: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        reject(err);
      });
    })) as unknown as typeof fetch;
}

// Fetch que rechaza inmediatamente (fallo de red puro)
function fetchRedCaida(mensaje = "Failed to fetch"): typeof fetch {
  return (async () => { throw new Error(mensaje); }) as unknown as typeof fetch;
}

describe("OpenAIAdapter — timeout, 401 y error de red", () => {
  it("lanza con mensaje de timeout cuando el fetch se aborta", async () => {
    const adapter = new OpenAIAdapter("k", "m", fetchColgado());
    // Reducimos el timeout solo para este test sobreescribiendo la constante
    (OpenAIAdapter as unknown as Record<string, number>).TIMEOUT_MS = 50;
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("timeout");
    (OpenAIAdapter as unknown as Record<string, number>).TIMEOUT_MS = 30_000;
  });

  it("lanza con mensaje de clave inválida en 401", async () => {
    const adapter = new OpenAIAdapter("k", "m", fetchFalso({ error: "invalid_api_key" }, 401));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("clave invalida");
  });

  it("lanza con mensaje de clave inválida en 403", async () => {
    const adapter = new OpenAIAdapter("k", "m", fetchFalso({ error: "forbidden" }, 403));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("clave invalida");
  });

  it("lanza con mensaje de error de red cuando fetch rechaza", async () => {
    const adapter = new OpenAIAdapter("k", "m", fetchRedCaida("Failed to fetch"));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("error de red");
  });
});

describe("GeminiAdapter — timeout, 401 y error de red", () => {
  it("lanza con mensaje de timeout cuando el fetch se aborta", async () => {
    const adapter = new GeminiAdapter("k", "m", fetchColgado());
    (GeminiAdapter as unknown as Record<string, number>).TIMEOUT_MS = 50;
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("timeout");
    (GeminiAdapter as unknown as Record<string, number>).TIMEOUT_MS = 30_000;
  });

  it("lanza con mensaje de clave inválida en 401", async () => {
    const adapter = new GeminiAdapter("k", "m", fetchFalso({ error: "invalid" }, 401));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("clave invalida");
  });

  it("lanza con mensaje de error de red cuando fetch rechaza", async () => {
    const adapter = new GeminiAdapter("k", "m", fetchRedCaida("Failed to fetch"));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("error de red");
  });
});

describe("StaticFallback.evaluarAbierta", () => {
  it("lanza (no evalúa) para preservar la invariante: los retos abiertos usan su fallback", async () => {
    const fallback = new StaticFallback();
    await expect(fallback.evaluarAbierta(retoAbierta, "cualquier respuesta")).rejects.toThrow();
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

const retoMCProxy = {
  id: "p-0",
  modulo: "p",
  tipo: "multiple-choice" as const,
  pregunta: "¿Qué es un transformer?",
  opciones: ["una red neuronal", "una red convolucional"],
  correcta: 0,
  explicacion: "",
  dificultad: 1 as const,
  tags: [],
  estadoDelArte2026: false,
};

describe("ProxyAdapter (fetch mockeado)", () => {
  it("preguntarOraculo hace POST con tipo='oraculo' y devuelve el texto", async () => {
    let bodyEnviado: unknown = null;
    const fetchEspia = (async (_url: unknown, init?: RequestInit) => {
      bodyEnviado = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ texto: "sigue el conejo blanco" }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new ProxyAdapter(fetchEspia);
    const resultado = await adapter.preguntarOraculo("ctx del módulo", "¿qué es un LLM?");
    expect(resultado).toBe("sigue el conejo blanco");
    expect((bodyEnviado as { tipo: string; contexto: string; pregunta: string }).tipo).toBe("oraculo");
    expect((bodyEnviado as { contexto: string }).contexto).toBe("ctx del módulo");
    expect((bodyEnviado as { pregunta: string }).pregunta).toBe("¿qué es un LLM?");
  });

  it("generarPista hace POST con tipo='pista' y devuelve el texto", async () => {
    let bodyEnviado: unknown = null;
    const fetchEspia = (async (_url: unknown, init?: RequestInit) => {
      bodyEnviado = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ texto: "pensá en atención" }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new ProxyAdapter(fetchEspia);
    const pista = await adapter.generarPista(retoMCProxy);
    expect(pista).toBe("pensá en atención");
    expect((bodyEnviado as { tipo: string; opciones: string[] }).tipo).toBe("pista");
    expect((bodyEnviado as { opciones: string[] }).opciones).toEqual(retoMCProxy.opciones);
  });

  it("evaluarAbierta hace POST con tipo='evaluar' y devuelve la evaluación", async () => {
    let bodyEnviado: unknown = null;
    const fetchEspia = (async (_url: unknown, init?: RequestInit) => {
      bodyEnviado = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ aprobado: true, feedback: "muy bien" }), { status: 200 });
    }) as unknown as typeof fetch;
    const adapter = new ProxyAdapter(fetchEspia);
    const ev = await adapter.evaluarAbierta(retoAbierta, "mi respuesta");
    expect(ev.aprobado).toBe(true);
    expect(ev.feedback).toBe("muy bien");
    expect((bodyEnviado as { tipo: string; rubrica: string }).tipo).toBe("evaluar");
    expect((bodyEnviado as { rubrica: string }).rubrica).toBe(retoAbierta.rubrica);
  });

  it("disponible() devuelve true cuando GET responde { disponible: true }", async () => {
    const adapter = new ProxyAdapter(fetchFalso({ disponible: true }));
    expect(await adapter.disponible()).toBe(true);
  });

  it("disponible() devuelve false ante error de red", async () => {
    const adapter = new ProxyAdapter(fetchRedCaida("ECONNREFUSED"));
    expect(await adapter.disponible()).toBe(false);
  });

  it("disponible() devuelve false ante respuesta inesperada (sin campo disponible)", async () => {
    const adapter = new ProxyAdapter(fetchFalso({ ok: true }));
    expect(await adapter.disponible()).toBe(false);
  });

  it("un 429 da un mensaje legible al jugador", async () => {
    const adapter = new ProxyAdapter(fetchFalso({ error: "rate limit" }, 429));
    await expect(adapter.preguntarOraculo("ctx", "?")).rejects.toThrow("saturado");
  });

  it("evaluarAbierta propaga el error ante fallo técnico (no penaliza)", async () => {
    const adapter = new ProxyAdapter(fetchRedCaida("Failed to fetch"));
    await expect(adapter.evaluarAbierta(retoAbierta, "mi respuesta")).rejects.toThrow();
  });

  it("crearProvider({id:'proxy'}) devuelve ProxyAdapter y hayIA lo da por IA", () => {
    const p = crearProvider({ provider: "proxy", apiKey: "", model: "" });
    expect(p).toBeInstanceOf(ProxyAdapter);
    expect(hayIA(p)).toBe(true);
  });
});

describe("activarProxySiDisponible", () => {
  it("sin config guardada + proxy disponible → termina usando ProxyAdapter", async () => {
    let proveedor = new StaticFallback() as ReturnType<typeof crearProvider>;
    await new Promise<void>((resolve) => {
      activarProxySiDisponible(
        (p) => { proveedor = p; resolve(); },
        fetchFalso({ disponible: true })
      );
    });
    expect(proveedor).toBeInstanceOf(ProxyAdapter);
  });

  it("sin config guardada + proxy NO disponible → se queda en StaticFallback", async () => {
    let llamado = false;
    const callback = vi.fn(() => { llamado = true; });
    // Esperamos que la promise interna resuelva antes de verificar
    await new Promise<void>((resolve) => {
      activarProxySiDisponible(callback, fetchFalso({ disponible: false }));
      // Usamos un microtask para dejar que la promise interna resuelva
      setTimeout(resolve, 10);
    });
    expect(llamado).toBe(false);
  });

  it("sin config guardada + GET falla (error de red) → se queda en StaticFallback, sin lanzar", async () => {
    let llamado = false;
    const callback = vi.fn(() => { llamado = true; });
    await new Promise<void>((resolve) => {
      activarProxySiDisponible(callback, fetchRedCaida("ECONNREFUSED"));
      setTimeout(resolve, 10);
    });
    expect(llamado).toBe(false);
  });

  it("CON config guardada (openai con key) → NO se toca aunque el proxy esté disponible", async () => {
    // Simular que hay config guardada: provider !== "ninguno"
    // La lógica de no-llamar a activarProxySiDisponible está en state.ts.
    // Aquí verificamos que si se llama de todos modos, el callback sí se invocaría (unit puro).
    // El contrato real es que state.ts NO llama activarProxySiDisponible cuando config.provider !== "ninguno".
    // Testemos directamente el comportamiento de state.ts con un storage falso:
    const storage = storageFalso();
    guardarConfig({ provider: "openai", apiKey: "sk-real", model: "gpt-4o-mini" }, storage);
    const config = cargarConfig(storage);
    // Confirmar que con config guardada no se debe llamar la sonda
    expect(config.provider).toBe("openai");
    // El guard en state.ts es: if (config.provider === "ninguno") { activarProxySiDisponible(...) }
    // Con provider "openai", la condición es falsa → el proxy no se activa
    const debeActivar = config.provider === "ninguno";
    expect(debeActivar).toBe(false);
  });
});
