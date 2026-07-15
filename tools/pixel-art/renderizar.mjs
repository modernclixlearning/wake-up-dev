#!/usr/bin/env node
/**
 * Contraparte de reducir.mjs: toma un <salida>.pixelmap.txt (generado por
 * reducir.mjs o editado a mano) y vuelve a renderizar el PNG final + su
 * preview ampliada. Este es el loop rápido de retoque: editar el texto,
 * correr este script, mirar el preview, repetir — sin volver a tocar la
 * imagen de referencia original.
 *
 * Uso:
 *   node tools/pixel-art/renderizar.mjs <entrada.pixelmap.txt> <salida-sin-extension>
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const [, , entrada, salida] = process.argv;

if (!entrada || !salida) {
  console.error("Uso: node tools/pixel-art/renderizar.mjs <entrada.pixelmap.txt> <salida-sin-extension>");
  process.exit(1);
}

function parsearHex(h) {
  const limpio = h.trim().replace("#", "");
  return [parseInt(limpio.slice(0, 2), 16), parseInt(limpio.slice(2, 4), 16), parseInt(limpio.slice(4, 6), 16)];
}

async function main() {
  const texto = await readFile(entrada, "utf-8");
  const lineas = texto.split("\n");

  const leyenda = new Map();
  let enGrid = false;
  const filasGrid = [];

  for (const lineaCruda of lineas) {
    const linea = lineaCruda.replace(/\r$/, "");
    if (linea.startsWith("# Grid:")) {
      enGrid = true;
      continue;
    }
    if (enGrid) {
      if (linea.length > 0) filasGrid.push(linea);
      continue;
    }
    const match = linea.match(/^(\S)\s*=\s*(#[0-9a-fA-F]{6,8})/);
    if (match) leyenda.set(match[1], parsearHex(match[2]));
  }

  const alto = filasGrid.length;
  const ancho = Math.max(...filasGrid.map((f) => f.length));
  if (alto === 0 || ancho === 0) {
    console.error("No se encontró un grid válido en el pixelmap.");
    process.exit(1);
  }

  const raw = Buffer.alloc(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    const fila = filasGrid[y] ?? "";
    for (let x = 0; x < ancho; x++) {
      const destino = (y * ancho + x) * 4;
      const caracter = fila[x] ?? ".";
      if (caracter === "." || !leyenda.has(caracter)) {
        raw[destino + 3] = 0;
        continue;
      }
      const [r, g, b] = leyenda.get(caracter);
      raw[destino] = r;
      raw[destino + 1] = g;
      raw[destino + 2] = b;
      raw[destino + 3] = 255;
    }
  }

  await sharp(raw, { raw: { width: ancho, height: alto, channels: 4 } }).png().toFile(`${salida}.png`);

  const escalaPreview = 12;
  await sharp(`${salida}.png`)
    .resize(ancho * escalaPreview, alto * escalaPreview, { kernel: "nearest" })
    .png()
    .toFile(`${salida}-preview.png`);

  console.log(`OK: ${salida}.png (${ancho}x${alto}), ${salida}-preview.png (x${escalaPreview})`);
}

main();
