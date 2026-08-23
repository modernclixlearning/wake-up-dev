# Instrucciones para agentes — src/game/

> Raíz: [AGENTS.md](../../AGENTS.md)

## Propósito

Capa de presentación: escenas Kaplay (`scenes/`) y overlays DOM sobre el canvas (`ui/overlay.ts`). Aquí vive todo lo que implica renderizado, física, input de teclado y la cámara.

## Gotchas de Kaplay (costaron bugs reales — no re-descubrir)

- **`[corchetes]` en `k.text()`** → Kaplay los parsea como tags de texto estilado → `Styled text error: unclosed tags` en cada frame (pasó con `[LIBERADO]` en Zion). Usar guiones u otro delimitador.
- **Cancelar handlers de teclado por encuentro**: `k.onKeyPress()` devuelve `KEventController`; guardarlos y llamar `.cancel()` al cerrar cada overlay. Si quedan vivos, el siguiente encuentro dispara los handlers viejos y su overlay queda huérfano.
- **Kaplay no escucha solo en el canvas**: para simular teclado en tests despachar `KeyboardEvent` a `canvas + document.body + document + window`.
- **`k.area()` solo acepta `shape:`** (`AreaCompOpt` solo tiene `shape/scale/offset/cursor/collisionIgnore`, no `{ width, height }`): para un actor sin `k.rect()` propio usar `k.area({ shape: new k.Rect(k.vec2(0, 0), ancho, alto) })`.
- **Personajes como grupo de partes**: padre con `pos` + `area` + tag (sin render), partes visuales como hijos con `k.pos` relativo; siguen al padre automáticamente.
- **Relleno negro sobre fondo negro es invisible**: `main.ts` usa `background: [0,0,0]`; piezas negras de silueta se funden. Solución: `k.outline(1.5, k.rgb(...BLANCO))` en cada pieza (`src/game/actores.ts`, función `contorno()`). `outline()` no soporta `sprite()` ni `text()`, solo shapes (`rect`, `circle`, etc.).
- **`k.setCamPos` exige `k.fixed()` en HUD/overlay**: sin `k.fixed()`, el objeto se va de cuadro cuando la cámara se mueve. `k.fixed()` interpreta la posición en coordenadas de pantalla (0..ANCHO, 0..ALTO).
- **Chase AI + `k.wait` = doble encuentro concurrente**: si el enemigo persigue en `onUpdate` cada vez que `!bloqueado()`, y el flujo "fallo → pausa → reintento" también deja `bloqueado()` en `false` durante la pausa, puede disparar `onCollide` en carrera con el reintento → dos overlays a la vez. Guarda de reentrada: `if (enEncuentro) return;` al inicio de la función que abre el encuentro, antes de poner `enEncuentro = true` — cualquier función que pueda dispararse por más de un camino (colisión Y timer) necesita esa guarda.
- **Combate arcade — el stagger lo hace justo**: los Smiths telegrafían su golpe (~0,55s) y pegan si seguís en rango; una piña de Neo durante el windup cancela ese ataque (`combate.telegrafia.cancel()`). Sin stagger, estar en rango garantiza comer golpes aunque el jugador responda bien.
- **Bot de playthrough: alejarse del Oráculo al entrar** — Neo spawnea pegado al Oráculo; movimiento sostenido hacia arriba abre el chat DOM y el bot queda atrapado. Bajar+derecha al entrar; chequear `document.querySelector("input, textarea")` para cerrar con ESC si se abrió igual. Para esquivar balas del Jefe: `keyboard.down/up` de ~350ms (taps cortos no sacan la caja de 96×160 de la trayectoria).
- **`pos` es la esquina SUPERIOR IZQUIERDA, actores 96×160**:
  - Cartel flotante sobre la cabeza: `actor.pos.y - N`, no `actor.pos.y - ALTO_AGENTE - N` (lo segundo da `y` negativo).
  - Distancia de proximidad: `a.pos.dist(b.pos) < 80` no significa nada con cajas de 160 de alto (esquinas a 80px = actores ya se están tocando). Medir de CENTRO a centro con radio mayor que las cajas.
- **Curva de rectángulos = escalera** salvo que cada segmento cubra el salto hasta el siguiente. Muestrear la curva en `x` y `x + paso` y estirar el rectángulo (`alto = |Δ| + grosor`) para que los tramos se solapen. Paso 8 da diagonal continua.
- **Parallax sin capas de render propias**: contenedor `k.add([k.pos(0,0), k.z(...)])` con los hijos en "espacio de capa" y un `onUpdate` que hace `capa.pos.x = k.getCamPos().x * (1 - factor)` — los hijos quedan en pantalla a `x - camX * factor`, moviéndose a `factor` veces la velocidad del suelo. Sembrar desde un valor NEGATIVO (al principio del nivel el borde izquierdo mira espacio negativo) y hasta `anchoNivel * factor + ANCHO`.
- **Color de acento crudo sobre fondos oscuros es invisible**: un decorado en `VERDE_OSCURO` al 40% sobre la ciudad del módulo 1 es literalmente invisible. Los decorados deben usar el color VIVO del módulo (el mismo que usa el camino), no el acento al 40%.
- **Scroll-lock sin tilemap = riesgo de softlock**: sin paredes que fuercen al jugador a enfrentar cada enemigo en orden, puede esquivar y quedar con un enemigo vivo detrás del límite de cámara ya cerrado. Opción segura: no bloquear el retroceso.

## Gotchas de overlays DOM sobre el canvas

- **No tragarse los `keyup`**: el overlay corta `keydown`/`keypress` pero debe dejar pasar `keyup`. Si los traga, Kaplay queda con la tecla "pisada" y el jugador camina solo al cerrar el overlay.
- **Listener de overlay debe cubrir foco perdido**: si el jugador hace click en un div no focusable del panel, el foco cae en `<body>` y ESC deja de cerrar. Solución: listener a nivel `document` mientras haya overlay activo, que actúe solo sobre teclas cuyo `target` esté FUERA del overlay, y se remueva al cerrar.
- **Al cerrar un overlay, alejar al jugador del NPC** para no re-disparar el `onCollide` al instante. `cerrarOverlay()` en `overlay.ts` ya emite `keyup` sintéticos de las 4 flechas a todos los targets — no quitar esa liberación. Nota: un evento que burbujea desde un `input` **no pasa por el `<canvas>`** (es un nodo hermano, no un padre), por eso hace falta emitir a todos los targets.
- **Al cerrar overlay DOM, devolver el foco al canvas** (`cerrarOverlay()` ya lo hace): Kaplay escucha el teclado en el canvas; si el foco queda en `<body>`, todo el teclado del juego muere hasta clickear el canvas a mano.
