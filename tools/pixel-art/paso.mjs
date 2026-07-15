#!/usr/bin/env node
/**
 * Herramienta de arte pixel (F11 v3): genera la pose de "paso" (piernas
 * juntas) para un ciclo de caminata de 2 frames (contacto + paso) a partir
 * del frame de contacto (la zancada). Útil cuando la referencia trae dos
 * poses de caminata casi idénticas y la animación parece un deslizamiento.
 *
 * Borra la zancada por debajo del ruedo del saco y dibuja piernas verticales
 * juntas + zapato, con colores muestreados del propio sprite (pantalón,
 * zapato, contorno).
 *
 * Uso:
 *   node tools/pixel-art/paso.mjs <contacto.png> <salida.png> <borrar> <x0> <x1> <zapato> <punta>
 *
 *   borrar  fila desde la que se limpia todo (debajo del ruedo del saco)
 *   x0..x1  columnas de las piernas juntas
 *   zapato  fila donde empieza el zapato (el piso es la última fila)
 *   punta   px que el zapato se extiende hacia adelante (derecha)
 *
 * Valores usados: smith 57 23 39 74 5 · jefe 55 22 42 73 6
 */
import sharp from "sharp";

const [, , entrada, salida, ...nums] = process.argv;
const [borrar, x0, x1, zapatoY, punta] = nums.map(Number);

if (!entrada || !salida || nums.length !== 5 || nums.some((n) => Number.isNaN(Number(n)))) {
  console.error("Uso: node tools/pixel-art/paso.mjs <contacto.png> <salida.png> <borrar> <x0> <x1> <zapato> <punta>");
  process.exit(1);
}

function masFrecuente(pixeles) {
  const conteo = new Map();
  for (const p of pixeles) {
    const key = p.join(",");
    conteo.set(key, (conteo.get(key) ?? 0) + 1);
  }
  let mejor = null;
  let max = 0;
  for (const [key, n] of conteo) {
    if (n > max) {
      max = n;
      mejor = key;
    }
  }
  return mejor ? mejor.split(",").map(Number) : [20, 20, 24];
}

const { data, info } = await sharp(entrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const piso = H - 1;
const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};
const setPx = (x, y, [r, g, b]) => {
  const i = (y * W + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = 255;
};
const clearPx = (x, y) => {
  const i = (y * W + x) * 4;
  data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
};

// Colores muestreados: contorno = pixel opaco más brillante; pantalón/zapato =
// color más frecuente en su zona.
let contorno = [220, 255, 220];
let brilloMax = -1;
const pantalones = [];
const zapatos = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [r, g, b, a] = px(x, y);
    if (a < 200) continue;
    const brillo = r + g + b;
    if (brillo > brilloMax) {
      brilloMax = brillo;
      contorno = [r, g, b];
    }
    if (y >= borrar && y < zapatoY && brillo < 260) pantalones.push([r, g, b]);
    if (y >= zapatoY && y <= piso && brillo < 260) zapatos.push([r, g, b]);
  }
}
const pantalon = masFrecuente(pantalones);
const zapato = masFrecuente(zapatos);

// 1) Borrar la zancada por debajo del ruedo del saco.
for (let y = borrar; y < H; y++) {
  for (let x = 0; x < W; x++) clearPx(x, y);
}

// 2) Piernas juntas: columna de pantalón con contorno lateral de 1px y una
// línea divisoria más oscura para sugerir las dos piernas.
const divisor = [Math.max(0, pantalon[0] - 14), Math.max(0, pantalon[1] - 14), Math.max(0, pantalon[2] - 14)];
const xMedio = Math.floor((x0 + x1) / 2);
for (let y = borrar; y < zapatoY; y++) {
  for (let x = x0; x <= x1; x++) {
    const borde = x === x0 || x === x1;
    setPx(x, y, borde ? contorno : x === xMedio ? divisor : pantalon);
  }
}

// 3) Zapato bajito con punta corta hacia adelante, contorneado.
for (let y = zapatoY; y <= piso; y++) {
  for (let x = x0; x <= x1 + punta; x++) {
    const borde = x === x0 || x === x1 + punta || y === piso;
    setPx(x, y, borde ? contorno : zapato);
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(salida);
await sharp(salida)
  .resize(W * 12, H * 12, { kernel: "nearest" })
  .toFile(salida.replace(/\.png$/, "-preview.png"));
console.log(
  `OK: ${salida} (pantalon rgb(${pantalon.join(",")}), zapato rgb(${zapato.join(",")}), contorno rgb(${contorno.join(",")}))`
);
