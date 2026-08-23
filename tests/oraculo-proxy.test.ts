import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { BodyProxy, RL_WINDOW_MS, checkRateLimit, recortarBody, validarBody } from "../api/oraculo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fetchFalso(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function postReq(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/oraculo", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// validarBody
// ---------------------------------------------------------------------------

describe("validarBody", () => {
  it("acepta un body de tipo oraculo válido", () => {
    const b = validarBody({ tipo: "oraculo", contexto: "ctx", pregunta: "?" });
    expect(b.tipo).toBe("oraculo");
  });

  it("acepta un body de tipo pista válido", () => {
    const b = validarBody({ tipo: "pista", pregunta: "?", opciones: ["a", "b"] });
    expect(b.tipo).toBe("pista");
  });

  it("acepta un body de tipo evaluar válido", () => {
    const b = validarBody({ tipo: "evaluar", pregunta: "?", rubrica: "r", respuesta: "resp" });
    expect(b.tipo).toBe("evaluar");
  });

  it("lanza si falta el campo tipo", () => {
    expect(() => validarBody({ contexto: "ctx" })).toThrow();
  });

  it("lanza si el tipo es desconocido", () => {
    expect(() => validarBody({ tipo: "desconocido" })).toThrow("tipo desconocido");
  });

  it("lanza si faltan campos requeridos en oraculo", () => {
    expect(() => validarBody({ tipo: "oraculo", contexto: "ctx" })).toThrow("campos faltantes");
  });

  it("lanza si body es null o no es objeto", () => {
    expect(() => validarBody(null)).toThrow("body inválido");
    expect(() => validarBody("string")).toThrow("body inválido");
  });
});

// ---------------------------------------------------------------------------
// recortarBody
// ---------------------------------------------------------------------------

describe("recortarBody", () => {
  it("recorta contexto a 4000 y pregunta a 1000 para tipo oraculo", () => {
    const b = recortarBody({
      tipo: "oraculo",
      contexto: "x".repeat(5000),
      pregunta: "y".repeat(2000),
    });
    if (b.tipo !== "oraculo") throw new Error("tipo incorrecto");
    expect(b.contexto).toHaveLength(4000);
    expect(b.pregunta).toHaveLength(1000);
  });

  it("recorta pregunta a 1000 para tipo pista", () => {
    const b = recortarBody({ tipo: "pista", pregunta: "z".repeat(1500), opciones: [] });
    if (b.tipo !== "pista") throw new Error("tipo incorrecto");
    expect(b.pregunta).toHaveLength(1000);
  });

  it("recorta pregunta y respuesta a 1000 para tipo evaluar", () => {
    const b = recortarBody({
      tipo: "evaluar",
      pregunta: "p".repeat(1500),
      rubrica: "r",
      respuesta: "q".repeat(2000),
    });
    if (b.tipo !== "evaluar") throw new Error("tipo incorrecto");
    expect(b.pregunta).toHaveLength(1000);
    expect(b.respuesta).toHaveLength(1000);
  });

  it("no recorta si los campos ya son cortos", () => {
    const body: BodyProxy = { tipo: "oraculo", contexto: "ctx", pregunta: "?" };
    const b = recortarBody(body);
    if (b.tipo !== "oraculo") throw new Error("tipo incorrecto");
    expect(b.contexto).toBe("ctx");
    expect(b.pregunta).toBe("?");
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  it("permite la primera petición", () => {
    const m = new Map<string, { count: number; windowStart: number }>();
    expect(checkRateLimit("1.1.1.1", m, 3)).toBe(true);
  });

  it("bloquea al superar el límite", () => {
    const m = new Map<string, { count: number; windowStart: number }>();
    expect(checkRateLimit("2.2.2.2", m, 2)).toBe(true);
    expect(checkRateLimit("2.2.2.2", m, 2)).toBe(true);
    expect(checkRateLimit("2.2.2.2", m, 2)).toBe(false);
  });

  it("resetea la ventana al expirar", () => {
    const m = new Map<string, { count: number; windowStart: number }>();
    // Llenar el cubo
    checkRateLimit("3.3.3.3", m, 1);
    expect(checkRateLimit("3.3.3.3", m, 1)).toBe(false);
    // Hacer expirar la ventana manipulando el windowStart
    const entry = m.get("3.3.3.3")!;
    entry.windowStart = Date.now() - RL_WINDOW_MS - 1;
    expect(checkRateLimit("3.3.3.3", m, 1)).toBe(true); // nueva ventana
  });

  it("IPs distintas no interfieren entre sí", () => {
    const m = new Map<string, { count: number; windowStart: number }>();
    checkRateLimit("4.4.4.4", m, 1);
    checkRateLimit("4.4.4.4", m, 1); // bloqueada
    expect(checkRateLimit("5.5.5.5", m, 1)).toBe(true); // IP diferente, fresca
  });
});

// ---------------------------------------------------------------------------
// Handler — GET
// ---------------------------------------------------------------------------

describe("handler GET", () => {
  beforeEach(() => {
    delete process.env["OPENAI_API_KEY"];
    delete process.env["OPENAI_MODEL"];
  });

  it("devuelve disponible:false si no hay OPENAI_API_KEY", async () => {
    const res = await handler(new Request("http://localhost/api/oraculo"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { disponible: boolean };
    expect(data.disponible).toBe(false);
  });

  it("devuelve disponible:true si hay OPENAI_API_KEY", async () => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    const res = await handler(new Request("http://localhost/api/oraculo"));
    const data = (await res.json()) as { disponible: boolean };
    expect(data.disponible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Handler — métodos no permitidos
// ---------------------------------------------------------------------------

describe("handler métodos", () => {
  it("responde 405 ante DELETE", async () => {
    const res = await handler(
      new Request("http://localhost/api/oraculo", { method: "DELETE" })
    );
    expect(res.status).toBe(405);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBeTruthy();
  });

  it("responde 405 ante PUT", async () => {
    const res = await handler(
      new Request("http://localhost/api/oraculo", { method: "PUT" })
    );
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Handler — POST sin API key
// ---------------------------------------------------------------------------

describe("handler POST sin API key", () => {
  beforeEach(() => {
    delete process.env["OPENAI_API_KEY"];
  });

  it("devuelve 503 si falta OPENAI_API_KEY", async () => {
    const res = await handler(postReq({ tipo: "oraculo", contexto: "ctx", pregunta: "?" }));
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("OPENAI_API_KEY");
  });
});

// ---------------------------------------------------------------------------
// Handler — POST validación de body
// ---------------------------------------------------------------------------

describe("handler POST validación body", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
  });
  afterEach(() => {
    delete process.env["OPENAI_API_KEY"];
  });

  it("400 si el body no es JSON válido", async () => {
    const res = await handler(
      new Request("http://localhost/api/oraculo", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.1" },
        body: "no es json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 si el tipo es desconocido", async () => {
    const res = await handler(postReq({ tipo: "inventado" }, "9.9.9.2"));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("tipo desconocido");
  });

  it("400 si faltan campos de oraculo", async () => {
    const res = await handler(postReq({ tipo: "oraculo", contexto: "ctx" }, "9.9.9.3"));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Handler — POST proxy (fetch mockeado)
// ---------------------------------------------------------------------------

describe("handler POST proxy tipo oraculo", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    process.env["OPENAI_MODEL"] = "gpt-test";
    vi.stubGlobal(
      "fetch",
      fetchFalso({ choices: [{ message: { content: "seguí al conejo blanco" } }] })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_API_KEY"];
    delete process.env["OPENAI_MODEL"];
  });

  it("devuelve { texto } con 200", async () => {
    const res = await handler(postReq({ tipo: "oraculo", contexto: "ctx", pregunta: "¿qué es?" }, "10.0.1.1"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { texto: string };
    expect(data.texto).toBe("seguí al conejo blanco");
  });

  it("usa el modelo de la variable de entorno", async () => {
    let bodyEnviado: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init?: RequestInit) => {
        bodyEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch
    );
    await handler(postReq({ tipo: "oraculo", contexto: "c", pregunta: "?" }, "10.0.1.2"));
    expect(bodyEnviado?.["model"]).toBe("gpt-test");
  });

  it("usa max_tokens 300 para tipo oraculo", async () => {
    let bodyEnviado: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init?: RequestInit) => {
        bodyEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch
    );
    await handler(postReq({ tipo: "oraculo", contexto: "c", pregunta: "?" }, "10.0.1.3"));
    expect(bodyEnviado?.["max_tokens"]).toBe(300);
  });
});

describe("handler POST proxy tipo pista", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    vi.stubGlobal(
      "fetch",
      fetchFalso({ choices: [{ message: { content: "pensá en FIFO" } }] })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_API_KEY"];
  });

  it("devuelve { texto } con 200", async () => {
    const res = await handler(
      postReq({ tipo: "pista", pregunta: "¿cuál es?", opciones: ["a", "b", "c"] }, "10.0.2.1")
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { texto: string };
    expect(data.texto).toBe("pensá en FIFO");
  });

  it("usa max_tokens 80 para tipo pista", async () => {
    let bodyEnviado: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      (async (_url: unknown, init?: RequestInit) => {
        bodyEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "pista" } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }) as typeof fetch
    );
    await handler(postReq({ tipo: "pista", pregunta: "?", opciones: ["x"] }, "10.0.2.2"));
    expect(bodyEnviado?.["max_tokens"]).toBe(80);
  });
});

describe("handler POST proxy tipo evaluar", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    vi.stubGlobal(
      "fetch",
      fetchFalso({
        choices: [{ message: { content: '{"aprobado": true, "feedback": "correcto"}' } }],
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_API_KEY"];
  });

  it("devuelve { aprobado, feedback } con 200", async () => {
    const res = await handler(
      postReq(
        { tipo: "evaluar", pregunta: "¿qué es?", rubrica: "debe mencionar X", respuesta: "X es..." },
        "10.0.3.1"
      )
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { aprobado: boolean; feedback: string };
    expect(data.aprobado).toBe(true);
    expect(data.feedback).toBe("correcto");
  });

  it("devuelve { aprobado: false } correctamente", async () => {
    vi.stubGlobal(
      "fetch",
      fetchFalso({
        choices: [{ message: { content: '{"aprobado": false, "feedback": "le falta X"}' } }],
      })
    );
    const res = await handler(
      postReq(
        { tipo: "evaluar", pregunta: "?", rubrica: "r", respuesta: "mala" },
        "10.0.3.2"
      )
    );
    const data = (await res.json()) as { aprobado: boolean; feedback: string };
    expect(data.aprobado).toBe(false);
    expect(data.feedback).toBe("le falta X");
  });
});

// ---------------------------------------------------------------------------
// Handler — errores del upstream
// ---------------------------------------------------------------------------

describe("handler POST errores upstream", () => {
  beforeEach(() => {
    process.env["OPENAI_API_KEY"] = "sk-test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["OPENAI_API_KEY"];
  });

  it("502 si OpenAI responde con error de servidor", async () => {
    vi.stubGlobal("fetch", fetchFalso({ error: "server error" }, 500));
    const res = await handler(postReq({ tipo: "oraculo", contexto: "c", pregunta: "?" }, "10.0.4.1"));
    expect(res.status).toBe(502);
  });

  it("429 si OpenAI devuelve rate limit", async () => {
    vi.stubGlobal("fetch", fetchFalso({ error: "rate_limit" }, 429));
    const res = await handler(postReq({ tipo: "oraculo", contexto: "c", pregunta: "?" }, "10.0.4.2"));
    expect(res.status).toBe(429);
  });

  it("502 si fetch rechaza por error de red", async () => {
    vi.stubGlobal(
      "fetch",
      (async () => { throw new Error("Failed to fetch"); }) as typeof fetch
    );
    const res = await handler(postReq({ tipo: "oraculo", contexto: "c", pregunta: "?" }, "10.0.4.3"));
    expect(res.status).toBe(502);
  });

  it("todos los errores devuelven JSON con campo error", async () => {
    vi.stubGlobal("fetch", fetchFalso({ error: "nope" }, 503));
    const res = await handler(postReq({ tipo: "pista", pregunta: "?", opciones: ["a"] }, "10.0.4.4"));
    const data = (await res.json()) as { error?: string };
    expect(typeof data.error).toBe("string");
  });
});
