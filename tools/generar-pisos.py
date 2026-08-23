# -*- coding: utf-8 -*-
"""Genera public/fondos/piso-<fondo>.png (960x306): la textura de suelo OPACA
de cada escenario (F14 v4).

Por que existe: el suelo del nivel se tilea en coordenadas de MUNDO (scrollea
con la camara) mientras el backdrop queda fijo. La v3 recortaba una franja del
propio fondo, pero en escenas sin piso pintado en esa banda (la ciudad son
edificios) el suelo se leia "transparente". Estas texturas son opacas, con la
paleta muestreada del fondo real y perspectiva simple: piezas mas grandes
cuanto mas abajo (mas cerca de camara), como el mockup de referencia.

Uso:  python tools/generar-pisos.py   (desde la raiz del repo)
Determinista: mismo nombre de fondo -> misma textura (random.Random(nombre)).
"""
from PIL import Image, ImageDraw
import math
import random

ALTO, ANCHO = 306, 960


def jitter(rng, c, lo, hi):
    f = rng.uniform(lo, hi)
    return tuple(max(0, min(255, int(v * f))) for v in c)


def adoquin(rng, base):
    """Empedrado irregular con perspectiva (calle: ciudad, cabina)."""
    img = Image.new("RGB", (ANCHO, ALTO), jitter(rng, base, 0.4, 0.4))
    d = ImageDraw.Draw(img)
    y = 0
    while y < ALTO:
        f = y / ALTO  # 0 arriba (lejos) .. 1 abajo (cerca)
        alto_fila = int(11 + 14 * f) + rng.randint(0, 3)
        x = -rng.randint(0, 30)
        while x < ANCHO:
            w = int(20 + 26 * f) + rng.randint(0, 14)
            d.rectangle([x + 1, y + 1, x + w - 1, y + alto_fila - 1], fill=jitter(rng, base, 0.8, 1.25))
            d.line([x + 2, y + 1, x + w - 2, y + 1], fill=jitter(rng, base, 1.45, 1.6))
            d.line([x + 2, y + alto_fila - 1, x + w - 2, y + alto_fila - 1], fill=jitter(rng, base, 0.35, 0.45))
            for _ in range(rng.randint(1, 4)):
                px = rng.randint(x + 2, max(x + 3, x + w - 2))
                py = rng.randint(y + 2, max(y + 3, y + alto_fila - 2))
                d.point((px, py), fill=jitter(rng, base, 0.55, 1.5))
            x += w
        y += alto_fila
    return img


def losetas(rng, base):
    """Baldosas/placas regulares con perspectiva (oficina, tejado, nave, salas)."""
    img = Image.new("RGB", (ANCHO, ALTO), jitter(rng, base, 0.45, 0.45))
    d = ImageDraw.Draw(img)
    y, fila = 0, 0
    while y < ALTO:
        f = y / ALTO
        H = int(22 + 18 * f)
        W = int(40 + 26 * f)
        off = (fila % 2) * (W // 2)
        for fx in range(-W, ANCHO, W):
            x = fx + off
            d.rectangle([x + 1, y + 1, x + W - 1, y + H - 1], fill=jitter(rng, base, 0.85, 1.15))
            d.line([x + 1, y + 1, x + W - 1, y + 1], fill=jitter(rng, base, 1.3, 1.45))
            if rng.random() < 0.3:
                d.point((rng.randint(x + 3, x + W - 3), rng.randint(y + 3, y + H - 3)), fill=jitter(rng, base, 0.5, 1.6))
        y += H
        fila += 1
    return img


def tablones(rng, base):
    """Tablones de madera claros (el dojo)."""
    img = Image.new("RGB", (ANCHO, ALTO), base)
    d = ImageDraw.Draw(img)
    y = 0
    while y < ALTO:
        alto_fila = rng.randint(14, 18)
        d.line([0, y, ANCHO, y], fill=jitter(rng, base, 0.72, 0.78))
        x = -rng.randint(0, 80)
        while x < ANCHO:
            w = rng.randint(90, 200)
            d.line([x + w, y + 2, x + w, y + alto_fila - 2], fill=jitter(rng, base, 0.7, 0.8))
            for _ in range(2):
                vy = y + rng.randint(3, max(4, alto_fila - 3))
                vx = rng.randint(max(0, x), min(ANCHO, x + w))
                d.line([vx, vy, min(vx + rng.randint(10, 40), x + w - 2), vy], fill=jitter(rng, base, 0.86, 0.93))
            x += w
        y += alto_fila
    return img


def alfombra(rng, base):
    """Moqueta con trama y cenefa de rombos (apartamento, hotel)."""
    img = Image.new("RGB", (ANCHO, ALTO), base)
    d = ImageDraw.Draw(img)
    for y in range(0, ALTO, 3):
        d.line([0, y, ANCHO, y], fill=jitter(rng, base, 0.88, 0.92))
    for _ in range(ANCHO * ALTO // 55):
        d.point((rng.randint(0, ANCHO - 1), rng.randint(0, ALTO - 1)), fill=jitter(rng, base, 0.7, 1.35))
    for fy in range(20, ALTO, 64):
        for fx in range(0, ANCHO, 32):
            c = jitter(rng, base, 1.3, 1.4)
            d.line([fx, fy + 4, fx + 4, fy], fill=c)
            d.line([fx + 4, fy, fx + 8, fy + 4], fill=c)
            d.line([fx + 8, fy + 4, fx + 4, fy + 8], fill=c)
            d.line([fx + 4, fy + 8, fx, fy + 4], fill=c)
    return img


def arena(rng, base):
    """Arena del desierto: ruido + ondulaciones."""
    img = Image.new("RGB", (ANCHO, ALTO), base)
    d = ImageDraw.Draw(img)
    for _ in range(ANCHO * ALTO // 30):
        d.point((rng.randint(0, ANCHO - 1), rng.randint(0, ALTO - 1)), fill=jitter(rng, base, 0.8, 1.2))
    for fy in range(12, ALTO, 26):
        fase = rng.uniform(0, 6.28)
        pts = [(x, fy + int(4 * math.sin(x / 55 + fase))) for x in range(0, ANCHO, 6)]
        d.line(pts, fill=jitter(rng, base, 0.72, 0.78))
        d.line([(x, y + 1) for (x, y) in pts], fill=jitter(rng, base, 1.15, 1.25))
    return img


# Paletas: derivadas del muestreo PIL del suelo pintado real de cada fondo,
# subidas de brillo para que la textura sea visible sobre el negro del canvas.
ESTILOS = {
    "01-ciudad-digital":     (adoquin,  (16, 42, 18)),
    "02-pasillo-oficina":    (losetas,  (42, 52, 40)),
    "03-sala-entrenamiento": (tablones, (222, 214, 196)),
    "04-tejado-lluvia":      (losetas,  (14, 46, 42)),
    "05-cabina-telefonica":  (adoquin,  (26, 36, 26)),
    "06-apartamento-rojo":   (alfombra, (74, 16, 13)),
    "07-desierto-maquinas":  (arena,    (126, 90, 52)),
    "08-nave-subterranea":   (losetas,  (36, 40, 36)),
    "09-sala-pantallas":     (losetas,  (20, 34, 20)),
    "10-corredor-hotel":     (alfombra, (60, 32, 8)),
}

if __name__ == "__main__":
    for nombre, (estilo, base) in ESTILOS.items():
        rng = random.Random(nombre)
        estilo(rng, base).save(f"public/fondos/piso-{nombre}.png")
        print(f"piso-{nombre}.png OK")
