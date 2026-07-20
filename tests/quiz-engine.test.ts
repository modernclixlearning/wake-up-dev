import { describe, expect, it } from "vitest";
import { QuizEngine } from "../src/domain/quiz-engine";
import { BancoModulo, RetoMultipleChoice } from "../src/domain/reto";
import { GameSession, PUNTOS_BONUS_2026, PUNTOS_POR_ACIERTO, VIDAS_INICIALES } from "../src/domain/session";

const banco: BancoModulo = {
  modulo: { id: "test", nombre: "Test", descripcion: "" },
  retos: [
    {
      id: "mc-1",
      modulo: "test",
      tipo: "multiple-choice",
      pregunta: "¿2+2?",
      opciones: ["3", "4"],
      correcta: 1,
      explicacion: "Es 4.",
      dificultad: 1,
      tags: [],
      bonus2026: false,
    },
    {
      id: "ab-1",
      modulo: "test",
      tipo: "abierta",
      pregunta: "Explica X",
      rubrica: "Debe mencionar X",
      fallbackId: "mc-1",
      dificultad: 2,
      tags: [],
      bonus2026: false,
    },
    {
      id: "mc-bonus",
      modulo: "test",
      tipo: "multiple-choice",
      pregunta: "¿Bonus?",
      opciones: ["sí", "no"],
      correcta: 0,
      explicacion: "Sí.",
      dificultad: 1,
      tags: [],
      bonus2026: true,
    },
  ],
};

describe("QuizEngine", () => {
  it("entrega todos los retos sin repetir y termina en null", () => {
    const quiz = new QuizEngine(banco, { barajar: false });
    const ids = new Set<string>();
    let reto;
    while ((reto = quiz.siguiente()) !== null) {
      expect(ids.has(reto.id)).toBe(false);
      ids.add(reto.id);
    }
    expect(ids.size).toBe(3);
    expect(quiz.siguiente()).toBeNull();
  });

  it("excluye los bonus2026 cuando se pide", () => {
    const quiz = new QuizEngine(banco, { incluirBonus: false, barajar: false });
    expect(quiz.restantes).toBe(2);
  });

  it("evalúa multiple choice correcto e incorrecto", () => {
    const quiz = new QuizEngine(banco, { barajar: false });
    const mc = banco.retos[0] as RetoMultipleChoice;
    expect(quiz.responderMultipleChoice(mc, 1).correcta).toBe(true);
    expect(quiz.responderMultipleChoice(mc, 0).correcta).toBe(false);
  });

  it("rechaza índices fuera de rango", () => {
    const quiz = new QuizEngine(banco, { barajar: false });
    const mc = banco.retos[0] as RetoMultipleChoice;
    expect(() => quiz.responderMultipleChoice(mc, 5)).toThrow(RangeError);
  });

  it("resuelve la variante fallback de un reto abierto", () => {
    const quiz = new QuizEngine(banco, { barajar: false });
    expect(quiz.fallbackDe("mc-1")?.id).toBe("mc-1");
    expect(quiz.fallbackDe("no-existe")).toBeNull();
  });
});

describe("QuizEngine — barajado de opciones", () => {
  // Banco reproduciendo el bug real: TODAS las correctas en el índice 0.
  const bancoSesgado: BancoModulo = {
    modulo: { id: "sesgado", nombre: "Sesgado", descripcion: "" },
    retos: Array.from({ length: 8 }, (_, i) => ({
      id: `s-${i}`,
      modulo: "sesgado",
      tipo: "multiple-choice" as const,
      pregunta: `p${i}`,
      opciones: ["correcta", "b", "c", "d"],
      correcta: 0,
      explicacion: "e",
      dificultad: 1 as const,
      tags: [],
      bonus2026: false,
    })),
  };

  it("por defecto reubica la correcta (no siempre en el índice original)", () => {
    // random determinístico que fuerza una permutación no-identidad.
    let n = 0;
    const random = () => [0.9, 0.1, 0.9, 0.1, 0.9, 0.1][n++ % 6];
    const quiz = new QuizEngine(bancoSesgado, { barajar: false, random });
    const indices = new Set<number>();
    let reto;
    while ((reto = quiz.siguiente()) !== null) {
      const mc = reto as RetoMultipleChoice;
      indices.add(mc.correcta);
      // El texto de la opción correcta viaja con el índice remapeado.
      expect(mc.opciones[mc.correcta]).toBe("correcta");
    }
    expect(indices.size).toBeGreaterThan(1);
  });

  it("con barajarOpciones:false preserva el orden e índice originales", () => {
    const quiz = new QuizEngine(bancoSesgado, { barajar: false, barajarOpciones: false });
    let reto;
    while ((reto = quiz.siguiente()) !== null) {
      const mc = reto as RetoMultipleChoice;
      expect(mc.correcta).toBe(0);
      expect(mc.opciones[0]).toBe("correcta");
    }
  });

  it("fallbackDe también reubica la correcta", () => {
    let n = 0;
    const random = () => [0.9, 0.1, 0.9][n++ % 3];
    const bancoFallback: BancoModulo = {
      modulo: { id: "f", nombre: "F", descripcion: "" },
      retos: [bancoSesgado.retos[0]],
    };
    const quiz = new QuizEngine(bancoFallback, { random });
    const mc = quiz.fallbackDe("s-0");
    expect(mc?.opciones[mc.correcta]).toBe("correcta");
  });

  it("no muta el banco original (banco.retos sigue con la correcta en 0)", () => {
    new QuizEngine(bancoSesgado, { random: Math.random }).siguiente();
    const original = bancoSesgado.retos[0] as RetoMultipleChoice;
    expect(original.correcta).toBe(0);
    expect(original.opciones[0]).toBe("correcta");
  });
});

describe("QuizEngine adaptativo (Smith)", () => {
  const bancoDificultades: BancoModulo = {
    modulo: { id: "t2", nombre: "T2", descripcion: "" },
    retos: ([1, 3, 2, 1, 3] as const).map((dif, i) => ({
      id: `d-${i}`,
      modulo: "t2",
      tipo: "multiple-choice",
      pregunta: `p${i}`,
      opciones: ["a", "b"],
      correcta: 0,
      explicacion: "e",
      dificultad: dif,
      tags: [],
      bonus2026: false,
    })),
  };

  it("con nivel 1 entrega primero los retos fáciles", () => {
    const quiz = new QuizEngine(bancoDificultades, { barajar: false });
    expect(quiz.siguienteAdaptativo(1)?.id).toBe("d-0"); // dificultad 1
    expect(quiz.siguienteAdaptativo(1)?.id).toBe("d-3"); // dificultad 1
    expect(quiz.siguienteAdaptativo(1)?.id).toBe("d-2"); // dificultad 2 (la más cercana)
  });

  it("con nivel 3 entrega primero los difíciles", () => {
    const quiz = new QuizEngine(bancoDificultades, { barajar: false });
    expect(quiz.siguienteAdaptativo(3)?.id).toBe("d-1"); // dificultad 3
    expect(quiz.siguienteAdaptativo(3)?.id).toBe("d-4"); // dificultad 3
  });

  it("agota el mazo y devuelve null", () => {
    const quiz = new QuizEngine(bancoDificultades, { barajar: false });
    for (let i = 0; i < 5; i++) expect(quiz.siguienteAdaptativo(2)).not.toBeNull();
    expect(quiz.siguienteAdaptativo(2)).toBeNull();
  });
});

describe("GameSession", () => {
  it("suma score normal y bonus", () => {
    const s = new GameSession();
    s.registrarAcierto("test", false);
    s.registrarAcierto("test", true);
    expect(s.score).toBe(PUNTOS_POR_ACIERTO + PUNTOS_BONUS_2026);
    expect(s.progreso.get("test")?.aciertos).toBe(2);
  });

  it("resta vidas al fallar y detecta la derrota", () => {
    const s = new GameSession();
    for (let i = 0; i < VIDAS_INICIALES; i++) {
      expect(s.derrotado).toBe(false);
      s.registrarFallo("test");
    }
    expect(s.vidas).toBe(0);
    expect(s.derrotado).toBe(true);
  });

  it("marca módulos como completados", () => {
    const s = new GameSession();
    s.completarModulo("test");
    expect(s.progreso.get("test")?.completado).toBe(true);
  });

  it("nivelJugador refleja el desempeño en el módulo", () => {
    const s = new GameSession();
    expect(s.nivelJugador("m")).toBe(2); // sin historial
    s.registrarAcierto("m", false);
    s.registrarAcierto("m", false);
    s.registrarAcierto("m", false);
    expect(s.nivelJugador("m")).toBe(3); // 3 aciertos, 0 fallos
    s.registrarFallo("m");
    expect(s.nivelJugador("m")).toBe(2); // ya no está limpio
    s.registrarFallo("m");
    expect(s.nivelJugador("m")).toBe(1); // 2+ fallos
  });
});
