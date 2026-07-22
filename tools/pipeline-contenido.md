# Pipeline de contenido: notas del máster → banco de retos JSON

El contenido del juego es **data-driven**: agregar un módulo = agregar un archivo JSON en `src/content/retos/`. Este documento define el proceso repetible para generar ese JSON desde las notas del curso.

## Proceso (3 pasos)

```
notas markdown del módulo  →  generación asistida por IA  →  revisión humana  →  banco JSON
                                                                    ↑
                                              gate automático: tests/banco-contenido.test.ts (CI)
```

### 1. Generación asistida por IA

Darle a un agente (Claude Code, etc.) las notas del módulo y el prompt de abajo. El agente produce el JSON candidato.

### 2. Revisión humana (obligatoria)

Antes de commitear, revisar cada reto: ¿es correcto? ¿está reformulado con palabras propias (no copia literal del material del máster)? ¿las opciones incorrectas son plausibles pero claramente incorrectas?

### 3. Gate automático

`npm test` valida invariantes de todos los bancos (ids únicos, correcta en rango, 2-4 opciones, fallbacks válidos, al menos un bonus 2026). CI lo exige en cada push.

> **Nota sobre la posición de la correcta**: los bancos generados hasta 2026-07 tienen la
> correcta casi siempre en la opción 1 (sesgo del generador). Como backstop, `QuizEngine`
> **baraja las opciones de cada reto en cada partida** y remapea el índice correcto, así el
> juego nunca es explotable por posición aunque el JSON venga sesgado. La regla de generación
> de arriba ("variá la posición") es para que los bancos NUEVOS ya salgan bien de origen.

## Prompt de generación

```
Sos un generador de retos para un juego educativo. A partir de las notas markdown
adjuntas del módulo <NN-nombre> del máster, generá un banco de retos JSON con este schema:

{
  "modulo": { "id": "<NN-slug>", "nombre": "...", "descripcion": "..." },
  "retos": [ ... ]
}

Cada reto multiple-choice:
{ "id": "<prefijo>-NNN", "modulo": "<NN-slug>", "tipo": "multiple-choice",
  "pregunta": "...", "opciones": ["...", 2 a 4 opciones], "correcta": <índice>,
  "explicacion": "...", "dificultad": 1|2|3, "tags": ["..."], "bonus2026": false }

Cada reto abierto (2-3 por banco máximo):
{ ..., "tipo": "abierta", "rubrica": "criterios explícitos y gradeables",
  "fallbackId": "<id de un multiple-choice del mismo banco que cubre el mismo concepto>" }

Reglas:
- 20 a 30 retos por módulo, cubriendo todos los submódulos de las notas.
- REFORMULÁ con palabras propias — nunca copies frases literales de las notas.
- Opciones incorrectas plausibles (errores conceptuales típicos), nunca absurdas ni chistes.
- VARIÁ la posición de la opción correcta entre preguntas: repartí el índice "correcta"
  entre 0, 1, 2 y 3 de forma pareja. NO la pongas siempre primera (índice 0) — un banco
  con la correcta siempre en la misma posición deja el juego ganable apretando una sola
  tecla sin leer.
- La explicación enseña: dice por qué la correcta es correcta y aporta el matiz de las notas.
- Dificultad: 1 = definición directa, 2 = requiere relacionar conceptos, 3 = matiz fino o aplicación.
- 2 a 4 retos con "bonus2026": true — actualizaciones del tema al estado del arte 2026
  (nuevos estándares, herramientas o prácticas que las notas no cubren), con el prefijo
  "BONUS 2026 — " en la pregunta.
- Las rúbricas de las abiertas deben ser criterios verificables ("debe mencionar X, Y"),
  no vibes ("que esté bien explicado").
- ids con prefijo corto del módulo (fun-, ing-, arq-, ia-, ...) y numeración NNN.
```

## Convenciones de prefijos

| Módulo | Prefijo |
|---|---|
| 01-fundamentos | `fun-` |
| 02-ingenieria | `ing-` |
| 03-arquitectura | `arq-` |
| 04-fundamentos-ia | `ia-` |
| 05-herramientas | `her-` |
| 09-flujo-desarrollo-ia | `flu-` |
| 10-calidad | `cal-` |
| 11-infraestructura-cloud | `inf-` |
| 12-seguridad | `seg-` |
| 13-desarrollo-potenciado-ia | `dev-` |

## Registro

| Banco | Generado | Revisado por humano | Retos |
|---|---|---|---|
| 01-fundamentos.json | 2026-07-09 (Claude, desde notas reales del módulo 01) | ⚠️ pendiente de revisión final del alumno | 33 (3 bonus 2026, 3 abiertas) |
| 02-ingenieria.json | 2026-07-11 (Claude, desde notas reales del módulo 02) | ⚠️ pendiente de revisión final del alumno | 35 (3 bonus 2026, 2 abiertas) |
| 03-arquitectura.json | 2026-07-10 (Claude, desde notas reales del módulo 03) | ⚠️ pendiente de revisión final del alumno | 21 (2 bonus 2026, 2 abiertas) |
| 04-fundamentos-ia.json | 2026-07-10 (Claude, desde notas reales del módulo 04) | ⚠️ pendiente de revisión final del alumno | 20 (2 bonus 2026, 2 abiertas) |
| 05-herramientas.json | 2026-07-11 (Claude, desde notas reales del módulo 05) | ⚠️ pendiente de revisión final del alumno | 35 (3 bonus 2026, 2 abiertas) |
| 09-flujo-desarrollo-ia.json | 2026-07-11 (Claude, desde notas reales del módulo 09; el submódulo 04 de APIs aún no tiene notas) | ⚠️ pendiente de revisión final del alumno | 30 (3 bonus 2026, 2 abiertas) |

Nota de schema: `modulo.resumen` (opcional) es el contexto que se inyecta al Oráculo en ese nivel.

### Bloqueados (sin notas reales del alumno todavía)

Los módulos `10-calidad`, `11-infraestructura-cloud`, `12-seguridad` y `13-desarrollo-potenciado-ia` no tienen banco: todas sus clases en la bóveda son plantillas ("Escribe aquí tus notas", 200 caracteres). Ídem el submódulo `04-integracion-de-apis-y-plataformas-ia-populares` de `09-flujo-desarrollo-ia` (solo `00` y `01` tienen contenido real; del `02` al `14` son plantillas). El pipeline exige generar desde notas reales — no fabricar contenido. Reintentar la generación cuando el alumno complete esas notas en la bóveda.
