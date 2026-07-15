# Guía para agentes — Wake Up, Dev

Videojuego web 8-bit inspirado en Matrix que repasa el contenido del Máster en Desarrollo con IA. Es el **TFM del máster** (entrega: **24/08/2026** — README completo, repo público, deploy con URL, slides y vídeo). El plan maestro y la consigna oficial viven en la bóveda del máster: `C:\apps\Master en Desarrollo con IA\notas\16-proyecto-final\00-proyecto-final\`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server Vite (el jugador humano suele tenerlo en 5173) |
| `npm test` | Vitest — dominio + adapters + validación de bancos (todo mockeado, cero llamadas reales) |
| `npm run check` | `tsc --noEmit` |
| `npm run build` | typecheck + build de producción |
| `npm run bridge` | Bridge headless "píldora roja" (`bridge/server.mjs`, requiere CLI `claude` autenticado) |

Push a `main` dispara **CI** (typecheck+tests+build) y **Deploy** a GitHub Pages (https://modernclixlearning.github.io/wake-up-dev/). Verificar con `gh run list --limit 2` que ambos queden verdes.

## Arquitectura (respetar los límites)

```
src/domain    Dominio PURO y testeado (reto.ts, quiz-engine.ts, session.ts).
              Nunca importa de kaplay, del DOM ni de src/ai.
src/content   Bancos JSON data-driven: agregar un módulo = agregar un JSON (ver Pipeline).
src/ai        Capa IA: interfaz AIProvider + adapters (anthropic/openai/gemini/claude-headless/
              static-fallback) + factory + prompts compartidos + config (localStorage BYOK).
src/game      Presentación: escenas Kaplay (scenes/) y overlays DOM (ui/overlay.ts).
bridge/       Server headless local (Node puro, sin deps) que spawnea `claude -p`.
tests/        Vitest. Los adapters se testean con fetch mockeado/inyectado.
```

Reglas que ya evitaron problemas:

- **El juego SIEMPRE funciona sin IA**: cualquier feature de IA debe degradar al `StaticFallback` (los retos abiertos caen a su variante multiple-choice sin penalizar). No romper esta invariante.
- **El contenido es data, no código**: nada de hardcodear preguntas en escenas. Todo entra por `src/content/retos/*.json` y lo valida `tests/banco-contenido.test.ts` (gate de CI).
- Las API keys son del jugador (BYOK, localStorage). Jamás commitear keys ni montar backends con keys propias.

## Forma de trabajo

1. **Verificar en browser antes de commitear** — no alcanza con tests: levantar el preview y reproducir el escenario exacto de la feature o del bug (esto encontró todos los bugs reales del proyecto). El dev server de preview corre en el **puerto 5175** (el 5173 suele estar ocupado por la sesión `npm run dev` del humano).
2. Tests de dominio y adapters siempre con mocks; ninguna llamada real a APIs en CI.
3. Commits descriptivos en español + `Co-Authored-By: Claude` y push a `main` (CI + Deploy verdes antes de dar por cerrado).
4. Idioma del proyecto: español (código, comentarios, commits, contenido).
5. Los warnings CRLF de git en Windows son ruido — ignorarlos.

## Pipeline de contenido

Documentado en [tools/pipeline-contenido.md](tools/pipeline-contenido.md) (prompt de generación, prefijos por módulo y registro de revisión). Resumen de reglas: retos **reformulados con palabras propias** (nunca copiar literal las notas del máster — tema licencias), distractores plausibles, rúbricas de abiertas **verificables** ("debe mencionar X"), cada banco con `bonus2026` y campo `modulo.resumen` (contexto que se inyecta al Oráculo). **La revisión humana del alumno es obligatoria antes de dar un banco por bueno** — actualizar el registro del pipeline al generar o revisar.

## Aprendizajes técnicos (costaron bugs reales — no re-descubrir)

### Kaplay

- **Nunca usar `[corchetes]` en `k.text()`**: Kaplay los parsea como tags de texto estilado y lanza `Styled text error: unclosed tags` en cada frame (pasó con `[LIBERADO]` en Zion). Usar guiones u otro delimitador.
- **Cancelar los handlers de teclado por encuentro**: `k.onKeyPress()` devuelve un `KEventController`; guardarlos y llamar `.cancel()` al cerrar cada overlay del canvas. Si quedan vivos, el siguiente encuentro dispara los handlers viejos primero y su overlay queda huérfano (el juego se "bloqueaba" en la 2ª pregunta).
- Kaplay **no** escucha las teclas solo en el canvas: para simular teclado en verificaciones hay que despachar `KeyboardEvent` a `canvas + document.body + document + window`.
- **`k.area()` no acepta `{ width, height }` directo** (`AreaCompOpt` solo tiene `shape/scale/offset/cursor/collisionIgnore`): para un actor sin `k.rect()` propio (ver `src/game/actores.ts`) hay que pasar `k.area({ shape: new k.Rect(k.vec2(0, 0), ancho, alto) })`. Sin esto tira error de tipos al no poder inferir la forma.
- **Personajes como grupo de partes**: un actor puede ser un objeto padre con solo `pos` + `area` + tag (sin render propio) y las partes visuales (torso, piernas, cabeza) como hijos con `k.pos` relativo (anchor top-left, igual que el resto del juego); los hijos siguen al padre automáticamente (útil para barras de HP que "flotan" sobre el Agente sin recalcular posición cada frame).
- **Relleno negro sobre fondo negro es invisible**: `main.ts` usa `background: [0,0,0]`; cualquier pieza de silueta pintada en negro (trajes, piernas) se funde con el canvas y "desaparece" salvo por las piezas de color (bug real de F11 v1 — un Agente Smith se veía como dos manchitas sueltas, cabeza+corbata, sin torso ni piernas). Arreglo: `k.outline(1.5, k.rgb(...BLANCO))` en cada pieza de silueta (`src/game/actores.ts`, función `contorno()`). Ojo: `outline()` no soporta `sprite()` ni `text()`, solo shapes (`rect`, `circle`, etc.).
- **Cámara de scroll (`k.setCamPos`) exige `k.fixed()` en TODO lo que sea HUD/overlay**: sin `k.fixed()`, un texto o rect en coordenadas de mundo se va de cuadro apenas la cámara se mueve. `k.fixed()` hace que la posición se interprete en coordenadas de pantalla (0..ANCHO, 0..ALTO) ignorando la transformación de cámara — es el mismo patrón que ya usan los overlays DOM, pero aplicado a objetos Kaplay.
- **Persecución activa (chase AI) + reintento con `k.wait` = riesgo de doble encuentro concurrente**: si un enemigo se mueve hacia el jugador en su propio `onUpdate` cada vez que `!bloqueado()`, y el flujo de "fallo → pausa breve → reintento" también deja `bloqueado()` en `false` durante esa pausa, el enemigo puede volver a colisionar y disparar `onCollide` en carrera con el reintento ya programado — dos overlays de pregunta se crean a la vez y el texto queda superpuesto/ilegible (bug real de F11 v2, encontrado jugando con Playwright). Arreglo: guarda de reentrada al principio de la función que abre el encuentro (`if (enEncuentro) return;` antes de poner `enEncuentro = true`) — cualquier función que pueda dispararse por más de un camino (colisión Y timer) necesita esa guarda.
- **Combate arcade (F12) — el stagger es lo que lo hace justo**: los Smiths telegrafían su golpe (~0.55s en pose de ataque) y pegan si seguís en rango (-1 vida), pero una piña de Neo durante el windup cancela ese ataque (`combate.telegrafia.cancel()`). Sin el stagger, estar en rango de piñas garantizaba comer un golpe cada ~2s aunque pelearas bien (lo demostró el bot de Playwright muriendo con juego perfecto de preguntas). Regla general: en un intercambio cuerpo a cuerpo, la agresión del jugador tiene que poder interrumpir al enemigo.
- **Bot de playthrough: alejarse del Oráculo antes de pelear** — Neo spawnea pegado al Oráculo; el primer movimiento sostenido hacia arriba abre su chat DOM y el bot se queda atrapado ahí toda la corrida (espacios tipeados al input). Bajar+derecha al entrar y chequear cada ciclo `document.querySelector("input, textarea")` para cerrar con ESC si se abrió igual. Para esquivar las balas del Jefe hace falta movimiento vertical **sostenido** (`keyboard.down/up` de ~350ms): con taps cortos, la caja de 96x160 de Neo no sale de la trayectoria y el bot muere a tiros.
- **Scroll-lock ("no retroceder") en un side-scroller sin tilemap es un riesgo de softlock**: si la cámara solo avanza (nunca reduce su límite izquierdo) pero no hay paredes que fuercen al jugador a enfrentar a cada enemigo en orden, es posible esquivarlo caminando por otro carril y quedar con un enemigo vivo detrás del límite de cámara ya cerrado — nivel imposible de terminar. Sin tilemap/paredes (fuera de alcance de F11), la opción más segura es NO bloquear el retroceso: cámara que sigue al jugador en ambas direcciones, clampeada a los bordes del nivel.

### Overlays DOM sobre el canvas

- **No tragarse los `keyup`**: el overlay corta `keydown`/`keypress` (para que el juego no reciba lo tipeado) pero debe dejar pasar los `keyup`. Si se los traga, Kaplay queda con la tecla "pisada" (la flecha con la que llegaste al NPC), y al cerrar el overlay el jugador camina solo de vuelta → loop de reapertura.
- Aún dejando pasar los `keyup`, un evento que burbujea desde un input **no pasa por el canvas** (es un nodo hermano): por eso `cerrarOverlay()` además emite `keyup` sintéticos de las 4 flechas a todos los targets. No quitar esa liberación.
- Al cerrar un overlay de NPC, **alejar al jugador** del NPC para no re-disparar el `onCollide` al instante.

### Capa IA

- **`window.fetch` pierde el binding si se pasa como propiedad/parámetro** (`TypeError: Illegal invocation`): los adapters wrappean con arrow function (`(...args) => fetch(...args)`). Mantener ese patrón al crear adapters nuevos.
- Los adapters aceptan `fetch` inyectable por constructor **para poder testearlos con mocks** — preservarlo.
- Respuestas JSON de modelos: parsear con tolerancia (`parsearEvaluacion` extrae el primer `{...}` del texto) y ante error de IA **degradar sin penalizar al jugador**.
- El bridge headless pasa el prompt a `claude -p` **por stdin** (nunca como argumento de shell — inyección) y escucha solo en `127.0.0.1`.

### Verificación en preview

- Levantar server: `preview_start` con el launch.json de la bóveda (puerto 5175, `--strictPort`), o si esa herramienta no existe en la sesión, `npx vite preview --port 5175 --strictPort` sobre un build ya hecho (`npm run build`).
- **Antes de asumir que se puede verificar sola en browser, chequear con `GetMcpTools` (o el listado de servers de la sesión) si hay herramientas de automatización de browser** (Playwright, Claude_Preview/`preview_*`). No todas las sesiones las tienen (p.ej. una sesión de Cursor sin esos MCP activos) — si no hay, pedirle al humano que juegue el preview y reporte antes de commitear features de gameplay grandes; no commitear a ciegas.
- **Si no hay Playwright en la sesión, se puede instalar en el momento**: agregar a `~/.cursor/mcp.json` (global, no toca el repo) `{"playwright": {"command": "npx", "args": ["-y", "@playwright/mcp@latest"]}}` y correr `npx playwright install chromium` una vez para bajar el binario. Cursor lo detecta sin reiniciar — confirmar con `GetMcpTools` que el server (aparece como `user-playwright`) queda `ready` antes de usarlo. Con eso, herramientas como `browser_navigate`/`browser_press_key`/`browser_take_screenshot` permiten jugar el juego solo/a, sin depender de que el humano reporte.
- Simular teclado con Playwright real (`browser_press_key`) no tiene el problema de "solo escucha en el canvas" — es un evento de teclado real a nivel de página, no un `dispatchEvent` sintético, así que llega a los listeners en `window` sin despachar a los 4 targets a mano (eso solo hace falta si se simula con `dispatchEvent` manual). Para mantener una tecla apretada (movimiento sostenido) hace falta `page.keyboard.down/up` vía código Playwright, no un solo `browser_press_key` (que hace down+up casi instantáneo).
- Para inputs DOM usar `preview_fill`/`preview_click` (Claude_Preview) o `browser_fill`/`browser_click` (Playwright); para el estado de overlays, un snapshot de accesibilidad (`preview_snapshot`/`browser_snapshot`) es más fiable que screenshots, pero para un juego Kaplay (todo en un `<canvas>`, sin árbol de accesibilidad) el screenshot es la única forma de ver el estado real.
- Los errores viejos quedan acumulados en `preview_console_logs` — un error puede ser de antes del reload; contrastar con la pantalla actual.
- Error de consola `"message channel closed"` = extensión del browser, no es del juego.
- **El Browser pane de Claude Code (mcp `Claude_Browser`) no sirve para este juego en sesiones sin UI visible**: el tab queda en background, `requestAnimationFrame` nunca dispara (Kaplay congelado) y los screenshots del pane hacen timeout. Alternativa que funciona: script de Playwright por Node (`chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })`) — sin esos flags el WebGL headless renderiza screenshots negros. Instalar `playwright` como dep local en un dir temporal (`npm i playwright` + `npx playwright install chromium`) e importarlo desde ahí; correr el script con cwd donde esté ese node_modules.
- **Playthrough determinístico para verificación**: el mazo se baraja con `Math.random` (no se puede precalcular respuestas). Truco: `console.debug` temporal con `reto.correcta + 1` en `encuentroMultipleChoice` (level.ts) + `page.on("console")` en el script de Playwright para responder siempre bien — permite jugar el nivel completo (4 Smith + Jefe) sin perder vidas. **Quitar el log antes de commitear.**
- **Al cerrar un overlay DOM hay que devolver el foco al canvas** (`cerrarOverlay()` en overlay.ts ya lo hace): Kaplay escucha el teclado en el canvas; si el foco queda en `<body>` tras remover el overlay, TODO el teclado del juego muere hasta clickear el canvas a mano. Bug pre-existente encontrado con el tour automatizado de F11 v3.

## Estado y pendientes

El estado por fases (F1–F11), los pendientes del TFM y el prompt de handoff completo están en la bóveda: `notas\16-proyecto-final\00-proyecto-final\handoff-prompt.md`. Los entregables en preparación viven en [docs/](docs/) (guión del vídeo, outline de slides).
