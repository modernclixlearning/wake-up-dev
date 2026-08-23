# Música del juego

El juego busca las pistas por estos nombres exactos, en esta carpeta:

| Archivo | Dónde suena | Origen |
|---|---|---|
| `musica-menu.mp3` | Pantalla de título y Zion (hub) — no se reinicia al pasar de una a otra | Suno |
| `musica-nivel.mp3` | Fallback de nivel: suena en los módulos sin pista propia | Suno |
| `musica-gameover.mp3` | Pantalla de derrota | Fesliyan Studios |
| `musica-02-pasillo-oficina.mp3` | Módulo 02 — Ingeniería de Software | Suno |
| `musica-03-tejado-lluvia.mp3` | Módulo 03 — Arquitectura de Software | Suno |
| `musica-04-sala-pantallas.mp3` | Módulo 04 — Fundamentos de la IA | Suno |
| `musica-05-sala-entrenamiento.mp3` | Módulo 05 — Herramientas | Suno |
| `musica-06-desierto-maquinas.mp3` | Módulo 09 — Flujo de Desarrollo con IA | Fesliyan Studios |
| `musica-07-nave-subterranea.mp3` | Módulo 10 — Calidad | Fesliyan Studios |
| `musica-08-cabina-telefonica.mp3` | Módulo 11 — Infraestructura y Cloud | Fesliyan Studios |
| `musica-09-corredor-hotel.mp3` | Módulo 12 — Seguridad | Fesliyan Studios |
| `musica-10-apartamento-rojo.mp3` | Módulo 13 — Desarrollo potenciado por IA | Fesliyan Studios |

El mapa módulo → pista vive en `MUSICA_POR_MODULO` (`src/game/audio.ts`).
El módulo 01 (Fundamentos) todavía no tiene tema propio y cae al fallback.

Reglas:

- **Si un archivo falta, el juego sigue sin romperse** (misma invariante que la
  capa IA: los recursos opcionales degradan, nunca bloquean). Un módulo sin
  entrada en el mapa suena con `musica-nivel.mp3`.
- Agregar un tema nuevo = dejar el MP3 acá y añadir su línea al mapa.
- Los efectos de sonido NO viven acá: son chiptunes sintetizados con WebAudio
  en `src/game/audio.ts` (sin assets).
- `M` mutea/desmutea todo (se persiste en localStorage).
- Créditos y licencias de las pistas: ver la sección "Créditos" del README raíz.
