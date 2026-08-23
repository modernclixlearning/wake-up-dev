import { acotar, entre, mezclar, prng, suave } from "./aleatorio";

/**
 * El CAMINO del nivel (F14).
 *
 * Problema que resuelve: hasta F13 el nivel era un rectángulo: el fondo estaba
 * fijo a la pantalla y los personajes se movían libres dentro de una banda
 * constante. Eso daba dos síntomas — movimiento sin criterio (da igual por
 * dónde vayas) y sensación de avance pobre (caminás y el mundo no cambia).
 *
 * El camino es un "harness" de movimiento: una banda PISABLE cuya altura y
 * centro dependen de la X. Los personajes quedan acotados a ella, así que hay
 * un lugar concreto que pisar y hay que corregir con las flechas para seguir la
 * curva. No son paredes: es un clamp, o sea que si no corregís el borde te
 * empuja — imposible quedarse trabado (ver el aprendizaje sobre softlocks en
 * side-scrollers sin tilemap, AGENTS.md).
 *
 * Perfil del camino a lo largo del nivel:
 *
 *   ENTRADA (ancha)      TRAMO ESTRECHO (ondula)        ARENA (ancha)
 *   ┌──────────────┐     ╭────╮      ╭────╮             ┌──────────────┐
 *   │ Oráculo, aire│ ───▶│    ╰──────╯    │──────▶      │ Jefe, esquivar│
 *   └──────────────┘     ╰───────────────╯              └──────────────┘
 *
 * La entrada se abre para que el Oráculo (arriba del todo) siga siendo
 * alcanzable, y la arena final se abre para que las balas del Jefe se puedan
 * esquivar — un pasillo estrecho ahí volvería el tiroteo injusto.
 *
 * Todo en coordenadas de los PIES del personaje (`pos.y + alto`), no de su
 * esquina superior: es lo que "pisa" el suelo y lo único comparable entre
 * actores de distinta altura (Neo 160, el Jefe 240).
 *
 * Dominio puro: sin kaplay, sin DOM.
 */

export interface Banda {
  /** Y mínima (más al fondo) donde pueden estar los pies. */
  min: number;
  /** Y máxima (más al frente) donde pueden estar los pies. */
  max: number;
}

export interface OpcionesCamino {
  /** Semilla determinista: mismo módulo, mismo camino en cada partida. */
  semilla: number;
  /** Ancho total del nivel. */
  largo: number;
  /** Y mínima absoluta para los pies (borde de fondo del carril). */
  pisoMin: number;
  /** Y máxima absoluta para los pies (borde frontal del carril). */
  pisoMax: number;
  /** Semi-alto de la banda en el tramo estrecho. */
  semiAltoEstrecho: number;
  /** X donde empieza a cerrarse la entrada. */
  entradaDesde: number;
  /** X donde el camino ya está del todo estrecho. */
  entradaHasta: number;
  /** X donde empieza a abrirse la arena del Jefe. */
  arenaDesde: number;
  /** X donde la arena ya está del todo abierta. */
  arenaHasta: number;
}

export interface Camino {
  /** Centro (Y) de la banda pisable a esa X. */
  centroEn(x: number): number;
  /** Semi-alto de la banda pisable a esa X. */
  semiAltoEn(x: number): number;
  /** Límites donde pueden estar los pies a esa X. */
  bandaEn(x: number): Banda;
  /** Recorta una Y de pies a la banda de esa X. */
  acotarPies(x: number, pies: number): number;
  /**
   * 0 = tramo estrecho, 1 = zona abierta (entrada / arena). Lo usa el renderer
   * para dibujar el camino y para no sembrar decorado encima de la arena.
   */
  aperturaEn(x: number): number;
}

/** Una onda sinusoidal del serpenteo. */
interface Onda {
  amplitud: number;
  periodo: number;
  fase: number;
}

/**
 * Presupuesto de pendiente: la suma de `amplitud * 2π / periodo` de las ondas
 * es la pendiente máxima del camino. Con 0.75, avanzando a la velocidad tope
 * (220 px/s) hay que corregir a lo sumo ~165 px/s en vertical, por debajo de
 * los 220 px/s que da la flecha — o sea que la curva SIEMPRE se puede seguir.
 * Este número es el que hace que el camino sea exigente pero no injusto.
 */
export const PENDIENTE_MAXIMA = 0.75;

export function crearCamino(o: OpcionesCamino): Camino {
  const centroBase = (o.pisoMin + o.pisoMax) / 2;
  const semiAltoMaximo = (o.pisoMax - o.pisoMin) / 2;
  // El serpenteo no puede comerse más que el aire que sobra cuando el camino
  // está estrecho: así la banda nunca se sale del carril del nivel.
  const presupuestoAmplitud = Math.max(0, semiAltoMaximo - o.semiAltoEstrecho);

  const aleatorio = prng(o.semilla);
  // Dos armónicos: uno largo que da la forma general del recorrido y otro corto
  // que le quita la regularidad de "seno de libro" y lo vuelve pseudo random.
  const reparto = [0.68, 0.32];
  const rangosPeriodo: [number, number][] = [
    [620, 900],
    [340, 480],
  ];
  const ondas: Onda[] = reparto.map((parte, i) => ({
    amplitud: presupuestoAmplitud * parte,
    periodo: entre(aleatorio, rangosPeriodo[i][0], rangosPeriodo[i][1]),
    fase: entre(aleatorio, 0, Math.PI * 2),
  }));

  // Garantía dura de jugabilidad: si el sorteo dio una curva más empinada que
  // PENDIENTE_MAXIMA, se estiran los periodos hasta que deje de serlo. Es
  // preferible un camino algo más plano que uno imposible de seguir.
  const pendienteDe = (lista: Onda[]) =>
    lista.reduce((acc, onda) => acc + (onda.amplitud * 2 * Math.PI) / onda.periodo, 0);
  const pendiente = pendienteDe(ondas);
  if (pendiente > PENDIENTE_MAXIMA) {
    const factor = pendiente / PENDIENTE_MAXIMA;
    for (const onda of ondas) onda.periodo *= factor;
  }

  const serpenteo = (x: number) =>
    ondas.reduce((acc, onda) => acc + onda.amplitud * Math.sin((x / onda.periodo) * Math.PI * 2 + onda.fase), 0);

  const aperturaEn = (x: number) => {
    const cerrandoEntrada = suave((x - o.entradaDesde) / Math.max(1, o.entradaHasta - o.entradaDesde));
    const abriendoArena = suave((x - o.arenaDesde) / Math.max(1, o.arenaHasta - o.arenaDesde));
    return acotar(Math.max(1 - cerrandoEntrada, abriendoArena), 0, 1);
  };

  const semiAltoEn = (x: number) => mezclar(o.semiAltoEstrecho, semiAltoMaximo, aperturaEn(x));

  // En las zonas abiertas el camino vuelve al centro: la arena del Jefe y la
  // entrada son "cuartos", no tramos de recorrido, y no deben estar torcidos.
  const centroEn = (x: number) => centroBase + serpenteo(x) * (1 - aperturaEn(x));

  const bandaEn = (x: number): Banda => {
    const centro = centroEn(x);
    const semi = semiAltoEn(x);
    return { min: centro - semi, max: centro + semi };
  };

  return {
    centroEn,
    semiAltoEn,
    bandaEn,
    aperturaEn,
    acotarPies: (x, pies) => {
      const banda = bandaEn(x);
      return acotar(pies, banda.min, banda.max);
    },
  };
}
