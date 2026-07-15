import { describe, expect, it } from "vitest";
import { GameSession, VIDAS_INICIALES } from "../src/domain/session";

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
