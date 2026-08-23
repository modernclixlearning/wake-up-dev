# Instrucciones para agentes — src/content/

> Raíz: [AGENTS.md](../../AGENTS.md)

## Propósito

Bancos de retos en formato JSON data-driven. Agregar un módulo = agregar un fichero JSON en `retos/`. Nunca hardcodear preguntas en código de escenas.

## Pipeline de contenido

Documentado en [tools/pipeline-contenido.md](../../tools/pipeline-contenido.md). Resumen de reglas:

- Retos **reformulados con palabras propias** (nunca copiar literal las notas del máster — licencias).
- Distractores plausibles; rúbricas de abiertas **verificables** ("debe mencionar X").
- Cada banco debe tener al menos un reto `estadoDelArte2026` (etiquetado `«ESTADO DEL ARTE 2026 — »` en el enunciado, mayor puntuación).
- Campo `modulo.resumen`: contexto que se inyecta al Oráculo — completarlo siempre.
- **La revisión humana del alumno es obligatoria** antes de dar un banco por bueno. Actualizar el registro del pipeline al generar o revisar.

## Validación

`tests/banco-contenido.test.ts` valida la estructura de todos los bancos en CI.  
Gate: cualquier JSON malformado o con campos faltantes → test en rojo → no se commitea.

## Prefijos de módulo

Respetar el esquema de prefijos numéricos al nombrar ficheros: `01-fundamentos.json`, `02-ingenieria.json`, etc. El número coincide con el orden del módulo en el máster.
