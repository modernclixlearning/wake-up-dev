import { describe, expect, it } from "vitest";
import {
  GameSession,
  restaurarSesion,
  serializarSesion,
  VIDAS_INICIALES,
} from "../src/domain/session";

describe("session — golpes físicos del combate arcade (F12)", () => {
  it("un golpe físico cuesta una vida", () => {
    const s = new GameSession();
    s.recibirGolpeFisico();
    expect(s.vidas).toBe(VIDAS_INICIALES - 1);
  });

  it("no cuenta como fallo del módulo (no baja el nivel adaptativo)", () => {
    const s = new GameSession();
    s.recibirGolpeFisico();
    s.recibirGolpeFisico();
    expect(s.nivelJugador("m1")).toBe(2);
    expect(s.progreso.get("m1")).toBeUndefined();
  });

  it("puede derrotarte a golpes sin fallar ninguna pregunta", () => {
    const s = new GameSession();
    for (let i = 0; i < VIDAS_INICIALES; i++) s.recibirGolpeFisico();
    expect(s.derrotado).toBe(true);
  });
});

describe("session — persistencia del avance", () => {
  it("serializar y restaurar conserva score y progreso, con las vidas llenas", () => {
    const s = new GameSession();
    s.registrarAcierto("m1", false);
    s.registrarAcierto("m1", true);
    s.registrarFallo("m2");
    s.completarModulo("m1");
    s.recibirGolpeFisico();

    const restaurada = restaurarSesion(JSON.parse(JSON.stringify(serializarSesion(s))));
    expect(restaurada.score).toBe(s.score);
    expect(restaurada.progreso.get("m1")).toEqual({ completado: true, aciertos: 2, fallos: 0 });
    expect(restaurada.progreso.get("m2")).toEqual({ completado: false, aciertos: 0, fallos: 1 });
    // Las vidas no se persisten: cada sesión arranca con las vidas llenas.
    expect(restaurada.vidas).toBe(VIDAS_INICIALES);
  });

  it("el nivel adaptativo sobrevive al guardado", () => {
    const s = new GameSession();
    for (let i = 0; i < 3; i++) s.registrarAcierto("m1", false);
    const restaurada = restaurarSesion(serializarSesion(s));
    expect(restaurada.nivelJugador("m1")).toBe(3);
  });

  it("ante datos corruptos devuelve una sesión nueva sin romper", () => {
    for (const basura of [null, undefined, 42, "hola", [], {}, { version: 99 }, { version: 1 }]) {
      const s = restaurarSesion(basura);
      expect(s.score).toBe(0);
      expect(s.vidas).toBe(VIDAS_INICIALES);
      expect(s.progreso.size).toBe(0);
    }
  });

  it("ignora entradas de progreso malformadas sin descartar las válidas", () => {
    const s = restaurarSesion({
      version: 1,
      score: 300,
      progreso: [
        { moduloId: "m1", completado: true, aciertos: 4, fallos: 1 },
        { completado: true },
        null,
        { moduloId: "m2", completado: "sí", aciertos: -3, fallos: "muchos" },
      ],
    });
    expect(s.score).toBe(300);
    expect(s.progreso.get("m1")).toEqual({ completado: true, aciertos: 4, fallos: 1 });
    expect(s.progreso.get("m2")).toEqual({ completado: false, aciertos: 0, fallos: 0 });
    expect(s.progreso.size).toBe(2);
  });
});
