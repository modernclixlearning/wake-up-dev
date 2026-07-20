import { BancoModulo, esMultipleChoice, Reto, RetoMultipleChoice } from "./reto";

export interface ResultadoRespuesta {
  correcta: boolean;
  explicacion: string;
}

/**
 * Motor de retos de un módulo: entrega retos sin repetir y evalúa respuestas.
 * Dominio puro — sin dependencias del canvas ni de la capa IA.
 */
export class QuizEngine {
  private pendientes: Reto[];
  private readonly banco: BancoModulo;
  private readonly random: () => number;
  private readonly barajarOpciones: boolean;

  constructor(
    banco: BancoModulo,
    opts: { incluirBonus?: boolean; barajar?: boolean; barajarOpciones?: boolean; random?: () => number } = {}
  ) {
    this.banco = banco;
    const { incluirBonus = true, barajar = true, barajarOpciones = true, random = Math.random } = opts;
    this.random = random;
    this.barajarOpciones = barajarOpciones;
    this.pendientes = banco.retos.filter((r) => incluirBonus || !r.bonus2026);
    if (barajar) this.pendientes = shuffle(this.pendientes, this.random);
    // Los bancos se generan con la correcta casi siempre en la misma posición
    // (detectado jugando: en varios módulos el 100% caía en la opción 1) — sin
    // esto el jugador gana apretando siempre la misma tecla sin leer.
    if (this.barajarOpciones) {
      this.pendientes = this.pendientes.map((r) =>
        esMultipleChoice(r) ? barajarOpcionesDe(r, this.random) : r
      );
    }
  }

  get modulo() {
    return this.banco.modulo;
  }

  get restantes(): number {
    return this.pendientes.length;
  }

  /** Saca el siguiente reto del mazo, o null si el módulo está completo. */
  siguiente(): Reto | null {
    return this.pendientes.shift() ?? null;
  }

  /**
   * Smith adaptativo: saca el reto pendiente cuya dificultad esté más cerca
   * del nivel del jugador (1 flojo · 2 normal · 3 dominando). A igual distancia
   * respeta el orden del mazo.
   */
  siguienteAdaptativo(nivelJugador: 1 | 2 | 3): Reto | null {
    if (this.pendientes.length === 0) return null;
    let mejor = 0;
    for (let i = 1; i < this.pendientes.length; i++) {
      const dist = Math.abs(this.pendientes[i].dificultad - nivelJugador);
      const distMejor = Math.abs(this.pendientes[mejor].dificultad - nivelJugador);
      if (dist < distMejor) mejor = i;
    }
    return this.pendientes.splice(mejor, 1)[0];
  }

  responderMultipleChoice(reto: RetoMultipleChoice, indice: number): ResultadoRespuesta {
    if (indice < 0 || indice >= reto.opciones.length) {
      throw new RangeError(`Índice de opción fuera de rango: ${indice}`);
    }
    return { correcta: indice === reto.correcta, explicacion: reto.explicacion };
  }

  /** Resuelve la variante multiple-choice de un reto abierto cuando no hay IA. */
  fallbackDe(fallbackId: string): RetoMultipleChoice | null {
    const reto = this.banco.retos.find((r) => r.id === fallbackId);
    if (!reto || reto.tipo !== "multiple-choice") return null;
    return this.barajarOpciones ? barajarOpcionesDe(reto, this.random) : reto;
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Baraja el orden de las opciones de un reto y remapea el índice de la
 * correcta. Devuelve una copia — el reto original (banco.retos, el JSON
 * cargado en memoria) no se muta, así que barajar no contamina otras partidas
 * ni otros QuizEngine sobre el mismo banco.
 */
function barajarOpcionesDe(reto: RetoMultipleChoice, random: () => number): RetoMultipleChoice {
  const indices = shuffle(
    reto.opciones.map((_, i) => i),
    random
  );
  return {
    ...reto,
    opciones: indices.map((i) => reto.opciones[i]),
    correcta: indices.indexOf(reto.correcta),
  };
}
