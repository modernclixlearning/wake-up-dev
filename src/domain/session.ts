/** Estado de la partida — vidas, score y progreso por módulo. */

export const VIDAS_INICIALES = 3;
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

  completarModulo(moduloId: string): void {
    this.progresoDe(moduloId).completado = true;
  }

  get derrotado(): boolean {
    return this.vidas <= 0;
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
