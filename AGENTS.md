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

- Levantar server: `preview_start` con el launch.json de la bóveda (puerto 5175, `--strictPort`).
- Simular teclado: despachar a los 4 targets (ver arriba). Para inputs DOM usar `preview_fill`/`preview_click`; para el estado de overlays, `preview_snapshot` (árbol de accesibilidad) es más fiable que screenshots.
- Los errores viejos quedan acumulados en `preview_console_logs` — un error puede ser de antes del reload; contrastar con la pantalla actual.
- Error de consola `"message channel closed"` = extensión del browser, no es del juego.

## Estado y pendientes

El estado por fases (F1–F10), los pendientes del TFM y el prompt de handoff completo están en la bóveda: `notas\16-proyecto-final\00-proyecto-final\handoff-prompt.md`. Los entregables en preparación viven en [docs/](docs/) (guión del vídeo, outline de slides).
