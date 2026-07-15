#!/usr/bin/env node
/**
 * Herramienta de arte pixel (F11 v3, personajes desde referencia):
 * compone N frames del mismo tamaño en un spritesheet horizontal, listo
 * para cargarse en Kaplay con `k.loadSprite(nombre, url, { sliceX: N })`.
 *
 * Uso:
 *   node tools/pixel-art/componer.mjs <salida.png> <frame1.png> <frame2.png> [...]
 *
 * El orden de los frames en la línea de comandos es el orden de los índices
 * de animación en el sheet (frame 0 = primer archivo).
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const [, , salida, ...frames] = process.argv;

if (!salida || frames.length < 2) {
  console.error("Uso: node tools/pixel-art/componer.mjs <salida.png> <frame1.png> <frame2.png> [...]");
  process.exit(1);
}

async function main() {
  const metadatos = await Promise.all(frames.map((f) => sharp(f).metadata()));
  const { width: ancho, height: alto } = metadatos[0];
  for (let i = 1; i < metadatos.length; i++) {
    if (metadatos[i].width !== ancho || metadatos[i].height !== alto) {
      console.error(
        `Los frames deben tener el mismo tamaño: ${frames[0]} es ${ancho}x${alto} ` +
          `pero ${frames[i]} es ${metadatos[i].width}x${metadatos[i].height}.`
      );
      process.exit(1);
    }
  }

  await mkdir(dirname(salida), { recursive: true });
  await sharp({
    create: {
      width: ancho * frames.length,
      height: alto,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames.map((f, i) => ({ input: f, left: i * ancho, top: 0 })))
    .png()
    .toFile(salida);

  console.log(`OK: ${salida} (${ancho * frames.length}x${alto}, ${frames.length} frames de ${ancho}x${alto})`);
}

main();
