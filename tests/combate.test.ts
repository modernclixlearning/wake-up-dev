import { describe, expect, it } from "vitest";
import {
  BONUS_FASE_SIN_DANO,
  BONUS_POR_GOLPE_CONECTADO,
  calcularBonusFase,
  conectarGolpe,
  crearCombate,
  crearFase,
  derrotado,
  enemigoAturdido,
  GOLPES_PARA_ATURDIR,
  golpear,
  HP_AGENTE_NORMAL,
  HP_JEFE,
  recibirGolpe,
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

describe("combate — fase arcade (piñas/tiros antes de la pregunta)", () => {
  it("arranca sin golpes y sin enemigo aturdido", () => {
    const fase = crearFase();
    expect(fase.golpesConectados).toBe(0);
    expect(fase.golpesRecibidos).toBe(0);
    expect(enemigoAturdido(fase)).toBe(false);
  });

  it("aturde al enemigo al conectar los golpes necesarios", () => {
    let fase = crearFase();
    for (let i = 0; i < GOLPES_PARA_ATURDIR - 1; i++) {
      fase = conectarGolpe(fase);
      expect(enemigoAturdido(fase)).toBe(false);
    }
    fase = conectarGolpe(fase);
    expect(enemigoAturdido(fase)).toBe(true);
  });

  it("recibir golpes no aturde al enemigo", () => {
    let fase = crearFase();
    for (let i = 0; i < GOLPES_PARA_ATURDIR + 1; i++) fase = recibirGolpe(fase);
    expect(enemigoAturdido(fase)).toBe(false);
    expect(fase.golpesRecibidos).toBe(GOLPES_PARA_ATURDIR + 1);
  });

  it("no muta la fase original (inmutable)", () => {
    const original = crearFase();
    conectarGolpe(original);
    recibirGolpe(original);
    expect(original.golpesConectados).toBe(0);
    expect(original.golpesRecibidos).toBe(0);
  });

  it("sin golpes conectados no hay bonus", () => {
    expect(calcularBonusFase(crearFase())).toBe(0);
    expect(calcularBonusFase(recibirGolpe(crearFase()))).toBe(0);
  });

  it("suma el bonus lineal por golpe conectado", () => {
    let fase = recibirGolpe(crearFase());
    fase = conectarGolpe(conectarGolpe(fase));
    expect(calcularBonusFase(fase)).toBe(2 * BONUS_POR_GOLPE_CONECTADO);
  });

  it("fase sin daño recibido suma el extra", () => {
    let fase = crearFase();
    for (let i = 0; i < GOLPES_PARA_ATURDIR; i++) fase = conectarGolpe(fase);
    expect(calcularBonusFase(fase)).toBe(
      GOLPES_PARA_ATURDIR * BONUS_POR_GOLPE_CONECTADO + BONUS_FASE_SIN_DANO
    );
  });
});
