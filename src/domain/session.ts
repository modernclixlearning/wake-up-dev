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

/**
 * Snapshot serializable del avance (persistencia): score y progreso por módulo.
 * Las vidas NO se guardan a propósito — cada sesión arranca con las vidas
 * llenas; lo que persiste es lo aprendido (módulos liberados) y el score.
 */
export interface SesionGuardada {
  version: 1;
  score: number;
  progreso: Array<{ moduloId: string } & ProgresoModulo>;
}

export function serializarSesion(session: GameSession): SesionGuardada {
  return {
    version: 1,
    score: session.score,
    progreso: [...session.progreso.entries()].map(([moduloId, p]) => ({ moduloId, ...p })),
  };
}

/**
 * Reconstruye una sesión desde datos externos (p.ej. localStorage): tolerante
 * a basura — ante cualquier forma inesperada devuelve una sesión nueva en vez
 * de romper el juego (misma invariante que la capa IA).
 */
export function restaurarSesion(datos: unknown): GameSession {
  const session = new GameSession();
  if (typeof datos !== "object" || datos === null) return session;
  const d = datos as Partial<SesionGuardada>;
  if (d.version !== 1 || typeof d.score !== "number" || !Array.isArray(d.progreso)) return session;
  session.score = Math.max(0, d.score);
  for (const p of d.progreso) {
    if (typeof p !== "object" || p === null || typeof p.moduloId !== "string") continue;
    session.progreso.set(p.moduloId, {
      completado: p.completado === true,
      aciertos: typeof p.aciertos === "number" && p.aciertos >= 0 ? p.aciertos : 0,
      fallos: typeof p.fallos === "number" && p.fallos >= 0 ? p.fallos : 0,
    });
  }
  return session;
}
