import { SEGUNDOS_MULTIPLE_CHOICE } from "./cuenta-atras";

/**
 * Dificultad progresiva (F16).
 *
 * El juego no tiene orden fijo de niveles: el jugador entra a los módulos desde
 * Zion en el orden que quiera. Así que la dificultad NO puede colgar del módulo
 * —el módulo 12 no es "más difícil" que el 2—, sino de **cuántos módulos lleva
 * liberados**: los primeros niveles enseñan, los últimos exigen.
 *
 * Una sola función devuelve todas las perillas, y la escena las consume sin
 * decidir nada (DRY): añadir una perilla nueva es tocar solo este archivo y el
 * sitio donde se usa, y el balance entero se lee y se testea de un vistazo.
 *
 * Dominio puro: sin kaplay, sin DOM.
 */

/** Módulos liberados a partir de los cuales la dificultad ya no sube más. */
export const LIBERADOS_PARA_TOPE = 6;

export interface Dificultad {
  /** 0 = primer nivel de la partida, 1 = tope de dificultad. */
  intensidad: number;
  /** Velocidad de persecución de los Smiths (px/s). */
  velocidadAgente: number;
  /** Cuántos Smiths persiguen a la vez en vez de esperar turno. */
  agentesSimultaneos: number;
  /** Segundos para responder un reto de opciones. */
  segundosParaResponder: number;
  /** Segundos entre golpe y golpe de un Smith. */
  cadenciaAtaque: number;
  /** Etiqueta corta para el HUD. */
  etiqueta: string;
}

function mezclar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Dificultad según los módulos ya liberados.
 *
 * Las cuatro perillas suben juntas y de forma acotada: al tope, los Smiths
 * corren un 60 % más rápido, vienen de a tres en vez de uno, pegan casi al
 * doble de ritmo y hay 35 segundos para responder en vez de 60. Son pocos
 * números y todos con techo — sin techo, los últimos niveles se vuelven una
 * pared y el jugador abandona justo cuando el contenido es más valioso.
 */
export function dificultadPara(modulosLiberados: number): Dificultad {
  const liberados = Math.max(0, Math.floor(Number.isFinite(modulosLiberados) ? modulosLiberados : 0));
  const intensidad = Math.min(1, liberados / LIBERADOS_PARA_TOPE);
  return {
    intensidad,
    velocidadAgente: Math.round(mezclar(100, 160, intensidad)),
    // Escalonado, no interpolado: "vienen de a dos" es un salto que se NOTA;
    // un 1,4 no significaría nada en pantalla.
    agentesSimultaneos: liberados >= 5 ? 3 : liberados >= 2 ? 2 : 1,
    segundosParaResponder: Math.round(mezclar(SEGUNDOS_MULTIPLE_CHOICE, 35, intensidad)),
    cadenciaAtaque: Number(mezclar(2, 1.2, intensidad).toFixed(2)),
    etiqueta: intensidad >= 1 ? "MÁXIMA" : intensidad >= 0.5 ? "ALTA" : intensidad > 0 ? "MEDIA" : "INICIAL",
  };
}
