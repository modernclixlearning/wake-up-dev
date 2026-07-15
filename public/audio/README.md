# Música del juego

Acá van las pistas de música (hechas con Suno, estilo 8-bit drum and bass).
El juego las busca por estos nombres exactos:

| Archivo | Dónde suena |
|---|---|
| `musica-menu.mp3` | Pantalla de título y Zion (hub de módulos) |
| `musica-nivel.mp3` | Dentro de los niveles (combate) |

Reglas:

- **Si un archivo falta, el juego sigue en silencio sin romperse** (misma
  invariante que la capa IA: los recursos opcionales degradan, nunca bloquean).
- Los efectos de sonido NO viven acá: son chiptunes sintetizados con WebAudio
  en `src/game/audio.ts` (sin assets).
- `M` mutea/desmutea todo (se persiste en localStorage).
- Si hay una sola pista, se puede copiar con los dos nombres.
