# Pipeline de arte pixel (F11 v3 — personajes desde referencia)

Convierte una imagen de referencia (alta resolución, estilo 8-bit pero no
pixel art real — ej. generada con Nano Banana en Google AI Studio) en un
sprite de baja resolución real, con paleta acotada, listo para Kaplay.

## Flujo

1. Guardar la referencia en `docs/character-refs/<personaje>-<frame>.png`.
2. Reducir a la resolución objetivo:

   ```bash
   npm run pixel:reducir -- docs/character-refs/neo-idle.png 32 40 tools/pixel-art/salida/neo-idle
   ```

   Genera `neo-idle.png` (sprite final), `neo-idle-preview.png` (x12, para
   verlo cómodo) y `neo-idle.pixelmap.txt` (grid en texto + leyenda de
   colores).

3. Mirar el preview. Si algo no se lee bien (silueta rota, color pegado a
   otro), **editar el `.pixelmap.txt` a mano** (cambiar el carácter de una
   celda, o agregar una fila a la leyenda) y volver a renderizar sin tocar
   la imagen original:

   ```bash
   npm run pixel:render -- tools/pixel-art/salida/neo-idle.pixelmap.txt tools/pixel-art/salida/neo-idle
   ```

4. Repetir el paso 3 hasta que el preview quede bien. El `.pixelmap.txt` es
   texto plano — se puede compartir y editar directamente en el chat.

## Notas

- `"."` en el grid es transparente (fondo).
- La paleta se genera automáticamente (k-means simple) a partir de los
  colores opacos de la referencia; el número de colores es el último
  argumento de `pixel:reducir` (default 16).
- El sprite final queda listo para cargarse con `k.loadSprite(nombre, url,
  { sliceX, sliceY, anims })` una vez que tengamos los 5 frames de un
  personaje — ver `src/game/actores.ts` para dónde se conecta.
- **Una referencia por archivo, no un collage con varias poses**: componer
  los 5 frames en una sola imagen (una fila o un grid) obliga a detectar los
  límites de cada personaje por post-proceso (blancos entre columnas o
  componentes conexas) — es frágil: si dos poses se superponen (ej. un puño
  que se estira hacia el frame vecino) o si el espaciado no es uniforme, el
  recorte corta el personaje. Preferir que cada pose llegue en su propio
  archivo (`neo-idle.png`, `neo-walkA.png`, ...) — el `trim()` automático del
  script ya recorta el margen sobrante de cada uno individualmente.
- **Dos frames de caminata casi idénticos = personaje que "se desliza"**: si
  la referencia trae dos zancadas casi iguales (pasó con Smith y el Jefe), la
  animación no se lee como pasos. El ciclo clásico de 2 frames alterna
  **contacto** (zancada) y **paso** (piernas juntas): `npm run pixel:paso --
  <contacto.png> <salida.png> <borrar> <x0> <x1> <zapato> <punta>` genera la
  pose de paso desde el frame de contacto (valores usados: smith `57 23 39 74
  5`, jefe `55 22 42 73 6`). Revisar el `-preview.png` — la geometría se
  ajusta a ojo por personaje. Además `montarSprite` (actores.ts) agrega un
  bob de 1px al ritmo de los pasos que refuerza el pisado.
- **Líneas diagonales finas y largas se pierden al reducir a baja
  resolución**: un objeto delgado (ej. el cañón de un arma cruzada en
  diagonal larga sobre el cuerpo) puede desaparecer casi por completo al
  bajar a 32×40px, porque el resize `nearest` no tiene suficientes muestras
  para capturarlo en una diagonal larga (no es un bug del script, es un
  límite físico de la resolución). Si una pose de referencia depende de un
  detalle así para leerse, pedir la referencia con ese elemento más pegado
  al cuerpo/menos diagonal, o aceptar que la silueta general (postura,
  siluetas de brazos/piernas) es lo que sobrevive a esta resolución.
