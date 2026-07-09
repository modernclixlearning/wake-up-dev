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
| 03-arquitectura.json | 2026-07-10 (Claude, desde notas reales del módulo 03) | ⚠️ pendiente de revisión final del alumno | 21 (2 bonus 2026, 2 abiertas) |
| 04-fundamentos-ia.json | 2026-07-10 (Claude, desde notas reales del módulo 04) | ⚠️ pendiente de revisión final del alumno | 20 (2 bonus 2026, 2 abiertas) |

Nota de schema: `modulo.resumen` (opcional) es el contexto que se inyecta al Oráculo en ese nivel.
