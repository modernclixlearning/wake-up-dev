# Instrucciones para agentes — Wake Up, Dev

Videojuego web 8-bit (TFM, Máster en Desarrollo con IA). Repo **público** — sin rutas locales, claves ni datos personales.

## Stack

TypeScript + Vite · Kaplay (motor 2D canvas) · Vitest · GitHub Actions CI/CD → GitHub Pages

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server Vite (por defecto `:5173`) |
| `npm test` | Vitest — 205 tests, todo mockeado, cero llamadas reales |
| `npm run check` | `tsc --noEmit` |
| `npm run build` | typecheck + build de producción |
| `npm run bridge` | Bridge headless (`bridge/server.mjs`, requiere CLI `claude` autenticado) |

**Gate mínimo antes de commitear:** `npm run check` y `npm test` en verde.  
Push a `main` → CI (typecheck + tests + build) + Deploy a GitHub Pages. Verificar con `gh run list --limit 2`.

## Estructura

```
src/domain/    Dominio PURO: reto.ts, quiz-engine.ts, session.ts, combate.ts…
src/content/   Bancos JSON data-driven (retos/*.json). Agregar módulo = agregar JSON.
src/ai/        Capa IA: AIProvider + adapters + factory + prompts + config BYOK.
src/game/      Presentación: escenas Kaplay (scenes/) + overlays DOM (ui/overlay.ts).
bridge/        Server headless local (Node puro). Spawnea `claude -p`.
tests/         Vitest. Adapters con fetch mockeado/inyectado.
api/           Función edge serverless (oraculo.ts).
tools/         Scripts auxiliares (pixel-art, launcher). Sin agentes activos.
docs/          Entregables del TFM (guión, slides, handoff). No tocar sin indicación explícita.
```

## Reglas de arquitectura (transversales)

- `src/domain/` **nunca** importa de `kaplay`, del DOM ni de `src/ai/` → ver [src/domain/AGENTS.md](src/domain/AGENTS.md).
- El juego **siempre funciona sin IA**: toda feature de IA debe degradar al `StaticFallback`.
- El contenido es **data, no código**: nada de hardcodear preguntas en escenas.
- API keys son del jugador (BYOK, `localStorage`). **Jamás commitear keys**.

## Forma de trabajo

- Idioma del proyecto: **español** (código, comentarios, commits, contenido).
- Commits descriptivos en español + `Co-Authored-By: Claude`.
- Los warnings CRLF de git en Windows son ruido — ignorarlos.
- Verificar en browser antes de commitear features de gameplay (tests no cubren el canvas).

## Índice de AGENTS.md por zona

| Zona | Fichero | Cuándo leerlo |
|---|---|---|
| Dominio puro | [src/domain/AGENTS.md](src/domain/AGENTS.md) | Antes de tocar `src/domain/` |
| Kaplay + overlays | [src/game/AGENTS.md](src/game/AGENTS.md) | Antes de tocar `src/game/` |
| Capa IA | [src/ai/AGENTS.md](src/ai/AGENTS.md) | Antes de tocar `src/ai/` |
| Contenido / bancos | [src/content/AGENTS.md](src/content/AGENTS.md) | Antes de tocar `src/content/` |
| Tests / verificación | [tests/AGENTS.md](tests/AGENTS.md) | Antes de tocar `tests/` o levantar preview |

## Criterio de validación

```bash
npm run check   # 0 errores de tipos
npm test        # 205 tests pasando
```
