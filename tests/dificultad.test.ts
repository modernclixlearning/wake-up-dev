import { describe, expect, it } from "vitest";
import { dificultadPara, LIBERADOS_PARA_TOPE } from "../src/domain/dificultad";

describe("dificultad progresiva", () => {
  it("arranca en los valores base con cero módulos liberados", () => {
    const d = dificultadPara(0);
    expect(d.intensidad).toBe(0);
    expect(d.velocidadAgente).toBe(100);
    expect(d.agentesSimultaneos).toBe(1);
    expect(d.segundosParaResponder).toBe(60);
    expect(d.etiqueta).toBe("INICIAL");
  });

  it("sube de forma monótona: ninguna perilla afloja al avanzar", () => {
    let previo = dificultadPara(0);
    for (let n = 1; n <= 10; n++) {
      const actual = dificultadPara(n);
      expect(actual.velocidadAgente).toBeGreaterThanOrEqual(previo.velocidadAgente);
      expect(actual.agentesSimultaneos).toBeGreaterThanOrEqual(previo.agentesSimultaneos);
      // Menos tiempo y menos espera entre golpes = más difícil.
      expect(actual.segundosParaResponder).toBeLessThanOrEqual(previo.segundosParaResponder);
      expect(actual.cadenciaAtaque).toBeLessThanOrEqual(previo.cadenciaAtaque);
      previo = actual;
    }
  });

  it("tiene techo: pasado el tope no sigue endureciéndose", () => {
    const tope = dificultadPara(LIBERADOS_PARA_TOPE);
    expect(dificultadPara(LIBERADOS_PARA_TOPE + 4)).toEqual(tope);
    expect(dificultadPara(999)).toEqual(tope);
    expect(tope.intensidad).toBe(1);
    expect(tope.etiqueta).toBe("MÁXIMA");
  });

  it("mantiene el juego jugable en el tope", () => {
    const tope = dificultadPara(999);
    // Los Smiths nunca corren más que Neo (220 px/s): si lo alcanzaran siempre,
    // no habría forma de reposicionarse y el combate dejaría de ser justo.
    expect(tope.velocidadAgente).toBeLessThan(220);
    // Tiempo suficiente para leer un enunciado largo y cuatro opciones.
    expect(tope.segundosParaResponder).toBeGreaterThanOrEqual(30);
    // Con la telegrafía en 0,55s el jugador siempre puede reaccionar.
    expect(tope.cadenciaAtaque).toBeGreaterThan(0.55 * 2);
    expect(tope.agentesSimultaneos).toBeLessThanOrEqual(3);
  });

  it("escalona la simultaneidad en saltos visibles", () => {
    expect(dificultadPara(0).agentesSimultaneos).toBe(1);
    expect(dificultadPara(1).agentesSimultaneos).toBe(1);
    expect(dificultadPara(2).agentesSimultaneos).toBe(2);
    expect(dificultadPara(4).agentesSimultaneos).toBe(2);
    expect(dificultadPara(5).agentesSimultaneos).toBe(3);
  });

  it("tolera entradas basura sin romper el balance", () => {
    expect(dificultadPara(-3)).toEqual(dificultadPara(0));
    expect(dificultadPara(2.7).agentesSimultaneos).toBe(2);
    expect(dificultadPara(NaN)).toEqual(dificultadPara(0));
  });
});
