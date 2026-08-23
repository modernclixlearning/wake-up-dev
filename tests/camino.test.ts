import { describe, expect, it } from "vitest";
import { crearCamino, OpcionesCamino, PENDIENTE_MAXIMA } from "../src/domain/camino";
import { semillaDe } from "../src/domain/aleatorio";

const base: OpcionesCamino = {
  semilla: semillaDe("01-fundamentos"),
  largo: 2400,
  pisoMin: 234,
  pisoMax: 470,
  semiAltoEstrecho: 66,
  entradaDesde: 120,
  entradaHasta: 420,
  arenaDesde: 1500,
  arenaHasta: 1780,
};

/** Recorre el nivel de 4 en 4 px y aplica `fn` a cada X. */
function recorrer(largo: number, fn: (x: number) => void) {
  for (let x = 0; x <= largo; x += 4) fn(x);
}

describe("camino", () => {
  it("nunca se sale del carril del nivel", () => {
    const camino = crearCamino(base);
    recorrer(base.largo, (x) => {
      const banda = camino.bandaEn(x);
      expect(banda.min).toBeGreaterThanOrEqual(base.pisoMin - 0.001);
      expect(banda.max).toBeLessThanOrEqual(base.pisoMax + 0.001);
      expect(banda.max).toBeGreaterThan(banda.min);
    });
  });

  it("abre la entrada y la arena a todo el ancho, y estrecha el tramo del medio", () => {
    const camino = crearCamino(base);
    const semiMaximo = (base.pisoMax - base.pisoMin) / 2;

    // Entrada: el Oráculo vive arriba del todo y tiene que seguir alcanzable.
    expect(camino.semiAltoEn(60)).toBeCloseTo(semiMaximo, 5);
    // Arena del Jefe: pasillo estrecho ahí volvería injusto esquivar las balas.
    expect(camino.semiAltoEn(base.largo - 200)).toBeCloseTo(semiMaximo, 5);
    // Tramo del medio: acotado de verdad.
    expect(camino.semiAltoEn(900)).toBeCloseTo(base.semiAltoEstrecho, 5);
  });

  it("mantiene la pendiente por debajo del tope que la vuelve seguible", () => {
    // Varias semillas: la garantía tiene que valer para cualquier módulo, no
    // para la que casualmente salió bien.
    for (const id of ["01-fundamentos", "05-herramientas", "13-desarrollo-potenciado-ia", "zzz"]) {
      const camino = crearCamino({ ...base, semilla: semillaDe(id) });
      let maxima = 0;
      recorrer(base.largo, (x) => {
        const pendiente = Math.abs(camino.centroEn(x + 1) - camino.centroEn(x));
        maxima = Math.max(maxima, pendiente);
      });
      expect(maxima).toBeLessThanOrEqual(PENDIENTE_MAXIMA + 0.02);
    }
  });

  it("serpentea de verdad en el tramo estrecho", () => {
    const camino = crearCamino(base);
    let min = Infinity;
    let max = -Infinity;
    for (let x = 500; x < 1400; x += 4) {
      min = Math.min(min, camino.centroEn(x));
      max = Math.max(max, camino.centroEn(x));
    }
    // Si el recorrido fuera recto no habría nada que corregir con las flechas.
    expect(max - min).toBeGreaterThan(40);
  });

  it("es determinista: misma semilla, mismo camino", () => {
    const a = crearCamino(base);
    const b = crearCamino({ ...base });
    recorrer(base.largo, (x) => expect(a.centroEn(x)).toBe(b.centroEn(x)));
  });

  it("da caminos distintos a módulos distintos", () => {
    const a = crearCamino({ ...base, semilla: semillaDe("01-fundamentos") });
    const b = crearCamino({ ...base, semilla: semillaDe("12-seguridad") });
    const distintos = [700, 900, 1100, 1300].some((x) => Math.abs(a.centroEn(x) - b.centroEn(x)) > 1);
    expect(distintos).toBe(true);
  });

  it("acotarPies deja los pies dentro de la banda", () => {
    const camino = crearCamino(base);
    recorrer(base.largo, (x) => {
      const banda = camino.bandaEn(x);
      expect(camino.acotarPies(x, -9999)).toBeCloseTo(banda.min, 5);
      expect(camino.acotarPies(x, 9999)).toBeCloseTo(banda.max, 5);
      const dentro = (banda.min + banda.max) / 2;
      expect(camino.acotarPies(x, dentro)).toBeCloseTo(dentro, 5);
    });
  });

  it("tolera un nivel sin tramo estrecho sin romper la banda", () => {
    const camino = crearCamino({ ...base, entradaHasta: 120, arenaDesde: 120, arenaHasta: 120 });
    recorrer(base.largo, (x) => {
      const banda = camino.bandaEn(x);
      expect(banda.min).toBeGreaterThanOrEqual(base.pisoMin - 0.001);
      expect(banda.max).toBeLessThanOrEqual(base.pisoMax + 0.001);
    });
  });
});
