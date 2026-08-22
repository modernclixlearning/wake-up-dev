import { describe, expect, it } from "vitest";
import { teclaDeModulo } from "../src/domain/teclado";

describe("teclaDeModulo", () => {
  it("devuelve '1' para el primer módulo (índice 0)", () => {
    expect(teclaDeModulo(0)).toBe("1");
  });

  it("devuelve '9' para el noveno módulo (índice 8)", () => {
    expect(teclaDeModulo(8)).toBe("9");
  });

  it("devuelve '0' para el décimo módulo (índice 9) — regresión del bug histórico", () => {
    // Antes de este fix la función devolvía String(9 + 1) = "10", que no es una
    // tecla válida; el décimo módulo quedaba inalcanzable desde el teclado.
    const tecla = teclaDeModulo(9);
    expect(tecla).toBe("0");
    expect(tecla).not.toBe("10");
    expect(tecla.length).toBe(1);
  });

  it("devuelve cadena vacía para índices de undécimo módulo en adelante", () => {
    expect(teclaDeModulo(10)).toBe("");
    expect(teclaDeModulo(11)).toBe("");
  });
});
