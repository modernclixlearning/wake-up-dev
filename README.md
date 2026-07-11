# Wake Up, Dev 🕶️💊

> Videojuego web 8-bit inspirado en Matrix que repasa, de forma jugable, el contenido del **Máster en Desarrollo con IA** — con actualizaciones bonus al 2026 y una IA integrada en el propio gameplay.
>
> **Trabajo de Fin de Máster (TFM)** · Juan José Mayotte · Entrega: 24/08/2026

| Entregable | Enlace |
|---|---|
| 🎮 Juego desplegado | **https://modernclixlearning.github.io/wake-up-dev/** |
| 📦 Repositorio | https://github.com/modernclixlearning/wake-up-dev |
| 📊 Slides | _pendiente (ver [docs/slides-outline.md](docs/slides-outline.md))_ |
| 🎥 Vídeo | _pendiente (ver [docs/guion-video.md](docs/guion-video.md))_ |
| 🔑 Login | No aplica — el juego no tiene autenticación |

## 1. Descripción general

Sos Neo. Cada módulo del máster es un nivel de la Matrix custodiado por Agentes Smith (bugs, antipatrones, deuda técnica). Para liberarte respondés retos generados desde el contenido real del curso. El **Oráculo** — un NPC potenciado por IA — responde tus dudas sobre el módulo actual, los **retos abiertos** los califica una IA contra una rúbrica, y el **Smith adaptativo** ajusta la dificultad a tu desempeño y te ofrece pistas cuando venís fallando.

El proyecto demuestra el máster en dos planos:

1. **Como producto**: arquitectura limpia, dominio testeado, CI/CD, contenido data-driven y una capa de IA con múltiples proveedores intercambiables.
2. **Como proceso**: desarrollado íntegramente con un flujo asistido por IA (ver §6).

## 2. Stack tecnológico

- **TypeScript** + **Vite** — build y dev server.
- **Kaplay** — motor 2D estilo retro sobre canvas.
- **Vitest** — 66 tests del dominio, la capa IA y la validación de los bancos de contenido (adapters testeados con fetch mockeado).
- **GitHub Actions** — CI (typecheck + tests + build) y deploy automático a GitHub Pages.
- **@anthropic-ai/sdk** — adapter oficial de Anthropic en el browser (BYOK).
- **Node.js** — bridge headless local (`bridge/server.mjs`, sin dependencias).

## 3. Instalación y ejecución

```bash
npm install
npm run dev       # abre http://localhost:5173
```

Otros comandos:

```bash
npm test          # tests (Vitest)
npm run check     # typecheck (tsc --noEmit)
npm run build     # build de producción en dist/
npm run bridge    # modo "píldora roja": bridge headless local (requiere el CLI claude)
```

No requiere API keys: sin IA configurada, el juego funciona completo con el banco de retos estático.

### Conectar una IA (opcional, BYOK)

En Zion pulsá **A** y elegí:

- **Anthropic / OpenAI / Gemini**: pegá tu propia API key (queda solo en el `localStorage` de tu navegador; las llamadas van directo al proveedor, sin backend intermedio).
- **🕶 Claude Code headless (bridge local)**: sin key. Corré `npm run bridge` en una terminal — cada consulta del juego lanza una instancia headless de `claude -p`, el mismo patrón de orquestación de agentes que enseña el máster (módulos 9 y 13).

## 4. Estructura del proyecto

```
src/
├── domain/     # Dominio puro y testeado: retos, quiz engine (con modo adaptativo), sesión
├── content/    # Bancos de retos JSON, data-driven (generados desde las notas del máster)
├── ai/         # Capa IA: interfaz AIProvider + adapters (Anthropic/OpenAI/Gemini/headless/fallback)
└── game/       # Presentación: Kaplay, escenas (title, zion, level, gameover) y overlays DOM
bridge/         # Servidor local del modo "píldora roja" (Node puro, lanza claude -p)
tests/          # Tests de dominio, capa IA y validación de bancos de contenido
tools/          # Pipeline de contenido: notas del máster → banco JSON (documentado)
docs/           # Guión del vídeo y outline de las slides (entregables TFM)
```

## 5. Funcionalidades principales

- ✅ Quiz-adventure 8-bit: movimiento, encuentros con Agentes, vidas, score y portal de salida.
- ✅ 6 niveles jugables (Fundamentos, Ingeniería de Software, Arquitectura, Fundamentos de IA, Herramientas, Flujo de Desarrollo con IA) con **~174 retos** generados desde las notas reales del máster, incluyendo retos **bonus 2026**.
- ✅ Fallback estático: jugable al 100% sin ninguna API key.
- ✅ **El Oráculo**: NPC conversacional con IA y contexto del módulo actual.
- ✅ **Evaluación de respuestas abiertas** con rúbrica (IA como grader; sin IA caen a su variante de opciones, sin penalizar).
- ✅ **Modo "píldora roja"**: bridge local que resuelve el Oráculo, la evaluación y las pistas lanzando instancias headless de Claude Code.
- ✅ **Agente Smith adaptativo**: la dificultad del próximo reto sigue tu desempeño, y tras 2 fallos podés pedirle una pista generada al Oráculo (tecla P).

## 6. Proceso de desarrollo con IA

Este juego se construyó con el flujo que enseña el propio máster — el developer como arquitecto que especifica, orquesta y valida:

- **Planificación**: plan maestro con fases (F1–F10), riesgos y criterios de éxito, escrito con el agente antes de la primera línea de código.
- **Contenido**: pipeline documentado ([tools/pipeline-contenido.md](tools/pipeline-contenido.md)) — un agente lee las notas markdown del máster y genera los bancos JSON; un test de invariantes en CI actúa como gate de calidad; la revisión final es humana.
- **Implementación por waves autónomas**: cada wave la ejecutó un agente (Claude Code) de punta a punta — código, tests, verificación en browser real (movió al jugador, respondió retos, abrió overlays) y commit — con revisión humana entre waves.
- **Bugs reales encontrados por verificación**: el agente detectó y corrigió en el browser bugs como handlers de teclado sin cancelar (bloqueo en el 2° encuentro) y el parser de tags de Kaplay rompiendo con corchetes.
- **La IA también es gameplay**: los mismos patrones usados para construir (prompts con rúbrica, headless, fallbacks) son features del juego.

## 7. Créditos

Proyecto final del [Máster en Desarrollo con IA de MoureDev Pro]. Contenido de los retos reformulado con palabras propias a partir de apuntes personales del curso.
