/** Estado de la partida — vidas, score y progreso por módulo. */

// 5 desde F12: con el combate arcade hay dos fuentes de daño (fallar preguntas
// y comer golpes físicos) — con 3 vidas el nivel quedaba injustamente cruel.
export const VIDAS_INICIALES = 5;
export const PUNTOS_POR_ACIERTO = 100;
export const PUNTOS_BONUS_2026 = 150;

export interface ProgresoModulo {
  completado: boolean;
  aciertos: number;
  fallos: number;
}

export class GameSession {
  vidas = VIDAS_INICIALES;
  score = 0;
  progreso = new Map<string, ProgresoModulo>();

  registrarAcierto(moduloId: string, esBonus: boolean): void {
    this.score += esBonus ? PUNTOS_BONUS_2026 : PUNTOS_POR_ACIERTO;
    this.progresoDe(moduloId).aciertos++;
  }

  registrarFallo(moduloId: string): void {
    this.vidas--;
    this.progresoDe(moduloId).fallos++;
  }

  /**
   * Golpe físico de un enemigo (F12): cuesta una vida pero NO cuenta como
   * fallo del módulo — el Smith adaptativo mide conocimiento, no reflejos.
   */
  recibirGolpeFisico(): void {
    this.vidas--;
  }

  completarModulo(moduloId: string): void {
    this.progresoDe(moduloId).completado = true;
  }

  get derrotado(): boolean {
    return this.vidas <= 0;
  }

  /**
   * Nivel de desempeño del jugador en un módulo (Smith adaptativo):
   * 1 = flojo (2+ fallos), 3 = dominando (3+ aciertos sin fallos), 2 = resto.
   */
  nivelJugador(moduloId: string): 1 | 2 | 3 {
    const p = this.progreso.get(moduloId);
    if (!p) return 2;
    if (p.fallos >= 2) return 1;
    if (p.aciertos >= 3 && p.fallos === 0) return 3;
    return 2;
  }

  private progresoDe(moduloId: string): ProgresoModulo {
    let p = this.progreso.get(moduloId);
    if (!p) {
      p = { completado: false, aciertos: 0, fallos: 0 };
      this.progreso.set(moduloId, p);
    }
    return p;
  }
}
