import { describe, expect, it } from "vitest";
import {
  calcularCuentaAtras,
  limiteDe,
  SEGUNDOS_ABIERTA,
  SEGUNDOS_MULTIPLE_CHOICE,
  UMBRAL_URGENTE,
} from "../src/domain/cuenta-atras";

const TOTAL = SEGUNDOS_MULTIPLE_CHOICE;

describe("cuenta atrás", () => {
  it("formatea como M:SS con el resto siempre de dos cifras", () => {
    expect(calcularCuentaAtras(60, TOTAL).texto).toBe("1:00");
    expect(calcularCuentaAtras(59, TOTAL).texto).toBe("0:59");
    expect(calcularCuentaAtras(9, TOTAL).texto).toBe("0:09");
    expect(calcularCuentaAtras(0, TOTAL).texto).toBe("0:00");
    expect(calcularCuentaAtras(125, SEGUNDOS_ABIERTA).texto).toBe("2:05");
  });

  it("redondea hacia arriba: quedando fracción de segundo todavía se puede responder", () => {
    // Con 0,4s el jugador aún llega; leer "0" sería mentirle.
    expect(calcularCuentaAtras(0.4, TOTAL).segundos).toBe(1);
    expect(calcularCuentaAtras(0.4, TOTAL).agotado).toBe(false);
    expect(calcularCuentaAtras(30.001, TOTAL).segundos).toBe(31);
  });

  it("marca agotado solo cuando el tiempo llegó a cero", () => {
    expect(calcularCuentaAtras(0.001, TOTAL).agotado).toBe(false);
    expect(calcularCuentaAtras(0, TOTAL).agotado).toBe(true);
    expect(calcularCuentaAtras(-5, TOTAL).agotado).toBe(true);
  });

  it("nunca devuelve segundos negativos aunque el reloj se pase", () => {
    const estado = calcularCuentaAtras(-12, TOTAL);
    expect(estado.segundos).toBe(0);
    expect(estado.texto).toBe("0:00");
    expect(estado.fraccion).toBe(0);
  });

  it("entra en urgente en los últimos segundos y no antes", () => {
    expect(calcularCuentaAtras(UMBRAL_URGENTE + 0.5, TOTAL).urgente).toBe(false);
    expect(calcularCuentaAtras(UMBRAL_URGENTE, TOTAL).urgente).toBe(true);
    expect(calcularCuentaAtras(1, TOTAL).urgente).toBe(true);
  });

  it("da una fracción de 1 a 0 acotada a ese rango", () => {
    expect(calcularCuentaAtras(TOTAL, TOTAL).fraccion).toBe(1);
    expect(calcularCuentaAtras(TOTAL / 2, TOTAL).fraccion).toBeCloseTo(0.5, 5);
    expect(calcularCuentaAtras(0, TOTAL).fraccion).toBe(0);
    // Un resto mayor que el total (reloj mal inicializado) no rompe la barra.
    expect(calcularCuentaAtras(TOTAL * 2, TOTAL).fraccion).toBe(1);
  });

  it("tolera un total inválido sin devolver NaN ni Infinity", () => {
    expect(calcularCuentaAtras(10, 0).fraccion).toBe(0);
    expect(Number.isNaN(calcularCuentaAtras(NaN, TOTAL).segundos)).toBe(false);
    expect(calcularCuentaAtras(NaN, TOTAL).agotado).toBe(true);
  });

  it("da más tiempo a las abiertas que a las de opciones", () => {
    expect(limiteDe("multiple-choice")).toBe(SEGUNDOS_MULTIPLE_CHOICE);
    expect(limiteDe("abierta")).toBe(SEGUNDOS_ABIERTA);
    expect(limiteDe("abierta")).toBeGreaterThan(limiteDe("multiple-choice"));
  });
});
