import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BancoModulo } from "../src/domain/reto";

/**
 * Valida TODOS los bancos JSON de src/content/retos.
 * Es el gate de calidad del pipeline de contenido: cualquier banco nuevo
 * o editado tiene que pasar estos invariantes en CI antes de entrar al juego.
 */

const DIR_RETOS = join(__dirname, "..", "src", "content", "retos");
const archivos = readdirSync(DIR_RETOS).filter((f) => f.endsWith(".json"));
const bancos: Array<{ archivo: string; banco: BancoModulo }> = archivos.map((archivo) => ({
  archivo,
  banco: JSON.parse(readFileSync(join(DIR_RETOS, archivo), "utf-8")) as BancoModulo,
}));

describe("bancos de contenido", () => {
  it("existe al menos un banco", () => {
    expect(bancos.length).toBeGreaterThan(0);
  });

  it("los ids de reto son únicos globalmente", () => {
    const vistos = new Set<string>();
    for (const { archivo, banco } of bancos) {
      for (const reto of banco.retos) {
        expect(vistos.has(reto.id), `id duplicado ${reto.id} en ${archivo}`).toBe(false);
        vistos.add(reto.id);
      }
    }
  });

  describe.each(bancos)("$archivo", ({ banco }) => {
    it("tiene metadatos de módulo completos", () => {
      expect(banco.modulo.id).toBeTruthy();
      expect(banco.modulo.nombre).toBeTruthy();
    });

    it("cada reto referencia a su módulo y tiene campos base", () => {
      for (const reto of banco.retos) {
        expect(reto.modulo, reto.id).toBe(banco.modulo.id);
        expect(reto.pregunta.trim(), reto.id).not.toBe("");
        expect([1, 2, 3], reto.id).toContain(reto.dificultad);
        expect(typeof reto.bonus2026, reto.id).toBe("boolean");
      }
    });

    it("los multiple-choice tienen 2-4 opciones y la correcta en rango", () => {
      for (const reto of banco.retos) {
        if (reto.tipo !== "multiple-choice") continue;
        expect(reto.opciones.length, reto.id).toBeGreaterThanOrEqual(2);
        // La UI del nivel responde con las teclas 1-4.
        expect(reto.opciones.length, reto.id).toBeLessThanOrEqual(4);
        expect(reto.correcta, reto.id).toBeGreaterThanOrEqual(0);
        expect(reto.correcta, reto.id).toBeLessThan(reto.opciones.length);
        expect(reto.explicacion.trim(), reto.id).not.toBe("");
        for (const op of reto.opciones) expect(op.trim(), reto.id).not.toBe("");
      }
    });

    it("las abiertas tienen rúbrica y un fallback multiple-choice válido del mismo banco", () => {
      const porId = new Map(banco.retos.map((r) => [r.id, r]));
      for (const reto of banco.retos) {
        if (reto.tipo !== "abierta") continue;
        expect(reto.rubrica.trim(), reto.id).not.toBe("");
        const fallback = porId.get(reto.fallbackId);
        expect(fallback, `${reto.id}: fallbackId ${reto.fallbackId} no existe`).toBeDefined();
        expect(fallback?.tipo, `${reto.id}: el fallback debe ser multiple-choice`).toBe(
          "multiple-choice"
        );
      }
    });

    it("incluye al menos un reto bonus 2026", () => {
      expect(banco.retos.some((r) => r.bonus2026)).toBe(true);
    });
  });
});
