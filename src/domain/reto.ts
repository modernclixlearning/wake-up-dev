/** Tipos del banco de retos. El contenido es data-driven: agregar un módulo = agregar JSON. */

export type TipoReto = "multiple-choice" | "abierta";

export interface RetoBase {
  id: string;
  modulo: string;
  tipo: TipoReto;
  pregunta: string;
  dificultad: 1 | 2 | 3;
  tags: string[];
  bonus2026: boolean;
}

export interface RetoMultipleChoice extends RetoBase {
  tipo: "multiple-choice";
  opciones: string[];
  /** Índice de la opción correcta dentro de `opciones`. */
  correcta: number;
  explicacion: string;
}

export interface RetoAbierta extends RetoBase {
  tipo: "abierta";
  /** Criterios gradeables que usa el evaluador IA (F6). */
  rubrica: string;
  /** Variante multiple-choice a usar cuando no hay IA disponible. */
  fallbackId: string;
}

export type Reto = RetoMultipleChoice | RetoAbierta;

export interface ModuloInfo {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface BancoModulo {
  modulo: ModuloInfo;
  retos: Reto[];
}

export function esMultipleChoice(reto: Reto): reto is RetoMultipleChoice {
  return reto.tipo === "multiple-choice";
}
