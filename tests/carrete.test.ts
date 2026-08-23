import { describe, expect, it } from "vitest";
import { generarCarrete, OpcionesCarrete } from "../src/domain/carrete";
import { semillaDe } from "../src/domain/aleatorio";

const base: OpcionesCarrete = {
  semilla: semillaDe("01-fundamentos"),
  desde: 0,
  hasta: 2400,
  pasoMin: 90,
  pasoMax: 210,
  repertorio: [
    { tipo: "pasto", peso: 4 },
    { tipo: "cerca", peso: 2 },
    { tipo: "muro", peso: 2 },
    { tipo: "poste", peso: 1 },
  ],
  repeticionMaxima: 2,
};

describe("carrete", () => {
  it("siembra piezas a lo largo de todo el tramo pedido", () => {
    const items = generarCarrete(base);
    expect(items.length).toBeGreaterThan(10);
    expect(items[0].x).toBe(base.desde);
    expect(items[items.length - 1].x).toBeLessThan(base.hasta);
  });

  it("respeta la separación mínima y máxima entre piezas", () => {
    const items = generarCarrete(base);
    for (let i = 1; i < items.length; i++) {
      const paso = items[i].x - items[i - 1].x;
      expect(paso).toBeGreaterThanOrEqual(base.pasoMin);
      expect(paso).toBeLessThanOrEqual(base.pasoMax);
    }
  });

  it("no encadena más repeticiones de las permitidas", () => {
    // Rachas largas se leen como un tileado roto, no como variedad.
    const items = generarCarrete({ ...base, repeticionMaxima: 2 });
    let racha = 1;
    for (let i = 1; i < items.length; i++) {
      racha = items[i].tipo === items[i - 1].tipo ? racha + 1 : 1;
      expect(racha).toBeLessThanOrEqual(2);
    }
  });

  it("solo usa tipos del repertorio y variaciones normalizadas", () => {
    const permitidos = new Set(base.repertorio.map((p) => p.tipo));
    for (const item of generarCarrete(base)) {
      expect(permitidos.has(item.tipo)).toBe(true);
      expect(item.variacion).toBeGreaterThanOrEqual(0);
      expect(item.variacion).toBeLessThan(1);
    }
  });

  it("es determinista y distinto entre semillas", () => {
    const a = generarCarrete(base);
    const b = generarCarrete({ ...base });
    expect(b).toEqual(a);
    const otro = generarCarrete({ ...base, semilla: semillaDe("12-seguridad") });
    expect(otro).not.toEqual(a);
  });

  it("devuelve vacío si el tramo o el repertorio están vacíos", () => {
    expect(generarCarrete({ ...base, hasta: base.desde })).toEqual([]);
    expect(generarCarrete({ ...base, repertorio: [] })).toEqual([]);
  });

  it("con un solo tipo en el repertorio no se cuelga", () => {
    const items = generarCarrete({ ...base, repertorio: [{ tipo: "pasto", peso: 1 }] });
    expect(items.length).toBeGreaterThan(10);
    expect(items.every((i) => i.tipo === "pasto")).toBe(true);
  });
});
