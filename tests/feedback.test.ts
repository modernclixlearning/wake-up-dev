import { describe, expect, it } from "vitest";
import {
  calcularDuracionFeedback,
  DURACION_MIN_FEEDBACK,
  DURACION_MAX_FEEDBACK,
} from "../src/domain/feedback";

describe("calcularDuracionFeedback", () => {
  it("texto muy corto devuelve el mínimo", () => {
    // 10 caracteres → 10/18 ≈ 0.55s → clampea al mínimo
    const duracion = calcularDuracionFeedback("Correcto.");
    expect(duracion).toBe(DURACION_MIN_FEEDBACK);
  });

  it("texto muy largo devuelve el máximo", () => {
    // 300 caracteres → 300/18 ≈ 16.6s → clampea al máximo
    const textoLargo = "a".repeat(300);
    const duracion = calcularDuracionFeedback(textoLargo);
    expect(duracion).toBe(DURACION_MAX_FEEDBACK);
  });

  it("texto intermedio devuelve un valor proporcional entre mínimo y máximo", () => {
    // 108 caracteres → 108/18 = 6s, dentro del rango
    const textoIntermedio = "a".repeat(108);
    const duracion = calcularDuracionFeedback(textoIntermedio);
    expect(duracion).toBeGreaterThan(DURACION_MIN_FEEDBACK);
    expect(duracion).toBeLessThan(DURACION_MAX_FEEDBACK);
    expect(duracion).toBeCloseTo(6, 5);
  });
});
