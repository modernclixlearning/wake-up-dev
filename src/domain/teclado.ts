/**
 * Mapeo de índice de módulo a tecla de selección en Zion.
 *
 * Los nueve primeros módulos (índices 0-8) van con las teclas 1-9.
 * El décimo (índice 9) usa la tecla 0: `String(i + 1)` daba "10" para ese caso,
 * que no es una tecla válida — el décimo módulo quedaba inalcanzable desde el teclado.
 * A partir del undécimo módulo (índice >= 10) la función devuelve "" y el módulo
 * queda sin tecla directa; necesitaría flechas + Enter u otro mecanismo.
 */
export function teclaDeModulo(i: number): string {
  if (i < 9) return String(i + 1);
  if (i === 9) return "0";
  return "";
}
