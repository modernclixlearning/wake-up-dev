# Guión del vídeo TFM (captura de pantalla obligatoria, rostro opcional)

Duración objetivo: **5–8 minutos**. Grabá la pantalla (OBS, Loom o similar) siguiendo este recorrido. Los tiempos son orientativos.

## 1. Apertura (30s)

- Pantalla: título del juego corriendo en la URL pública.
- Decir: qué es (juego 8-bit que repasa el máster, inspirado en Matrix), por qué lo elegiste (demostrar el máster como producto Y como proceso), y el stack en una frase (TypeScript, Vite, Kaplay, capa de IA multi-proveedor).

## 2. Demo del loop de juego (90s)

- ENTER → Zion: mostrar los 10 módulos y el estado de IA.
- Entrar a Fundamentos: moverse (silueta animada de Neo), tocar un Agente, mostrar el esquive "bullet time" (esquivar la bala con la flecha correcta), responder bien (golpe al Agente, baja su barra de HP) y responder mal (vida perdida + explicación didáctica).
- Pelear hasta derrotar a un Agente normal (2 golpes) y mostrar el Jefe de nivel al limpiar el módulo.
- Mencionar: 312 retos generados desde tus notas reales del curso, 26 de ellos marcados «estado del arte 2026» (conceptos en la frontera del oficio, y valen más puntos), y que cada módulo tiene su propio escenario pixel-art.

## 3. La IA como gameplay (2 min)

- Zion → tecla A: mostrar los ajustes BYOK (elegir proveedor, key en localStorage, sin backend).
- Con IA conectada: tocar el Oráculo, hacer una pregunta real del módulo, mostrar la respuesta con contexto.
- Reto abierto: escribir una respuesta y mostrar la calificación con feedback (grader con rúbrica).
- Fallar 2 veces a propósito → mostrar la pista adaptativa (tecla P).

## 4. La píldora roja (90s) — el diferencial

- Terminal: `npm run bridge` → mostrar el log del bridge.
- Ajustes → Claude Code headless → preguntarle algo al Oráculo.
- Explicar mientras responde: cada consulta lanza una instancia headless de `claude -p` orquestada por un proceso local — el mismo patrón de agentes del módulo 9/13 del máster, visible dentro del juego.

## 5. Ingeniería detrás (90s)

- VS Code: estructura del proyecto (dominio puro / contenido JSON / capa ai / game).
- Mostrar: los 112 tests corriendo (`npm test`), el pipeline de contenido (tools/pipeline-contenido.md) y el CI+deploy en GitHub Actions.
- Mencionar: arquitectura limpia (el dominio no conoce Kaplay ni a los providers), fallback estático (funciona sin IA), gate de contenido en CI.

## 6. Proceso con IA + cierre (60s)

- README §6: contar el desarrollo por waves autónomas con verificación en browser y revisión humana.
- Cierre: qué aprendiste y qué seguiría (más módulos = solo agregar JSON).

## Checklist antes de grabar

- [ ] `localStorage` limpio para que se vea el flujo desde cero.
- [ ] Bridge apagado al inicio (se enciende en la sección 4).
- [ ] Una API key válida a mano (sección 3).
- [ ] Zoom del browser al 100%, resolución 1080p.

---

## 7. Antes de grabar (checklist)

- [ ] Cerrar todo lo que no sea el juego y el editor del repo del juego: nada de la bóveda,
      de proyectos de trabajo, de Telegram, del dashboard ni de credenciales en pantalla.
- [ ] Notificaciones del sistema en silencio.
- [ ] Partida reiniciada (en Zion, `R` dos veces) para arrancar con las 5 vidas y sin progreso previo.
- [ ] Si vas a mostrar el Oráculo, tener la API key ya pegada en ajustes **antes** de grabar
      (no se teclea una key en cámara).
- [ ] Tener las slides abiertas en otra pestaña: `/wake-up-dev/slides/`.

## 8. Cifras al día (2026-08-22)

Verificadas contra el repo, no de memoria. Si volvés a grabar más adelante, recontalas.

| Dato | Valor |
|---|---|
| Niveles jugables | 10 |
| Retos | 312 (287 de opción múltiple + 25 abiertas) |
| Retos de estado del arte 2026 | 26 |
| Tests | 112 |
| Módulos del máster cubiertos | 01, 02, 03, 04, 05, 09, 10, 11, 12, 13 |
