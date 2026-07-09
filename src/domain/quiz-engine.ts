import { BancoModulo, Reto, RetoMultipleChoice } from "./reto";

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

  constructor(banco: BancoModulo, opts: { incluirBonus?: boolean; barajar?: boolean } = {}) {
    this.banco = banco;
    const { incluirBonus = true, barajar = true } = opts;
    this.pendientes = banco.retos.filter((r) => incluirBonus || !r.bonus2026);
    if (barajar) this.pendientes = shuffle(this.pendientes);
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
    return reto && reto.tipo === "multiple-choice" ? reto : null;
  }
}

function shuffle<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
