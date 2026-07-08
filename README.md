# Wake Up, Dev 🕶️💊

> Videojuego web 8-bit inspirado en Matrix que repasa, de forma jugable, el contenido del **Máster en Desarrollo con IA** — con actualizaciones bonus al 2026 y una IA integrada en el propio gameplay.
>
> **Trabajo de Fin de Máster (TFM)** · Entrega: 24/08/2026

## Descripción general

Sos Neo. Cada módulo del máster es un nivel de la Matrix custodiado por Agentes Smith (bugs, antipatrones, deuda técnica). Para liberarte tenés que responder retos generados a partir del contenido real del curso. El Oráculo — un NPC potenciado por IA — responde tus dudas sobre el módulo en el que estás.

El proyecto demuestra el máster en dos planos:

1. **Como producto**: arquitectura limpia, dominio testeado, CI/CD, contenido data-driven y una capa de IA con múltiples proveedores.
2. **Como proceso**: desarrollado íntegramente con un flujo asistido por IA (documentado en este README).

## Stack tecnológico

- **TypeScript** + **Vite** — build y dev server.
- **Kaplay** — motor 2D estilo retro sobre canvas.
- **Vitest** — tests del dominio.
- **GitHub Actions** — CI (typecheck + tests + build).
- **Capa IA** (`src/ai`): interfaz `AIProvider` con adapters BYOK (Anthropic/OpenAI/Gemini), bridge local de Claude Code headless y fallback estático sin IA.

## Instalación y ejecución

```bash
npm install
npm run dev       # abre http://localhost:5173
```

Otros comandos:

```bash
npm test          # tests del dominio (Vitest)
npm run check     # typecheck (tsc --noEmit)
npm run build     # build de producción en dist/
```

No requiere API keys: sin IA configurada, el juego funciona completo con el banco de retos estático.

## Estructura del proyecto

```
src/
├── domain/     # Dominio puro y testeado: retos, quiz engine, sesión de juego
├── content/    # Banco de retos JSON (data-driven: agregar módulo = agregar JSON)
├── ai/         # Capa IA: interfaz AIProvider + adapters (BYOK, headless, fallback)
└── game/       # Presentación: Kaplay, escenas (title, zion, level, gameover)
tests/          # Tests del dominio
```

## Funcionalidades principales

- ✅ Quiz-adventure 8-bit: movimiento, encuentros con Agentes, vidas y score.
- ✅ Banco de retos data-driven con retos **bonus 2026** (actualizaciones del contenido del máster).
- ✅ Fallback estático: jugable al 100% sin ninguna API key.
- 🚧 El Oráculo: NPC conversacional con IA (BYOK Anthropic/OpenAI/Gemini).
- 🚧 Evaluación de respuestas abiertas con rúbrica (IA como grader).
- 🚧 Modo "píldora roja": bridge local que conecta el juego con instancias headless de Claude Code.
- 🚧 Agente Smith adaptativo: variantes y pistas generadas según tu desempeño.

## Entregables TFM

- 📄 Documentación: este README.
- 🌐 Deploy: _pendiente (URL aquí)_.
- 📊 Slides: _pendiente (URL aquí)_.
- 🎥 Vídeo: _pendiente (URL aquí)_.
- 🔑 Login: no aplica — el juego no tiene autenticación.

## Proceso de desarrollo con IA

_Sección en construcción: aquí se documenta el flujo de desarrollo asistido por IA usado para construir el juego (planificación, generación del banco de retos desde las notas del curso, orquestación de agentes y verificación)._
