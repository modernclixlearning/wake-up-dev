import { describe, expect, it } from "vitest";
import {
  BONUS_ESQUIVE_PERFECTO,
  BONUS_POR_BALA_ESQUIVADA,
  calcularBonusEsquive,
  crearCombate,
  derrotado,
  golpear,
  HP_AGENTE_NORMAL,
  HP_JEFE,
} from "../src/domain/combate";

describe("combate — HP por golpes", () => {
  it("crea el estado inicial con el HP máximo", () => {
    const c = crearCombate(HP_AGENTE_NORMAL);
    expect(c.hpActual).toBe(HP_AGENTE_NORMAL);
    expect(c.hpMaximo).toBe(HP_AGENTE_NORMAL);
    expect(derrotado(c)).toBe(false);
  });

  it("golpear resta 1 HP por acierto", () => {
    let c = crearCombate(2);
    c = golpear(c);
    expect(c.hpActual).toBe(1);
    expect(derrotado(c)).toBe(false);
    c = golpear(c);
    expect(c.hpActual).toBe(0);
    expect(derrotado(c)).toBe(true);
  });

  it("no baja de 0 aunque se golpee de más", () => {
    let c = crearCombate(1);
    c = golpear(c);
    c = golpear(c);
    expect(c.hpActual).toBe(0);
    expect(derrotado(c)).toBe(true);
  });

  it("el jefe tiene más HP que un agente normal", () => {
    expect(HP_JEFE).toBeGreaterThan(HP_AGENTE_NORMAL);
  });

  it("no muta el estado original (inmutable)", () => {
    const original = crearCombate(2);
    const golpeado = golpear(original);
    expect(original.hpActual).toBe(2);
    expect(golpeado.hpActual).toBe(1);
  });
});

describe("combate — bonus de esquive", () => {
  it("sin balas esquivadas no da bonus", () => {
    expect(calcularBonusEsquive(0, 3)).toBe(0);
  });

  it("suma el bonus lineal por bala esquivada", () => {
    expect(calcularBonusEsquive(2, 3)).toBe(2 * BONUS_POR_BALA_ESQUIVADA);
  });

  it("esquive perfecto suma el extra", () => {
    expect(calcularBonusEsquive(3, 3)).toBe(3 * BONUS_POR_BALA_ESQUIVADA + BONUS_ESQUIVE_PERFECTO);
  });

  it("ignora casos degenerados (total 0)", () => {
    expect(calcularBonusEsquive(0, 0)).toBe(0);
  });

  it("no cuenta más esquives que balas totales", () => {
    expect(calcularBonusEsquive(5, 3)).toBe(calcularBonusEsquive(3, 3));
  });
});
