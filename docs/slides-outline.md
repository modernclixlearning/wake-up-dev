# Outline de las slides TFM (10-12 diapositivas)

Estética sugerida: negro + verde fósforo (la del juego). Generables con el pipeline de presentaciones o Canva/Google Slides.

1. **Portada** — Wake Up, Dev 🕶️💊 · TFM Máster en Desarrollo con IA · nombre · URLs (juego, repo).
2. **La idea** — Un juego 8-bit que repasa el máster: cada módulo un nivel, cada Agente Smith un reto. La IA no es solo herramienta de desarrollo: es parte del gameplay.
3. **Demo** — Screenshot del nivel + QR a la URL pública.
4. **Arquitectura** — Diagrama: domain (puro, testeado) ← game (Kaplay) → ai (AIProvider) → adapters (Anthropic/OpenAI/Gemini/headless/fallback) + content (JSON data-driven).
5. **Contenido data-driven** — Pipeline notas→JSON con gate de tests en CI; 74 retos, 3 módulos, bonus 2026; agregar módulo = agregar JSON.
6. **La IA como gameplay** — El Oráculo (contexto por módulo) · evaluación de abiertas con rúbrica · Smith adaptativo (dificultad + pistas).
7. **La píldora roja** — Bridge local → instancias headless de Claude Code (`claude -p`); diagrama juego→bridge→CLI; el patrón de orquestación del máster hecho visible.
8. **BYOK y seguridad** — Keys solo en localStorage, llamadas directas al proveedor, sin backend, fallback estático siempre jugable.
9. **Calidad** — 51 tests (dominio + adapters mockeados + invariantes de contenido), typecheck, CI+CD a GitHub Pages.
10. **Proceso con IA** — Desarrollo por waves autónomas: el agente implementa, verifica en browser real y commitea; el humano revisa y dirige. Bugs reales encontrados por la verificación del agente.
11. **Módulos del máster aplicados** — Mapa: arquitectura (3), flujo con IA (9), calidad (10), infra/CI (11), seguridad (12), proyectos (13).
12. **Cierre** — Qué aprendí + roadmap (más módulos, más mecánicas) + gracias/QRs.
