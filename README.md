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

Sos Neo. Cada módulo del máster es un nivel de la Matrix custodiado por Agentes Smith (bugs, antipatrones, deuda técnica). Los enfrentás en un **combate arcade** cuerpo a cuerpo y, al aturdirlos, respondés un reto generado desde el contenido real del curso. Cerrás cada módulo con un **Agente Jefe**. El **Oráculo** — un NPC potenciado por IA — responde tus dudas sobre el módulo actual, los **retos abiertos** los califica una IA contra una rúbrica, y el **Smith adaptativo** ajusta la dificultad a tu desempeño y te ofrece pistas cuando venís fallando.

El proyecto demuestra el máster en dos planos:

1. **Como producto**: arquitectura limpia, dominio testeado, CI/CD, contenido data-driven y una capa de IA con múltiples proveedores intercambiables.
2. **Como proceso**: desarrollado íntegramente con un flujo asistido por IA (ver §6).

## 2. Stack tecnológico

- **TypeScript** + **Vite** — build y dev server.
- **Kaplay** — motor 2D estilo retro sobre canvas.
- **Vitest** — **92 tests** del dominio, la capa IA y la validación de los bancos de contenido (adapters testeados con `fetch` mockeado; cero llamadas reales en CI).
- **GitHub Actions** — CI (typecheck + tests + build) y deploy automático a GitHub Pages.
- **@anthropic-ai/sdk** — adapter oficial de Anthropic en el browser (BYOK).
- **Node.js** — bridge headless local (`bridge/server.mjs`, sin dependencias) que spawnea el CLI de **Claude Code** o **GitHub Copilot**.

## 3. Instalación y ejecución

```bash
npm install
npm run dev       # abre http://localhost:5173
```

El juego funciona completo **sin ninguna API key**: sin IA configurada, usa el banco de retos estático. Para sumar el Oráculo, la evaluación de abiertas y las pistas, conectá una IA (§3.2).

### 3.1. Arranque con un doble-click (Windows)

Para jugar con todo listo sin tocar la terminal, hay un lanzador de escritorio: [tools/launcher/wake-up-dev.cmd](tools/launcher/wake-up-dev.cmd). Con un doble-click levanta **el servidor del juego** (Vite en `:5175`), **el Oráculo** (bridge headless en `:8137`) y **abre Chrome** en el juego. Detecta lo que ya esté corriendo para no duplicar procesos. Cerrá las dos ventanas de terminal que deja abiertas cuando termines (eso apaga los servicios).

### 3.2. Conectar una IA (opcional, BYOK)

En Zion pulsá **A** y elegí:

- **Anthropic / OpenAI / Gemini**: pegá tu propia API key (queda solo en el `localStorage` de tu navegador; las llamadas van directo al proveedor, sin backend intermedio).
- **🕶 Claude Code headless** / **🤖 GitHub Copilot headless** (bridge local): sin key. Corré `npm run bridge` en una terminal — cada consulta del juego lanza una instancia headless del CLI (`claude -p` o Copilot), el mismo patrón de orquestación de agentes que enseña el máster (módulos 9 y 13). Un solo bridge sirve ambos motores; se elige en el selector.

> El modo headless funciona jugando en **localhost**. La versión desplegada en GitHub Pages (`https://`) no puede hablar con el bridge local (`http://127.0.0.1`) por la política de _mixed content_ del navegador: ahí usá un proveedor BYOK con API key.

Otros comandos:

```bash
npm test          # tests (Vitest)
npm run check     # typecheck (tsc --noEmit)
npm run build     # build de producción en dist/
npm run bridge    # modo "píldora roja": bridge headless (requiere el CLI claude o copilot autenticado)
```

## 4. Estructura del proyecto

```
src/
├── domain/     # Dominio puro y testeado: retos, quiz engine (adaptativo + barajado), sesión, combate
├── content/    # Bancos de retos JSON, data-driven (generados desde las notas del máster)
├── ai/         # Capa IA: interfaz AIProvider + adapters (Anthropic/OpenAI/Gemini/bridge/fallback) + factory
└── game/       # Presentación: Kaplay, escenas (title, zion, level, gameover), actores, escenario y overlays DOM
bridge/         # Servidor local del modo "píldora roja" (Node puro; spawnea claude -p o Copilot)
public/         # Assets: sprites de personajes, fondos de escena y música
tests/          # Tests de dominio, capa IA y validación de bancos de contenido
tools/
├── pixel-art/  # Pipeline para convertir referencias en sprites/fondos pixel-art
└── launcher/   # Lanzador de escritorio (servidor + Oráculo + navegador)
docs/           # Conceptos de niveles, guión del vídeo y outline de las slides (entregables TFM)
```

Reglas de arquitectura (detalle en [AGENTS.md](AGENTS.md)): el dominio es puro y nunca importa de Kaplay ni del DOM; el contenido es **data** (agregar un módulo = agregar un JSON, validado por un test en CI); y el juego **siempre funciona sin IA** (cualquier feature de IA degrada al fallback estático sin penalizar al jugador).

## 5. Funcionalidades principales

- ✅ **Combate arcade 8-bit** inspirado en la acción de Matrix: personajes con **sprites pixel-art** (Neo, Smith, Jefe, Oráculo) generados con un pipeline propio desde referencias; piñas, esquive con _telegrafía_ del golpe enemigo, barra de HP y un **Agente Jefe** que dispara al cerrar cada módulo.
- ✅ **Fondos de escena por nivel**: 10 backgrounds pixel-art (ciudad digital, pasillo de oficina, sala de entrenamiento, tejado bajo la lluvia, desierto de las máquinas, sala de pantallas…) que le dan identidad visual a cada módulo. Conceptos documentados en [docs/niveles.md](docs/niveles.md).
- ✅ **174 retos** (161 de opción múltiple + 13 abiertas · 16 con actualización **bonus 2026**) en **6 niveles jugables** generados desde las notas reales del máster. Las opciones se **barajan en cada partida** para que no se pueda memorizar la posición de la correcta.
- ✅ **El Oráculo**: NPC conversacional con IA y contexto del módulo actual.
- ✅ **Evaluación de respuestas abiertas** con rúbrica (IA como grader; sin IA caen a su variante de opciones, sin penalizar).
- ✅ **Modo "píldora roja"**: bridge local que resuelve el Oráculo, la evaluación y las pistas lanzando instancias headless de Claude Code o GitHub Copilot.
- ✅ **Agente Smith adaptativo**: la dificultad del próximo reto sigue tu desempeño, y tras 2 fallos podés pedirle una pista generada al Oráculo (tecla **P**).
- ✅ **Persistencia del progreso**: score, vidas y módulos liberados se guardan en `localStorage` (con reinicio manual desde Zion).
- ✅ **Música y efectos** originales (menú y combate).
- ✅ **Fallback estático**: jugable al 100% sin ninguna API key.

## 6. Proceso de desarrollo con IA

Este juego se construyó con el flujo que enseña el propio máster — el developer como arquitecto que especifica, orquesta y valida:

- **Planificación**: plan maestro con fases, riesgos y criterios de éxito, escrito con el agente antes de la primera línea de código.
- **Contenido**: pipeline documentado ([tools/pipeline-contenido.md](tools/pipeline-contenido.md)) — un agente lee las notas markdown del máster y genera los bancos JSON; un test de invariantes en CI actúa como gate de calidad; la revisión final es humana.
- **Implementación por waves autónomas**: cada wave la ejecutó un agente (Claude Code) de punta a punta — código, tests, **verificación en el browser real** (movió al jugador, peleó, respondió retos, abrió overlays) y commit — con revisión humana entre waves.
- **Bugs reales encontrados por verificación**: jugando el preview el agente detectó y corrigió cosas que los tests no ven — handlers de teclado sin cancelar (bloqueo en el 2° encuentro), el parser de tags de Kaplay rompiendo con corchetes, o un banco de contenido con la respuesta correcta siempre en la misma posición.
- **La IA también es gameplay**: los mismos patrones usados para construir (prompts con rúbrica, headless, fallbacks) son features del juego.

## 7. Créditos

Proyecto final del Máster en Desarrollo con IA de MoureDev Pro. Contenido de los retos reformulado con palabras propias a partir de apuntes personales del curso.
