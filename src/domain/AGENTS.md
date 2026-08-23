# Instrucciones para agentes — src/domain/

> Raíz: [AGENTS.md](../../AGENTS.md)

## Propósito

Dominio **puro y testeado**. Contiene las reglas de negocio del juego: `reto.ts`, `quiz-engine.ts`, `session.ts`, `combate.ts`, `dificultad.ts`, `carrete.ts`, `camino.ts`, `aleatorio.ts`, `teclado.ts`, `feedback.ts`, `cuenta-atras.ts`.

## Regla de oro

`src/domain/` **NUNCA importa** de:

- `kaplay` ni ningún módulo del DOM
- `src/ai/`
- `src/game/`
- `src/content/` (el contenido se inyecta desde fuera)

Cualquier dependencia hacia esas capas rompe la testeabilidad del dominio. Si necesitás algo de esas capas, es una señal de que el código no pertenece aquí.

## Tests

Cada módulo tiene tests en `tests/`. Al agregar lógica nueva:

1. Escribir el test primero → debe fallar.
2. Implementar lo mínimo para que pase.
3. `npm run check` + `npm test` en verde antes de commitear.

## Qué va aquí

- Reglas y algoritmos del juego (puntuación, dificultad, carrete de retos, combate).
- Tipos e interfaces compartidas entre capas.
- Utilidades puras (aleatorio, teclado, cuenta atrás).

## Qué NO va aquí

- Llamadas a APIs de IA → `src/ai/`
- Renderizado Kaplay o manipulación del DOM → `src/game/`
- Definición de los bancos de contenido → `src/content/`
