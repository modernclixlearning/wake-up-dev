# Guion del vídeo del TFM — Wake Up, Dev

> **Formato**: captura de pantalla **obligatoria**, rostro por cámara opcional, voz propia.
> **Duración objetivo**: 5–8 minutos. Este recorrido da **~6:55** si se respeta el ritmo.
> **Grabación de un tirón**: el guion está pensado para leerse de corrido, sin cortes ni edición.

**Cómo usar este documento.** Cada sección trae tres cosas: **Pantalla** (qué se ve), **Decir** (el texto en bloque citado, redactado para leerse en voz alta) y **Por qué está** (a qué criterio de evaluación responde). Ese último renglón está para que ninguna sección se recorte por error creyendo que sobra: si se cae la sección, se cae el criterio.

**Regla que atraviesa todo el guion**: nada se muestra sin decir la decisión de diseño que hay detrás. El criterio de la lección no es "enseñar funcionalidades", es **demostrar que se entiende lo que se construyó**. La demo es la excusa; la frase que la sigue es la nota.

> **Antes de leer nada en voz alta**, completá el checklist de la sección 8.

---

## 1. Apertura — la idea (0:00 – 0:40 · 40 s)

**Pantalla:** pantalla de título del juego en `https://wake-up-dev.vercel.app`, sin tocar nada. La música del menú suena de fondo.

**Decir:**

> "Esto es Wake Up, Dev. Es un videojuego web 8-bit inspirado en Matrix, y es mi Trabajo de Fin de Máster.
>
> La idea es simple de contar y rara de encontrar: cada módulo del máster es un nivel de la Matrix. Vos sos Neo. Los Agentes Smith te salen al paso y hay que pelearlos a puñetazos. Cuando el Agente queda aturdido, te lanza un reto sacado de mis apuntes reales del curso. Si respondés bien, le pegás de verdad.
>
> O sea: el máster no se repasa leyendo. Se repasa jugándolo.
>
> Y hay una segunda vuelta de tuerca. La IA acá no es solamente la herramienta con la que construí el juego. Es una mecánica dentro del juego. Ya vas a ver por qué eso cambia todo.
>
> Stack en una frase: TypeScript, Vite, Kaplay para el canvas 2D, Vitest, y una capa de IA con proveedores intercambiables. Está desplegado en Vercel y se puede jugar ahora mismo."

**Por qué está:** la lección prioriza la **originalidad** por encima de la profesionalidad, y penaliza el clon de un producto existente. Esta apertura planta la idea propia en los primeros 30 segundos, antes de cualquier detalle técnico.

---

## 2. El loop de juego — cada módulo es un nivel (0:40 – 2:10 · 90 s)

**Pantalla:** el juego, en vivo.

1. **ENTER → Zion.** Señalar el mapa: los **10 módulos jugables** (01 a 05 y 09 a 13 del máster). Señalar la línea de la esquina que ya dice **"IA conectada"** — sin haber configurado nada.
2. **Entrar a un módulo** (por ejemplo, Fundamentos). Mover a Neo con las flechas: el suelo texturizado y el fondo en parallax, que se desplaza más lento y da profundidad.
3. **Aparece un Smith.** Pelear: **ESPACIO** da la piña. Conectar los **tres golpes** que hacen falta para aturdirlo. Ahí se abre el reto.
4. **Responder bien**: Neo le baja un punto de vida al Agente. **Responder mal**: se pierde una vida, y aparece la explicación didáctica del reto.
5. Señalar el **reloj de cuenta atrás** del HUD mientras el reto está abierto.
6. Limpiar el módulo y mostrar al **Agente Jefe** custodiando la salida, y la **puerta de salida** del escenario.

**Decir** (mientras se pelea, sin esperar a terminar):

> "Fijate en el orden de las cosas, porque es la decisión de diseño central del juego. La piña no mata al Agente. La piña te da derecho a la pregunta. Lo que le baja la vida al Agente es responder bien.
>
> Al principio el combate era: acertás y cae. Y el juego se volvía un cuestionario con dibujitos. Separar las dos cosas —pelear para llegar a la pregunta, responder para ganar— es lo que hace que se sienta un juego y no un test. Un Smith normal aguanta dos preguntas. El Jefe, cuatro.
>
> El contenido: 312 retos generados desde mis propias notas del curso. 287 de opción múltiple y 25 de respuesta abierta. De esos, 25 están marcados «Estado del Arte 2026»: conceptos que hoy están en la frontera del oficio, y que valen más puntos.
>
> Y una decisión chiquita que dice bastante: las opciones se barajan en cada partida. El generador de contenido tenía un sesgo, ponía la respuesta correcta casi siempre primera. Podría haber arreglado los JSON y listo. Pero eso arregla el banco de hoy, no el de mañana. Así que el barajado vive en el motor del quiz: aunque entre un banco sesgado, el juego no es explotable apretando siempre la misma tecla."

**Continuar mientras se muestra el Jefe y la puerta:**

> "Cada uno de los 10 escenarios tiene su fondo pixel-art propio, su música y su propia puerta de salida: diez estilos distintos, de una cabina de código a una cabina telefónica.
>
> La dificultad sube, pero no cuelga del número del módulo. Desde Zion se entra a los módulos en el orden que uno quiera, así que el módulo 12 no es «más difícil» que el 2. Lo que sube la dificultad es **cuántos módulos llevás liberados**. Al tope, los Smiths corren un sesenta por ciento más rápido, vienen de a tres en vez de uno, pegan casi al doble de ritmo, y el tiempo para responder baja de sesenta segundos a treinta y cinco."

**Por qué está:** es el bloque que demuestra que **se entiende lo construido**, que es el criterio explícito del vídeo. Cada elemento en pantalla va seguido de la decisión y del problema que resolvía. También sostiene la originalidad de la sección 1, mostrándola en movimiento.

---

## 3. La IA como mecánica, no como herramienta (2:10 – 3:40 · 90 s)

**Pantalla:** seguir dentro del nivel.

1. **El Oráculo.** Caminar hasta el Oráculo (está al inicio del nivel) y hacerle una pregunta real del módulo. Mostrar la respuesta.
2. **Un reto abierto.** Aturdir a un Smith que lance una pregunta de respuesta abierta. Escribir una respuesta a mano y mostrar el veredicto con su feedback.
3. **La pista.** Tras fallar un reto de opciones, pulsar **P** y mostrar la pista que llega del Oráculo.

**Decir** (sobre el Oráculo):

> "El Oráculo es un personaje del juego, y responde dudas del módulo en el que estás parado. No es un chat genérico pegado a un costado: recibe como contexto el nombre, la descripción y el resumen del módulo actual, y tiene instrucción explícita de no dar nunca la respuesta literal de un reto, solo de guiar para que la deduzcas. Si te la diera, rompería su propio juego.
>
> Y algo importante para quien esté evaluando esto: el Oráculo ya está funcionando, y yo no configuré nada. Al arrancar, el juego sondea en segundo plano una función serverless desplegada en Vercel. Si esa función responde que está disponible, el juego se conecta solo. La clave de la API vive como variable de entorno del servidor: nunca está en el bundle del cliente ni en el repositorio. Por eso arriba, en Zion, se leía «IA conectada» sin que yo tocara una sola tecla."

**Decir** (sobre el reto abierto y la pista):

> "Las respuestas abiertas las corrige una IA contra una rúbrica escrita: la rúbrica dice qué tiene que mencionar la respuesta para aprobar, así que el veredicto es verificable, no una opinión. Y con la tecla P, el Oráculo te tira una pista del reto que tenés delante.
>
> Ahora, la decisión de diseño que sostiene todo esto: **el juego tiene que funcionar completo sin ninguna IA**. Si no hay conexión, no hay clave, o el proveedor falla, no se rompe nada ni se penaliza al jugador. Cada reto abierto declara en su JSON el identificador de un reto de opción múltiple del mismo banco que cubre el mismo concepto. Sin IA, la pregunta abierta se sustituye sola por esa variante. Y el fallback estático es un proveedor más, que implementa la misma interfaz que Anthropic, que OpenAI o que Gemini: para el juego son todos intercambiables, no distingue cuál está enchufado.
>
> Eso es lo que hace que la IA sea una mecánica y no un adorno. Una feature de IA que se cae y arrastra al producto con ella no es una feature: es una dependencia."

**Por qué está:** cubre el criterio de "**ingenieros de software potenciados por IA**" desde el lado del producto, y de paso el de **arquitectura y buenas prácticas**: degradación, interfaz común, contrato de fallback. La frase sobre la clave que no sale del servidor cubre **seguridad**.

---

## 4. El proceso: cómo se construyó (3:40 – 4:25 · 45 s)

**Pantalla:** las slides, en `https://wake-up-dev.vercel.app/slides/`. Pasar unas pocas, sin leerlas.

**Decir:**

> "Un minuto sobre el método, porque este máster no es de web ni de apps: es de ingenieros de software potenciados por IA, y el proceso también es parte de lo que se entrega.
>
> Esto no lo escribí a mano, ni se lo pedí de un tirón a un modelo. Trabajé como coordinador. Primero un plan maestro con fases, riesgos y criterios de éxito, antes de la primera línea de código. Después, cada fase la ejecutó un agente con contexto acotado: el repositorio tiene un archivo de instrucciones por zona —dominio, presentación, capa de IA, contenido y tests—, así el agente que toca el dominio lee las reglas del dominio y no las de Kaplay.
>
> El contenido siguió el mismo patrón: un agente lee las notas markdown de un módulo y produce el banco JSON; un test de invariantes en la integración continua actúa de portero; y la revisión final la hago yo, reto por reto. Los enunciados están reformulados con palabras propias, nunca copiados del material del curso.
>
> Generado con IA, sí. Volcado sin revisar, no. Esa diferencia es todo el trabajo."

**Por qué está:** responde al criterio de **código curado y no volcado**, y al de **ingenieros potenciados por IA** contado como método. Las slides aparecen acá porque es su lugar natural, y de paso quedan enseñadas como entregable.

---

## 5. La ingeniería: por qué esto se puede testear (4:25 – 5:45 · 80 s)

**Pantalla:** el editor de código con el repositorio abierto. Mostrar el árbol: `src/domain/`, `src/content/retos/`, `src/ai/`, `src/game/`, `api/`, `tests/`.

**Decir** (recorriendo el árbol):

> "Cuatro capas, y una regla que las ordena.
>
> `src/domain` es el corazón del juego: la puntuación, la sesión, la dificultad, el motor del quiz, el combate. Y es **puro**. No importa Kaplay, no toca el DOM, no sabe que existe la capa de IA, y ni siquiera importa el contenido: el contenido se le inyecta desde fuera. Abrí cualquier archivo del dominio y sus únicos imports son a otros archivos del propio dominio.
>
> Eso no es purismo. Es la razón por la que este proyecto tiene tests de verdad. Las reglas del juego se instancian en un test y se ejecutan, sin simular un canvas y sin simular un navegador. Si el dominio importara Kaplay, testear la dificultad exigiría levantar un motor gráfico entero. Y en la práctica, eso significa no testear nada.
>
> `src/content` son los bancos de retos en JSON. El contenido es **data, no código**: agregar un módulo nuevo del máster es agregar un archivo, no tocar una escena. Nunca hay una pregunta escrita a mano dentro del juego.
>
> `src/ai` es la capa de proveedores detrás de una única interfaz. `src/game` es lo único que sabe de Kaplay y del canvas. Y `api` es la función serverless del Oráculo."

**Pantalla:** cambiar a la terminal (con el repositorio del juego como directorio) y correr `npm test`. Esperar la salida.

**Decir** (con los resultados en pantalla):

> "**205 tests en verde, repartidos en 12 archivos.** No es un número decorativo. Mirá dónde están puestos: 52 de esos casos no testean código, testean el **contenido**. Recorren los diez bancos JSON y verifican que los identificadores no se repitan, que el índice de la respuesta correcta esté en rango, que cada reto abierto apunte a un fallback que existe de verdad, y que cada banco tenga al menos un reto de estado del arte.
>
> Ese es el portero del pipeline de contenido. Un banco malformado no llega a producción: rompe la integración continua y no se despliega. Cuando el contenido lo genera una IA, el gate automático no es un lujo. Es la única forma de escalar sin que se te cuele basura."

**Por qué está:** es el bloque de **código curado, no volcado** (criterio 3) y de **arquitectura y testing** (criterio 5). La frase sobre por qué el dominio es puro es la que más vale de todo el vídeo: explica una decisión por su consecuencia práctica, no con un adjetivo.

---

## 6. Producción: seguridad, costes y despliegue (5:45 – 6:35 · 50 s)

**Pantalla:** abrir `vercel.json` y `api/oraculo.ts` en el editor. Después, la pestaña del repositorio en GitHub con la última corrida de **CI** en verde.

**Decir:**

> "Último bloque: lo que pasa cuando esto sale a internet.
>
> El despliegue no es «conectar el repo y listo». La configuración de Vercel define caché por tipo de recurso: los bundles con hash en el nombre son inmutables por un año, los assets pesados que no llevan hash —música, fondos, sprites— caducan a la semana, y el HTML no se cachea, para que un despliegue nuevo se vea al instante. Sin eso, cada visita se volvía a bajar decenas de megas de audio.
>
> Y van cabeceras de seguridad en todas las respuestas: nosniff, protección contra el embebido en iframes, política de referrer, y una Permissions-Policy que deniega geolocalización, micrófono y cámara. El juego no los necesita, así que directamente no los puede pedir.
>
> La función del Oráculo tiene su propia contención, porque la clave la pago yo: tope de tokens por respuesta, recorte de las entradas antes de llamar al modelo, y un límite de peticiones por IP. Ese límite es por instancia, y Vercel puede levantar varias en paralelo, así que lo trato como una capa de cortesía. La defensa real contra el gasto descontrolado es el tope de facturación de la cuenta. Está documentado así en el propio código, porque un control de seguridad mal entendido es peor que no tenerlo.
>
> Y todo pasa por integración continua antes de publicarse: comprobación de tipos, los 205 tests y el build. Si algo se cae, no se despliega."

**Por qué está:** cubre explícitamente **seguridad** y **buenas prácticas** del criterio 5, que es donde casi todos los proyectos se quedan cortos. Y termina el vídeo con el nivel técnico más alto, no con un resumen blando.

---

## 7. Cierre (6:35 – 6:55 · 20 s)

**Pantalla:** volver a la pantalla de título del juego.

**Decir:**

> "Eso es Wake Up, Dev: el máster convertido en un juego que se puede jugar, con la IA metida adentro de la mecánica y no solo detrás del teclado.
>
> Está jugable ahora mismo en wake-up-dev.vercel.app, con el Oráculo funcionando sin configurar nada. El código está en GitHub, en modernclixlearning barra wake-up-dev. Y las slides están en el mismo dominio, en barra slides.
>
> Gracias por jugarlo."

**Por qué está:** requisito formal de la consigna — la **URL pública de despliegue** tiene que estar dicha y visible. Cerrar sobre la pantalla de título deja la última imagen puesta en el producto.

---

## 8. Checklist antes de grabar

### 8.1. Privacidad — CRÍTICO (el repositorio y el vídeo son públicos)

- [ ] Cerrar **todo** lo que no sea el juego, el editor con el repositorio del juego y la terminal del juego. En concreto: **ninguna ventana de la bóveda personal, ningún otro proyecto, ningún cliente de mensajería, ningún panel interno y ninguna herramienta con credenciales a la vista.**
- [ ] En el editor: cerrar todas las pestañas que no sean del repositorio del juego. **La barra lateral no puede mostrar otro proyecto abierto.** Ningún archivo de entorno abierto.
- [ ] **Ninguna ruta local del sistema de archivos en pantalla.** Ocultar la barra de ruta del editor si la muestra; abrir la terminal ya dentro del repositorio y limpiarla (`clear`) para que el prompt no arrastre la ruta completa.
- [ ] La barra de direcciones del navegador solo puede mostrar `https://wake-up-dev.vercel.app` o `https://wake-up-dev.vercel.app/slides/`. Nada de `localhost` en cámara.
- [ ] Barra de marcadores del navegador **oculta**. Usar un perfil limpio o una ventana de incógnito.
- [ ] **No abrir el panel de Vercel ni el de ningún proveedor de IA en cámara**: muestran la cuenta y otros proyectos. La configuración se cuenta con la voz y se enseña desde los archivos del repositorio.
- [ ] **No teclear ninguna API key en cámara, en ningún momento.** No hace falta: el Oráculo funciona por el proxy sin configurar nada.
- [ ] Notificaciones del sistema en silencio (modo "No molestar").

### 8.2. Estado del juego

- [ ] `localStorage` limpio: DevTools → Application → Storage → "Clear site data", o directamente una ventana de incógnito. Importante: **la auto-conexión del Oráculo solo se activa si no hay configuración guardada**. Si quedó una configuración vieja, la sección 3 se cae.
- [ ] Comprobar en Zion que la línea de estado dice **"IA conectada"** antes de empezar a grabar. Si no aparece, recargar; si sigue sin aparecer, la función del Oráculo no está respondiendo y hay que revisarla antes de grabar.
- [ ] Partida reiniciada (**R** en Zion) para arrancar con todas las vidas y sin progreso.
- [ ] Ensayar una vez el combate de la sección 2: hacen falta **tres piñas conectadas** para aturdir al Smith. Sin ese ensayo, el bloque se estira y se pierde el ritmo.
- [ ] Tener localizado de antemano un módulo con un reto abierto a mano, para no buscarlo en cámara.
- [ ] Volumen del juego audible, pero por debajo de la voz.

### 8.3. Técnico

- [ ] Zoom del navegador al 100 %, grabación a 1080p.
- [ ] Pestañas abiertas y en orden: 1) el juego, 2) las slides, 3) el repositorio en GitHub, en la pestaña de Actions, con la corrida de CI en verde.
- [ ] Terminal abierta en el repositorio del juego, con `npm test` ya corrido una vez antes de grabar (para que la corrida en cámara sea rápida).
- [ ] Micrófono probado: grabar treinta segundos y escucharlos antes de la toma buena.
- [ ] Cronómetro a la vista: si a los 4 minutos no se llegó a la sección 5, acortar la 5 y **no** la 6.

### 8.4. Después de grabar — requisito formal pendiente

- [ ] Subir el vídeo a YouTube o Drive con **enlace público accesible sin cuenta**.
- [ ] **Poner la URL del vídeo en el `README.md`**, en la tabla de entregables, reemplazando el "pendiente". La consigna exige que la URL del vídeo figure también en la documentación. Hoy está sin completar.
- [ ] Comprobar que en el `README.md` estén las cuatro URLs: repositorio, despliegue, slides y vídeo.
- [ ] Rellenar el formulario de entrega del máster con esas mismas URLs.

---

## 9. Qué NO se dice en este vídeo

Lista corta y deliberada. Cada punto se sacó por una razón.

- **Nada de bugs del desarrollo, ni anécdotas de errores.** Fueron circunstancias del proceso, no parte de lo que se entrega.
- **Nada de ironía a costa del máster.** El tono es de valor: el juego existe porque el contenido del curso vale la pena repasarlo.
- **El bridge headless local no se demuestra.** Fue una circunstancia del desarrollo, no lo que vive en producción: en el despliegue no se levanta ninguna instancia headless. Si sale en la conversación, es una frase sobre el proceso, nunca una demo de producto.
- **El modo BYOK no se enseña en pantalla.** Existe en el código, pero mostrarlo obliga a abrir el panel de ajustes y arrima el riesgo de teclear una clave en cámara. El Oráculo por proxy ya cuenta la historia completa, y mejor.
- **No se menciona ningún destino de despliegue que no sea Vercel.** No hay espejos ni URLs alternativas en este vídeo.
- **No se da el número de slides.** Se dicen "las slides" y se enseña el enlace.
- **Nada que no se pueda abrir en el repositorio y comprobar.** Si una frase no se puede señalar en un archivo, no entra.

---

## 10. Cifras verificadas (2026-08-23)

Contadas contra el repositorio el día de la grabación. Si se regraba más adelante, recontar.

| Dato | Valor | Cómo se verifica |
|---|---|---|
| Niveles jugables | 10 | 10 archivos en `src/content/retos/` |
| Módulos del máster cubiertos | 01, 02, 03, 04, 05, 09, 10, 11, 12, 13 | nombres de esos archivos |
| Retos totales | 312 | conteo sobre los bancos JSON |
| — de opción múltiple | 287 | campo `tipo: "multiple-choice"` |
| — de respuesta abierta | 25 | campo `tipo: "abierta"` |
| Retos «Estado del Arte 2026» | 25 | campo `estadoDelArte2026: true` |
| Tests | 205 en 12 archivos | `npm test` |
| — casos que validan el contenido | 52 | `tests/banco-contenido.test.ts` |
| Golpes para aturdir a un enemigo | 3 | `GOLPES_PARA_ATURDIR` en `src/domain/combate.ts` |
| Vida de un Smith / del Jefe | 2 / 4 respuestas acertadas | `HP_AGENTE_NORMAL` y `HP_JEFE` en `src/domain/combate.ts` |
| Tiempo para responder | 60 s al inicio, 35 s al tope | `src/domain/dificultad.ts` |
| Enemigos simultáneos al tope | 3 | `src/domain/dificultad.ts` |
| Velocidad de los Smiths | 100 → 160 px/s | `src/domain/dificultad.ts` |
| Estilos de puerta de salida | 10 | `PUERTA_POR_FONDO` en `src/game/escenario.ts` |

---

## 11. Enlaces del proyecto

| Entregable | URL |
|---|---|
| Juego desplegado | https://wake-up-dev.vercel.app |
| Slides | https://wake-up-dev.vercel.app/slides/ |
| Repositorio | https://github.com/modernclixlearning/wake-up-dev |
| Vídeo | _pendiente — publicarlo y añadir la URL acá y en el `README.md`_ |
