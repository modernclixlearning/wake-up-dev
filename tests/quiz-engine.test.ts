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
