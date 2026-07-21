# Niveles y fondos — Wake Up, Dev

Diseño de los 10 niveles del juego (concepto, ambientación y fondo pixel-art) y
cómo se integran técnicamente. Fase **F13** (fondos de escena).

## Idea

Cada módulo del máster es un "nivel" de un side-scroller estilo beat-em-up
ambientado en Matrix. Hasta F12 el decorado era **procedural** (grillas y
columnas dibujadas con primitivas de Kaplay, una identidad de color por
módulo). F13 lo reemplaza por **fondos pixel-art de escena** que le dan a cada
nivel una identidad visual real y refuerzan la narrativa (entrar a la Matrix →
despertar → llegar al mundo real).

## Integración técnica

- **Backdrop fijo a pantalla** (`k.fixed()`), no scrollea con la cámara: un solo
  "cuarto" atmosférico detrás del combate. Los personajes y el carril de avance
  scrollean por encima; el fondo queda quieto (parallax infinito, patrón clásico
  de arcade).
- **Por qué fijo y no tileado/parallax**: el nivel mide ~2500px de ancho pero los
  fondos son escenas de una pantalla (960×640). Tilearlos a lo ancho mostraría
  costuras y rompería los que tienen perspectiva de punto de fuga central (el
  pasillo, el corredor del hotel "entran" a la pantalla, no se repiten de lado).
  El backdrop fijo muestra cada escena entera, sin costuras, y esquiva ese
  problema. Parallax por capas queda como mejora futura (ver Roadmap).
- **Bandas oscuras arriba/abajo**: detrás del HUD y del texto de tutorial. Sin
  ellas, el texto verde de la UI se vuelve **ilegible sobre fondos claros** — la
  sala de entrenamiento (blanca) lo dejó invisible en el primer test. Descubierto
  jugando, no en tests.
- **Data-driven**: `FONDO_POR_MODULO` en `src/game/escenario.ts` mapea módulo →
  fondo. Un módulo sin entrada cae al decorado procedural (degradación limpia,
  el juego nunca queda sin escenario).
- **Pipeline de imágenes**: originales 1536×1024 → `sharp` resize a 960×640
  (mismo ratio 3:2, `lanczos3`) + cuantización a 128 colores PNG. Bajó de
  ~18MB a **1.3MB** los 10 (85–162KB c/u), apto para GitHub Pages. Los fondos
  viven en `public/fondos/` y se cargan al iniciar (`cargarFondos`).

## Los 10 niveles

Estado: **✅ en juego** (mapeado a un módulo y testeado en engine) ·
**🔜 futuro** (procesado y cargado, sin módulo asignado aún).

| # | Nivel | Módulo | Paleta | Estado | Viabilidad |
|---|---|---|---|---|---|
| 1 | La ciudad digital | 01 · Fundamentos | Verde Matrix | ✅ | Excelente. La puerta de entrada a la Matrix; skyline con lluvia de código. |
| 2 | Pasillo de oficina | 02 · Ingeniería | Verde/gris | ✅ | Muy buena. Puertas corporativas idénticas = proceso/burocracia. Composición frontal, funciona plano. |
| 3 | La sala de entrenamiento | 05 · Herramientas | Blanco | ✅ | Buena **con banda oscura**. El "cuarto de carga" con armas en la pared = herramientas. El blanco exige la banda para legibilidad del texto. |
| 4 | Tejado bajo la lluvia | 03 · Arquitectura | Verde azulado | ✅ | Excelente. Vista elevada de la ciudad = mirar el sistema desde arriba (arquitectura). Relámpagos cinematográficos. |
| 5 | Cabina telefónica de escape | — | Verde/neón | 🔜 | Frontal, cabina central iluminada. Viable como backdrop fijo. Candidata a **nivel-portal / salida**. |
| 6 | El apartamento rojo | — | Rojo | 🔜 | "WAKE UP, THE MATRIX HAS YOU" pintado en la pared: candidato ideal para la **intro / pantalla de título**, no un nivel de combate. |
| 7 | El desierto de las máquinas | 09 · Flujo con IA | Naranja | ✅ | Excelente. El **mundo real** postapocalíptico = el nivel más avanzado. Rompe el verde a propósito (saliste de la Matrix). |
| 8 | La nave subterránea | — | Verde/oscuro | 🔜 | Nebuchadnezzar. Frontal, claustrofóbica. Viable. Candidata a **hub / Zion** o nivel de rebeldes. |
| 9 | La sala de pantallas | 04 · Fundamentos de IA | Verde | ✅ | Excelente. Muro de monitores con código y una red neuronal = IA. Encaje temático perfecto. |
| 10 | El corredor del hotel | — | Ámbar | 🔜 | Perspectiva de punto de fuga fuerte: funciona como backdrop **fijo** (estás en el corredor), no tileado. Candidata a **transición / jefe**. |

### Mapeo actual módulo → fondo

```
01-fundamentos       → 01-ciudad-digital
02-ingenieria        → 02-pasillo-oficina
03-arquitectura      → 04-tejado-lluvia
04-fundamentos-ia    → 09-sala-pantallas
05-herramientas      → 03-sala-entrenamiento
09-flujo-desarrollo-ia → 07-desierto-maquinas
```

Es una decisión de diseño abierta: el criterio fue temático (ver columna
"Viabilidad"), pero cualquier módulo puede reasignarse cambiando una línea en
`FONDO_POR_MODULO`.

## Roadmap (a futuro)

Ideas conversadas, **no** implementadas todavía:

1. **Caminos limitados / colisiones de entorno**: hoy Neo se mueve libre por un
   pasillo abierto. La idea es que el fondo condicione la trayectoria — chocar
   contra una pared o un elemento y tener que rodearlo, subir una escalera (la
   nave y la sala de pantallas tienen escaleras/desniveles pintados), etc. Esto
   implica agregar `k.area()` a piezas de decorado (hoy el decorado es 100%
   visual, sin colisión) y lógica de pathing — cambio de alcance grande, requiere
   su propia fase.
2. **Parallax por capas**: separar cielo / edificios lejanos / primer plano en
   capas que scrolleen a distinta velocidad, para dar profundidad al backdrop hoy
   fijo. Requeriría re-generar los fondos separados en capas.
3. **Niveles narrativos sin combate**: usar el apartamento rojo (#6) como intro
   jugable ("despertar"), la cabina (#5) como salida de la Matrix, el corredor
   del hotel (#10) como transición a un jefe.
4. **Más módulos = más niveles**: al agregar bancos de contenido nuevos, hay 4
   fondos ya procesados y cargados listos para asignar.

## Verificación

Los 6 niveles mapeados se testearon **en engine** (Playwright, swiftshader) —
capturas con personajes, HUD y combate sobre cada fondo. La sala de
entrenamiento blanca reveló el problema de legibilidad que motivó las bandas
oscuras; el resto funcionó al primer intento. Ver el registro de F13 en el
handoff de la bóveda.
