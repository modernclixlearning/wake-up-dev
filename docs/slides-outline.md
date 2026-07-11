# Outline de las slides TFM (10-12 diapositivas)

Estética sugerida: negro + verde fósforo (la del juego). Generables con el pipeline de presentaciones o Canva/Google Slides.

1. **Portada** — Wake Up, Dev 🕶️💊 · TFM Máster en Desarrollo con IA · nombre · URLs (juego, repo).
2. **La idea** — Un juego 8-bit que repasa el máster: cada módulo un nivel, cada Agente Smith un reto. La IA no es solo herramienta de desarrollo: es parte del gameplay.
3. **Demo** — Screenshot del nivel + QR a la URL pública.
4. **Arquitectura** — Diagrama: domain (puro, testeado) ← game (Kaplay) → ai (AIProvider) → adapters (Anthropic/OpenAI/Gemini/headless/fallback) + content (JSON data-driven).
5. **Contenido data-driven** — Pipeline notas→JSON con gate de tests en CI; ~174 retos, 6 módulos, bonus 2026; agregar módulo = agregar JSON.
6. **La IA como gameplay** — El Oráculo (contexto por módulo) · evaluación de abiertas con rúbrica · Smith adaptativo (dificultad + pistas).
6.5. **Combate arcade 90s** — Personajes y escenarios 100% procedurales (sin sprites externos); esquive "bullet time" + Agentes con HP + Jefe de nivel — el guiño a la película de acción detrás de Matrix.
7. **La píldora roja** — Bridge local → instancias headless de Claude Code (`claude -p`); diagrama juego→bridge→CLI; el patrón de orquestación del máster hecho visible.
8. **BYOK y seguridad** — Keys solo en localStorage, llamadas directas al proveedor, sin backend, fallback estático siempre jugable.
9. **Calidad** — 66 tests (dominio + adapters mockeados + invariantes de contenido), typecheck, CI+CD a GitHub Pages.
10. **Proceso con IA** — Desarrollo por waves autónomas: el agente implementa, verifica en browser real y commitea; el humano revisa y dirige. Bugs reales encontrados por la verificación del agente.
11. **Módulos del máster aplicados** — 6 niveles ya jugables (fundamentos, ingeniería, arquitectura, fundamentos de IA, herramientas, flujo de desarrollo con IA); calidad (10), infra/CI (11), seguridad (12) y proyectos (13) quedan para cuando el alumno complete esas notas.
12. **Cierre** — Qué aprendí + roadmap (más módulos, más mecánicas) + gracias/QRs.
