# Instrucciones para agentes — tests/

> Raíz: [AGENTS.md](../AGENTS.md)

## Propósito

Tests Vitest del dominio, adapters de IA y validación de bancos de contenido. **205 tests**, cero llamadas reales a APIs.

## Reglas de tests

- Adapters de IA: testear con `fetch` mockeado/inyectado por constructor.
- Dominio: instanciar directamente, sin mocks de Kaplay ni del DOM.
- `tests/banco-contenido.test.ts` es un gate de CI que valida todos los JSONs de `src/content/retos/*.json`.
- Ningún test debe hacer llamadas reales a APIs externas.

## Verificación en preview (antes de commitear gameplay)

Levantar el servidor:

```bash
npx vite preview --port 5175 --strictPort
# o si existe en la sesión: preview_start con el launch.json de la bóveda (puerto 5175, --strictPort)
```

**Antes de asumir que se puede verificar sola**: chequear si la sesión tiene herramientas de automatización de browser (Playwright MCP, `Claude_Preview`/`preview_*`). No todas las sesiones las tienen — si no hay, pedir al humano que juegue el preview antes de commitear features de gameplay grandes.

### Instalar Playwright en el momento (si no está)

```bash
# En ~/.cursor/mcp.json (global, no toca el repo):
# {"playwright": {"command": "npx", "args": ["-y", "@playwright/mcp@latest"]}}
npx playwright install chromium
```
Confirmar con `GetMcpTools` que el server queda `ready` (aparece como `user-playwright`).

Si se necesita usar Playwright por Node directamente (sin MCP), instalar como dep local en un dir temporal: `npm i playwright` + `npx playwright install chromium` en ese dir, e importar desde allí; correr el script con cwd donde esté ese `node_modules`.

### Gotchas de verificación

- **Playwright real vs `dispatchEvent` sintético**: `browser_press_key` es un evento real de página (llega a listeners en `window` sin despachar a 4 targets). Para movimiento sostenido usar `page.keyboard.down/up` (~350ms), no un `press_key` (hace down+up casi instantáneo). Con Playwright instalado, `browser_navigate`/`browser_press_key`/`browser_take_screenshot` permiten jugar el juego sin depender del humano.
- **Canvas de Kaplay**: sin árbol de accesibilidad → screenshot es la única forma de ver el estado real (no `browser_snapshot`/`preview_snapshot`, que sirven para overlays DOM). Para inputs DOM usar `preview_fill`/`preview_click` (Claude_Preview) o `browser_fill`/`browser_click` (Playwright).
- **`preview_console_logs` acumula errores viejos** — contrastar con la pantalla actual; un error puede ser de antes del reload.
- **`"message channel closed"`** = extensión del browser, no del juego. Ignorar.
- **`Claude_Browser` (background tab) no sirve para este juego**: `requestAnimationFrame` nunca dispara (Kaplay congelado), screenshots hacen timeout. Usar Playwright con flags SwiftShader: `chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })`.
- **Playthrough determinístico**: el mazo se baraja con `Math.random`. Truco: `console.debug` temporal con `reto.correcta + 1` en `encuentroMultipleChoice` (level.ts) + `page.on("console")` para responder siempre bien. **Quitar el log antes de commitear.**
- **Al cerrar overlay DOM → devolver foco al canvas**: `cerrarOverlay()` ya lo hace; si el foco queda en `<body>` tras el overlay, todo el teclado del juego muere hasta clickear el canvas a mano.
