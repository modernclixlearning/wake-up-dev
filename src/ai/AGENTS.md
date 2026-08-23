# Instrucciones para agentes — src/ai/

> Raíz: [AGENTS.md](../../AGENTS.md)

## Propósito

Capa de IA: interfaz `AIProvider`, adapters (Anthropic, OpenAI, Gemini, bridge headless, static-fallback), `factory`, `prompts` compartidos y configuración BYOK.

## Reglas de diseño

- **BYOK obligatorio**: las API keys son del jugador (se guardan en `localStorage`). Nunca commitear keys ni montar backend con keys propias.
- **Degradación siempre**: ante cualquier error de IA, degradar sin penalizar al jugador (retos abiertos caen a variante multiple-choice con `StaticFallback`).
- **El juego siempre funciona sin IA**: `StaticFallback` es el adapter de último recurso y debe cubrir todos los flujos.

## Gotchas técnicos (costaron bugs reales)

- **`window.fetch` pierde el binding** si se pasa como propiedad/parámetro → `TypeError: Illegal invocation`. Wrappear con arrow function: `(...args) => fetch(...args)`. Mantener ese patrón al crear adapters nuevos.
- **`fetch` inyectable por constructor** para poder testear adapters con mocks — preservar en todos los adapters. Ver `tests/ai.test.ts`.
- **Parsear respuestas JSON con tolerancia**: `parsearEvaluacion` extrae el primer `{...}` del texto; ante error de parseo, degradar sin penalizar.
- **Bridge headless**: pasar el prompt por **stdin** (nunca como argumento de shell — riesgo de inyección). El bridge escucha solo en `127.0.0.1`.

## Tests

Los adapters se testean en `tests/ai.test.ts` con `fetch` mockeado/inyectado (cero llamadas reales en CI).  
Al agregar un adapter nuevo: agregar sus tests antes de integrarlo en la factory.
