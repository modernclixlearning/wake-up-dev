#!/usr/bin/env node
/**
 * Herramienta de arte pixel (F11 v3, personajes desde referencia):
 * reduce una imagen de referencia (alta resolución, estilo 8-bit pero sin
 * ser pixel art real — ej. generada con Nano Banana) a un sprite real de
 * baja resolución, con paleta acotada.
 *
 * Uso:
 *   node tools/pixel-art/reducir.mjs <entrada.png> <ancho> <alto> <salida-sin-extension> [colores]
 *
 * Genera:
 *   <salida>.png            sprite final en la resolución objetivo
 *   <salida>-preview.png    el mismo sprite ampliado (vecino más cercano) para verlo cómodo
 *   <salida>.pixelmap.txt   mapa de píxeles en texto (leyenda + grid) para retocar a mano
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const [, , entrada, anchoArg, altoArg, salida, coloresArg] = process.argv;

if (!entrada || !anchoArg || !altoArg || !salida) {
  console.error(
    "Uso: node tools/pixel-art/reducir.mjs <entrada.png> <ancho> <alto> <salida-sin-extension> [colores=16]"
  );
  process.exit(1);
}

const ancho = Number(anchoArg);
const alto = Number(altoArg);
const maxColores = Number(coloresArg ?? 16);
const UMBRAL_TRANSPARENCIA = 32; // alpha por debajo de esto se considera "vacío" (fondo)
const UMBRAL_FONDO2 = 900; // distancia2 de color por debajo de esto se considera "fondo" (se hace transparente)

/** Distancia euclídea al cuadrado entre dos colores RGB — evita el costo de la raíz para comparar. */
function distancia2(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * K-means minimalista sobre los colores opacos de la imagen: agrupa en `k` colores
 * representativos. No hace falta que sea sofisticado — es una herramienta de un solo uso,
 * y el resultado siempre se retoca a mano después via el pixelmap.
 */
function cuantizarPaleta(pixelesOpacos, k, iteraciones = 12) {
  if (pixelesOpacos.length === 0) return [];
  const objetivo = Math.min(k, pixelesOpacos.length);
  // Semilla: muestreo espaciado uniforme sobre los píxeles opacos (determinístico, sin RNG).
  const paso = Math.max(1, Math.floor(pixelesOpacos.length / objetivo));
  let centros = [];
  for (let i = 0; i < objetivo; i++) centros.push([...pixelesOpacos[Math.min(i * paso, pixelesOpacos.length - 1)]]);

  for (let iter = 0; iter < iteraciones; iter++) {
    const sumas = centros.map(() => [0, 0, 0, 0]);
    for (const px of pixelesOpacos) {
      let mejor = 0;
      let mejorDist = Infinity;
      for (let c = 0; c < centros.length; c++) {
        const d = distancia2(px, centros[c]);
        if (d < mejorDist) {
          mejorDist = d;
          mejor = c;
        }
      }
      sumas[mejor][0] += px[0];
      sumas[mejor][1] += px[1];
      sumas[mejor][2] += px[2];
      sumas[mejor][3] += 1;
    }
    centros = centros.map((centroPrevio, c) =>
      sumas[c][3] > 0
        ? [Math.round(sumas[c][0] / sumas[c][3]), Math.round(sumas[c][1] / sumas[c][3]), Math.round(sumas[c][2] / sumas[c][3])]
        : centroPrevio
    );
  }
  return centros;
}

/** Funde centros de color casi idénticos (típico cuando la imagen tiene menos colores reales que `k`). */
function fusionarColoresCercanos(centros, umbralDistancia2 = 64) {
  const unicos = [];
  for (const c of centros) {
    const yaExiste = unicos.some((u) => distancia2(u, c) <= umbralDistancia2);
    if (!yaExiste) unicos.push(c);
  }
  return unicos;
}

function hex(rgb) {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Referencias tipo Nano Banana suelen venir en JPEG (sin alpha) con fondo
 * blanco/uniforme de sobra alrededor del personaje. Recorta ese margen
 * (`trim`) y además hace transparente cualquier píxel — esté donde esté,
 * no solo en el borde — que se parezca al color de fondo (ej. el hueco
 * entre las piernas debajo de la gabardina).
 */
function quitarFondo(data, ancho, alto, channels, colorFondo) {
  for (let i = 0; i < ancho * alto; i++) {
    const base = i * channels;
    const px = [data[base], data[base + 1], data[base + 2]];
    if (distancia2(px, colorFondo) <= UMBRAL_FONDO2) data[base + 3] = 0;
  }
}

const COLOR_CONTORNO = [220, 255, 220]; // BLANCO de theme.ts — mismo contorno que usan los shapes procedurales.

/**
 * Agrega 1px de contorno claro alrededor de toda la silueta (igual que
 * `contorno()` en actores.ts, pero horneado en el sprite en vez de vía
 * `k.outline()` — que no soporta sprites). Sin esto, cualquier zona oscura
 * de la ropa se funde con el fondo negro del canvas (bug real documentado
 * en AGENTS.md). Engorda la silueta 1px hacia afuera, no pisa píxeles
 * internos.
 */
function agregarContorno(indicePorPixel, ancho, alto, paleta) {
  const indiceContorno = paleta.length;
  paleta.push(COLOR_CONTORNO);
  const original = indicePorPixel.slice();
  const vecinos = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      if (original[i] !== -1) continue;
      const tieneVecinoOpaco = vecinos.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) return false;
        return original[ny * ancho + nx] !== -1;
      });
      if (tieneVecinoOpaco) indicePorPixel[i] = indiceContorno;
    }
  }
}

async function main() {
  // 1) Recortar el margen uniforme alrededor del personaje.
  const recortada = sharp(entrada).trim();
  const { data: dataCompleta, info: infoCompleta } = await recortada
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: anchoCompleto, height: altoCompleto, channels: canalesCompletos } = infoCompleta;

  // 2) Sacar el color de fondo de la esquina superior izquierda (ya recortada) y
  // hacer transparente todo lo que se le parezca, esté o no en el borde.
  const colorFondo = [dataCompleta[0], dataCompleta[1], dataCompleta[2]];
  quitarFondo(dataCompleta, anchoCompleto, altoCompleto, canalesCompletos, colorFondo);

  // 3) Reducir a la resolución objetivo (vecino más cercano: no mezcla colores ni alpha).
  const { data, info } = await sharp(dataCompleta, {
    raw: { width: anchoCompleto, height: altoCompleto, channels: canalesCompletos },
  })
    .resize(ancho, alto, { kernel: "nearest", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { channels } = info;
  const totalPixeles = ancho * alto;

  const pixelesOpacos = [];
  for (let i = 0; i < totalPixeles; i++) {
    const base = i * channels;
    const alphaPx = data[base + 3];
    if (alphaPx >= UMBRAL_TRANSPARENCIA) pixelesOpacos.push([data[base], data[base + 1], data[base + 2]]);
  }

  const paleta = fusionarColoresCercanos(cuantizarPaleta(pixelesOpacos, maxColores));
  const indicePorPixel = new Int16Array(totalPixeles).fill(-1); // -1 = transparente

  for (let i = 0; i < totalPixeles; i++) {
    const base = i * channels;
    if (data[base + 3] < UMBRAL_TRANSPARENCIA) continue;
    const px = [data[base], data[base + 1], data[base + 2]];
    let mejor = 0;
    let mejorDist = Infinity;
    for (let c = 0; c < paleta.length; c++) {
      const d = distancia2(px, paleta[c]);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = c;
      }
    }
    indicePorPixel[i] = mejor;
  }

  agregarContorno(indicePorPixel, ancho, alto, paleta);

  const salidaRaw = Buffer.alloc(totalPixeles * 4);
  for (let i = 0; i < totalPixeles; i++) {
    const idx = indicePorPixel[i];
    const destino = i * 4;
    if (idx === -1) continue; // alpha ya queda en 0 por el Buffer.alloc
    salidaRaw[destino] = paleta[idx][0];
    salidaRaw[destino + 1] = paleta[idx][1];
    salidaRaw[destino + 2] = paleta[idx][2];
    salidaRaw[destino + 3] = 255;
  }

  await sharp(salidaRaw, { raw: { width: ancho, height: alto, channels: 4 } }).png().toFile(`${salida}.png`);

  const escalaPreview = 12;
  await sharp(`${salida}.png`)
    .resize(ancho * escalaPreview, alto * escalaPreview, { kernel: "nearest" })
    .png()
    .toFile(`${salida}-preview.png`);

  const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const leyenda = paleta.map((c, i) => `${ALFABETO[i]} = ${hex(c)}`).join("\n");
  let grid = "";
  for (let y = 0; y < alto; y++) {
    let fila = "";
    for (let x = 0; x < ancho; x++) {
      const idx = indicePorPixel[y * ancho + x];
      fila += idx === -1 ? "." : ALFABETO[idx];
    }
    grid += fila + "\n";
  }
  const pixelmap = `# ${salida}.pixelmap.txt — ${ancho}x${alto}, "." = transparente\n# Leyenda:\n${leyenda}\n\n# Grid:\n${grid}`;
  await writeFile(`${salida}.pixelmap.txt`, pixelmap, "utf-8");

  console.log(`OK: ${salida}.png (${ancho}x${alto}), ${salida}-preview.png (x${escalaPreview}), ${salida}.pixelmap.txt`);
  console.log(`Paleta: ${paleta.length} colores.`);
}

main();
