<!-- FORMATO: sin hard-wrap. Una línea física por párrafo o bullet. Este archivo se pega como prompt y se renderiza como texto plano (dashboard, Telegram): un salto de línea a mitad de frase se ve como un corte. Normalizar con `python tools/reflow-md.py <archivo>` desde la raíz de la bóveda si hace falta. -->

Retomamos **Wake Up, Dev**: un videojuego web 8-bit inspirado en Matrix que repasa el Máster en Desarrollo con IA jugándolo, y que es el Trabajo de Fin de Máster de Juan José Mayotte. Cada módulo del curso es un nivel; los Agentes Smith se pelean a puñetazos y, al aturdirlos, hay que responder un reto sacado de las notas reales del curso. La IA no es solo la herramienta con la que se construyó: es una mecánica del juego (el Oráculo responde dudas, una IA califica las respuestas abiertas contra rúbrica, y hay un modo que lanza instancias headless reales de un CLI).

## Ubicaciones

- Repo del juego: `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\code\wake-up-dev` — repo git independiente y **PÚBLICO**: https://github.com/modernclixlearning/wake-up-dev
- Deploy principal (con Oráculo funcionando sin API key): https://wake-up-dev.vercel.app
- Deploy espejo (BYOK, sin backend): https://modernclixlearning.github.io/wake-up-dev/
- Slides de la defensa: https://wake-up-dev.vercel.app/slides/
- Anexo público sobre el sistema: https://wake-up-dev.vercel.app/second-brain/
- Proyecto en la bóveda: `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\`
- Contexto y reglas anti-filtración: `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\ai-context\project-context.md`
- Reglas de arquitectura y gotchas técnicos: `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\code\wake-up-dev\AGENTS.md` — **leerlo antes de tocar código, tiene la lista de bugs ya pagados**
- Consigna oficial del TFM: `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\curso\notas\16-proyecto-final\00-proyecto-final\consigna-oficial-tfm.md`
- Guion del vídeo (pendiente de grabar): `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\code\wake-up-dev\docs\guion-video.md`
- Informe de revisión de contenido (67 defectos, ya aplicados): `C:\apps\second-brain\01_PROJECTS\master-desarrollo-ia\issues\ISSUE-014-auditoria-multiagente\revision-contenido-2026-08-23.md`

## Restricciones

- **Entrega: 24/08/2026.** Después el repo se congela para los docentes.
- **El repo del juego es público.** Nada de rutas locales, datos personales, claves ni referencias a otros proyectos de la bóveda. Esto incluye las capturas de pantalla: revisarlas una a una antes de commitearlas (una del árbol de Obsidian mostraría los proyectos de trabajo si `01_PROJECTS` no estuviera colapsado).
- **La API key de OpenAI vive SOLO como variable de entorno en Vercel**, nunca en el bundle ni en el repo. Está cargada como `OPENAI_API_KEY` en producción, marcada `--sensitive` (ni la CLI muestra su valor).
- **El juego tiene que seguir siendo jugable sin ninguna IA**: si el proxy o la key fallan, todo degrada al `StaticFallback` sin penalizar al jugador.
- Saldo de OpenAI: **$10 prepago con auto-reload APAGADO**. Es un techo duro real. Ojo: la misma organización la usa el pipeline de transcripción de reuniones, así que el saldo es compartido.
- **`gh` SIEMPRE con `-R <owner/repo>` explícito.** Sin eso deduce el repo del cwd, y ya sobrescribió un issue en el repo equivocado.

## Estado actual

**Verificado en producción** (jugado en `wake-up-dev.vercel.app` con Playwright, no solo tests): `main` en `c9e8b42`, 205 tests, `npm run check` y `npm run build` en verde, CI y Deploy de GitHub verdes, y los dos despliegues sirviendo.

- **El Oráculo funciona sin que el evaluador configure nada.** Función serverless `api/oraculo.ts` (runtime **edge**) que hace de proxy a OpenAI; el cliente la usa automáticamente al arrancar si no hay config guardada. Contrato: `GET /api/oraculo` → `{"disponible":true}`; `POST` discriminado por `tipo` (`oraculo`/`pista`/`evaluar`). Verificado con una pregunta real respondida en producción. El modo BYOK sigue intacto en Zion (tecla `A`).
- **Escenarios (F14)**: piso opaco texturizado por escenario (generado con `tools/generar-pisos.py`), carrete lejano con la imagen de fondo en pequeño repetida y parallax 0.22, en **los diez** niveles. Valla de horizonte en exteriores, zócalo en interiores.
- **Perspectiva**: el orden de dibujo sale de la Y de los pies (más abajo = más cerca de cámara = delante), para todos los actores.
- **Cuenta atrás (F15)**: 60 s para responder, reloj + barra, tres pitidos en 3-2-1 y uno largo al agotarse; si expira, Smith despierta y golpea.
- **Dificultad progresiva (F16)**: depende de cuántos módulos lleva LIBERADOS, no del módulo (desde Zion se entra en el orden que se quiera). Cuatro perillas con techo a los 6 módulos, todas desde `dificultadPara()` en `src/domain/dificultad.ts`.
- **Puertas de salida (F17)**: nueve estilos para los diez niveles, con halo latiendo.
- **Contenido**: los 67 defectos del informe de revisión aplicados (11 factuales, distractores, rúbricas, duplicados). 312 retos, 10 bancos.
- **Música**: una pista por escenario (mapa `MUSICA_POR_MODULO` en `src/game/audio.ts`, con fallback), más tema de derrota. El módulo 01 no tiene pista propia y cae al fallback.
- **Accesibilidad**: contrastes corregidos a WCAG AA en el HUD y el panel de quiz; indicador de sonido visible en portada, Zion y HUD.
- **Slides**: 19 diapositivas, con bloque nuevo sobre el sistema (qué es, servidor MCP, skills propias, flujo multiagente) y el system prompt del Oráculo. Sin desbordes verificados a 1920x1080, 1440x810 y 1366x768.

**Hecho pero NO verificado jugando de punta a punta**: nadie ha completado un nivel entero (4 Smiths + Jefe) desde que entraron F14–F17. Las verificaciones fueron por tramos. El Jefe en particular solo se probó por inspección de código y banco de pruebas, no peleándolo.

## Pendientes (en orden)

1. **Grabar el vídeo.** Es el ÚNICO entregable de los cinco que falta, y la consigna es explícita: capturar la pantalla durante la explicación es **obligatorio** (mostrar el rostro es opcional). Guion en `docs/guion-video.md` — está desactualizado respecto de F14–F17 y del Oráculo en producción; conviene repasarlo antes de grabar.
2. **Enviar el formulario** de entrega con: nombre, email de inscripción, URL del repo, URL del despliegue, URL de las slides y URL del vídeo. El formulario está en la descripción de la lección del Proyecto Final.
3. **Jugar un nivel completo** en `wake-up-dev.vercel.app` antes de grabar. En este proyecto todos los bugs reales los encontró jugar, no los tests.
4. Post-entrega: Big Wins #9 y #11 del backlog público.

## Decisiones tomadas (no re-litigar)

- **Claude coordina, los copilots escriben.** La implementación se delega con `sb_delegate` (`cli: copilot`, `mode: autopilot`, `role: writer`, `scope` declarado, `mcp: []` si no necesitan browser). Excepción: gráfica avanzada y trabajo visual iterativo, que los hace el modelo grande porque el ciclo editar→ver→ajustar delegado pierde más de lo que ahorra. Toda tarea mediana o grande lleva una spec previa tipo SDD, y el prompt del writer se arma desde esa spec. Detalle en `04_META/aprendizajes/ruteo-coordinador-copilots-fable-grafica.md`.
- **Los reportes de las hijas se contrastan contra el repo, siempre.** Un writer reportó gates verdes y un hash que no existía en la rama esperada; otro cortó su reporte antes de dar el hash aunque sí había commiteado. Verificar: que el commit exista, que los gates pasen corriéndolos uno mismo, y que lo que dice el reporte coincida con el diff.
- **Deploy en Vercel además de GitHub Pages**, y no es redundante: Pages es un CDN estático y no puede ejecutar la función del Oráculo. Vercel además da previews por PR y permite cabeceras de caché y seguridad (`vercel.json`).
- **Proxy + BYOK conviviendo**, no uno u otro: el evaluador entra y el Oráculo responde sin fricción, y quien prefiera su propia key la sigue pudiendo poner.
- **Suelo plano tipo Double Dragon**, no camino serpenteante: el serpenteo no pegaba con los fondos. La infraestructura del camino curvo sigue en `src/domain/camino.ts` por si un nivel futuro la quiere.
- **Portada y Zion comparten música** a propósito: `reproducirMusica` no reinicia la pista si ya suena la misma, así que la transición es continua.
- **Sin pozos en los niveles.** Un agujero intransitable puede dejar un enemigo inalcanzable al otro lado y hacer el nivel imposible. Si se quieren, la forma segura es que hagan daño y empujen, no que bloqueen.
- **El backlog es público**: compartir el proceso es parte de lo que se entrega.
- **Las slides no tienen requisitos de contenido.** La consigna solo exige que existan y tengan URL pública. La estructura actual es una decisión propia, se puede cambiar sin riesgo.
- **En las slides se cuenta lo que salió bien, no los errores.** Un hallazgo falso atrapado por el gate se cuenta como "el proceso tiene verificación", no como "nos equivocamos".
- **npm, no pnpm, hasta después de la entrega.** Migrar tocaría los dos pipelines que hoy están verdes y no aporta nada al entregable.

## Gotchas / dónde está lo demás

- Los técnicos del juego (Kaplay, overlays DOM, capa IA, verificación en preview) están en `AGENTS.md` del repo. Incluye los pagados en esta sesión: `pos` es la esquina superior izquierda y los actores miden 96x160; una curva hecha de rectángulos se ve como escalera salvo que cada segmento cubra el salto al siguiente; el parallax se siembra desde espacio negativo o el arranque muestra un hueco; el acento oscuro desaparece sobre los fondos pintados; y el listener de teclado de un overlay tiene que cubrir el foco perdido o el ESC deja de cerrar tras un clic.
- Los de método están en `04_META/aprendizajes/`.
- **Vercel**: el enlace del proyecto (`.vercel/`) vive en el repo del juego, no en la raíz de la bóveda — correr `vercel` desde otro directorio da "codebase isn't linked". El campo `runtime` de una función solo acepta `nodejs`, `edge` o `experimental-edge`: una versión concreta rompe el build, y con `nodejs` un handler que devuelve `Response` nunca contesta (504 en todas las rutas, incluido el 405).
- **Las capturas de las slides las tiene que hacer quien tenga Playwright**: los copilots headless no lo tienen en su sesión y lo declaran. Los vídeos de 1080p60 hay que recomprimir (`ffmpeg -vf "scale=1280:-2,fps=30" -crf 30 -an`): uno venía en 15 MB y quedó en 1,2 MB.

## Forma de trabajo

- Español en todo. Commits con `Co-Authored-By: Claude`.
- Repo del juego main-only; los writers headless usan worktree y el coordinador mergea. La poda de worktrees integrados y el contrato de writer inyectado ya están automatizados en el dashboard (commit `ed0d48a1` de la bóveda).
- Gates antes de push: `npm run check`, `npm test`, `npm run build`. Nunca `main` en rojo.
- Tras cada push a `main`, redesplegar Vercel con `vercel --prod --yes` desde el repo del juego (GitHub Pages se despliega solo por Actions).
- **Verificar en navegador es obligatorio** para cualquier cambio visible: los bugs reales de este proyecto los encontró jugar, no los tests.
- Commits de bóveda con `git add` selectivo, nunca `-A`: es compartida entre dos PCs y con loops.

Empezá por: [REEMPLAZAR con la tarea concreta de la sesión — probablemente repasar y actualizar `docs/guion-video.md` contra el estado actual del juego, y después grabar]
