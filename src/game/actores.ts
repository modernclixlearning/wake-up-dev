import { GameObj, KAPLAYCtx } from "kaplay";
import { BLANCO, NEGRO, ROJO, VERDE } from "./theme";

/**
 * Personajes del juego (F11 v3): sprites reales de 64x80 generados desde
 * referencias IA con el pipeline de tools/pixel-art/ (reducir + componer).
 * El objeto padre define la posición y el área de colisión (mismos tags que
 * siempre: "player" / "agente" / "oraculo"); el sprite es un hijo puramente
 * visual (anchor top-left, igual que el resto del juego) escalado a una
 * fracción exacta del frame para que la reducción sea uniforme.
 */

const FRAME_ANCHO = 64;
const FRAME_ALTO = 80;

// En pantalla cada personaje va a 96x160 — pedido del alumno tras el playtest:
// personajes grandes (~3x) achican el pasillo relativo y hacen a los Agentes
// más difíciles de esquivar. La escala es ANISOTRÓPICA a propósito (x1.5 de
// ancho, x2 de alto): las referencias del alumno tienen proporción ~0.55
// (ancho/alto) pero el frame maestro 64x80 es 0.8 — el pipeline los aplastó al
// encajarlos en ese lienzo, y a este tamaño se nota. Estirar el alto en
// pantalla recupera la silueta de la referencia; el canvas ya se re-escala con
// letterbox, así que no hay grilla de píxeles perfecta que preservar (`crisp`
// mantiene los bordes duros).
export const ANCHO_NEO = FRAME_ANCHO * 1.5;
export const ALTO_NEO = FRAME_ALTO * 2;
export const ANCHO_AGENTE = FRAME_ANCHO * 1.5;
export const ALTO_AGENTE = FRAME_ALTO * 2;
/** El Jefe usa su propio sheet (más corpulento) y además se dibuja 1.5x (144x240). */
export const ESCALA_JEFE = 1.5;

export interface ActorAgente {
  root: GameObj;
  ancho: number;
  alto: number;
}

/**
 * Carga los sprites externos del juego (F11 v3). Llamar una sola vez tras
 * inicializar Kaplay, antes de entrar a las escenas: Kaplay muestra su
 * pantalla de carga hasta que los assets estén listos.
 *
 * Sheets generados con `npm run pixel:sheet` desde los frames aprobados de
 * `tools/pixel-art/salida/64x80/`.
 */
export function cargarSprites(k: KAPLAYCtx): void {
  const animsCombate = {
    idle: 0,
    walk: { from: 1, to: 2, speed: 6, loop: true },
    ataque: 3,
    derrota: 4,
  };
  k.loadSprite("neo", "sprites/neo.png", {
    sliceX: 6,
    sliceY: 1,
    anims: {
      idle: 0,
      walk: { from: 1, to: 2, speed: 6, loop: true },
      ataque: 3,
      alerta: 4,
      // Frame de F12 (neo-disparo.pixelmap.txt): la misma pose de ataque pero
      // con la escopeta — se usa al disparar contra el Jefe, la piña va sin arma.
      disparo: 5,
    },
  });
  k.loadSprite("smith", "sprites/smith.png", { sliceX: 5, sliceY: 1, anims: animsCombate });
  k.loadSprite("jefe", "sprites/jefe.png", { sliceX: 5, sliceY: 1, anims: animsCombate });
  k.loadSprite("oraculo", "sprites/oraculo.png", {
    sliceX: 3,
    sliceY: 1,
    anims: { idle: 0, habla: 1, bye: 2 },
  });
}

/**
 * Corrección de proporciones por pose. El pipeline estampó CADA referencia a
 * llenar el frame 64x80 completo, así que cada frame tiene una distorsión
 * distinta: las poses anchas (ataque con el brazo extendido, caídas) quedan
 * comprimidas horizontalmente si se dibujan con la escala base. Los factores
 * salen de medir los bounding boxes de las refs (docs/character-refs/):
 * `fw` = ancho de la pose / ancho del idle, `fh` = alto de la pose / alto del
 * idle — es decir, cuánto más ancho/alto es ese frame que el idle A ESCALA
 * REAL del personaje. Los frames cuyo contenido no llena el 64x80 (quedan
 * 64x71 alineados abajo: jefe-ataque, smith-derrota) llevan además el factor
 * 80/71 en fh para compensar el margen transparente.
 */
interface FactorPose {
  fw: number;
  fh: number;
}

const POSES_NEO: Record<string, FactorPose> = {
  ataque: { fw: 1.81, fh: 0.86 },
  // Referencia propia (neo-disparo.png, F12): aspecto 0.850 vs 0.462 del idle.
  disparo: { fw: 1.75, fh: 0.95 },
  alerta: { fw: 1.37, fh: 0.89 },
};
const POSES_SMITH: Record<string, FactorPose> = {
  ataque: { fw: 2.32, fh: 0.94 },
  derrota: { fw: 2.19, fh: 1.22 },
};
const POSES_JEFE: Record<string, FactorPose> = {
  // Desde F12 el frame de ataque es jefe-disparo.png (pistola empuñada):
  // aspecto 1.142 vs 0.658 del idle.
  ataque: { fw: 1.56, fh: 0.9 },
  derrota: { fw: 1.55, fh: 0.89 },
};
// No es corrección de aspecto sino zoom de conversación (pedido del alumno):
// el Oráculo se agranda mientras habla para seguir presente con el chat DOM
// abierto. Solo afecta al sprite — el área de colisión no cambia, así que el
// reposicionamiento de Neo al cerrar el chat sigue cayendo fuera del área.
// El zoom es CENTRADO (ver anclaje en crearOraculo): crece simétrico, no hacia
// arriba, así no pisa la status bar. Moderado (1.3) para no tapar a Neo al lado.
const POSES_ORACULO: Record<string, FactorPose> = {
  habla: { fw: 1.3, fh: 1.3 },
  bye: { fw: 1.3, fh: 1.3 },
};

interface EstadoSprite {
  skin: GameObj;
  ancho: number;
  alto: number;
  /** Pose manual fijada desde la escena; null = walk/idle automático según movimiento. */
  pose: string | null;
  animActual: string;
  mirandoIzquierda: boolean;
  poses: Record<string, FactorPose>;
  /** "pies" (default): el zoom crece hacia arriba, pies anclados al piso.
   *  "centro": crece simétrico desde el centro (Oráculo, para no pisar el HUD). */
  anclaje: "pies" | "centro";
}

const estadosSprite = new WeakMap<GameObj, EstadoSprite>();

function aplicarSprite(estado: EstadoSprite, anim: string): void {
  if (estado.animActual !== anim) {
    estado.animActual = anim;
    estado.skin.play(anim);
  }
  const factor = estado.poses[anim];
  const ancho = estado.ancho * (factor?.fw ?? 1);
  const alto = estado.alto * (factor?.fh ?? 1);
  estado.skin.scale.x = ancho / FRAME_ANCHO;
  estado.skin.scale.y = alto / FRAME_ALTO;
  estado.skin.flipX = estado.mirandoIzquierda;
  if (estado.anclaje === "centro") {
    // Zoom simétrico desde el centro: no crece hacia el HUD (mantiene el gap
    // con la status bar) ni hacia el piso de golpe. El Oráculo flota igual.
    estado.skin.pos.y = (estado.alto - alto) / 2;
    estado.skin.pos.x = (estado.ancho - ancho) / 2;
  } else {
    // Pies en el piso (las poses más bajas no deben flotar) y, si el frame está
    // espejado, el ancho extra de la pose crece hacia la izquierda — el cuerpo
    // queda sobre el actor y el brazo/caída se extiende hacia el rival.
    estado.skin.pos.y = estado.alto - alto;
    estado.skin.pos.x = estado.mirandoIzquierda ? estado.ancho - ancho : 0;
  }
}

/**
 * Monta el sprite visual de un actor y su animación automática: camina cuando
 * el actor se mueve (con flip según la dirección), idle cuando está quieto, y
 * respeta la pose manual fijada con `fijarPose` mientras esté activa.
 */
function montarSprite(
  k: KAPLAYCtx,
  actor: GameObj,
  nombre: string,
  ancho: number,
  alto: number,
  opciones: { caminata: boolean; poses?: Record<string, FactorPose>; anclaje?: "pies" | "centro" }
): EstadoSprite {
  const skin = actor.add([
    k.sprite(nombre, { anim: "idle" }),
    k.pos(0, 0),
    // Escala por eje (ver nota sobre las proporciones junto a ANCHO_NEO).
    k.scale(k.vec2(ancho / FRAME_ANCHO, alto / FRAME_ALTO)),
  ]);
  const estado: EstadoSprite = {
    skin,
    ancho,
    alto,
    pose: null,
    animActual: "idle",
    mirandoIzquierda: false,
    poses: opciones.poses ?? {},
    anclaje: opciones.anclaje ?? "pies",
  };
  estadosSprite.set(actor, estado);

  let anterior = actor.pos.clone();
  let tPaso = 0;
  actor.onUpdate(() => {
    const dx = actor.pos.x - anterior.x;
    const distancia = actor.pos.dist(anterior);
    anterior = actor.pos.clone();
    if (Math.abs(dx) > 0.5) estado.mirandoIzquierda = dx < 0;
    if (estado.pose) {
      aplicarSprite(estado, estado.pose);
      return;
    }
    const caminando = opciones.caminata && distancia > 0.5;
    aplicarSprite(estado, caminando ? "walk" : "idle");
    // Mini-bob de 1px al ritmo de los pasos (~3 por segundo, igual que la
    // anim walk de 6fps con 2 frames): vende el pisado y evita el efecto
    // "deslizamiento". Solo para actores que caminan — el Oráculo flota con
    // su propia oscilación (animarIdle) y no hay que pisársela.
    if (opciones.caminata) {
      if (caminando) {
        tPaso += k.dt() * Math.PI * 6;
        estado.skin.pos.y = Math.sin(tPaso) > 0 ? -1 : 0;
      } else {
        tPaso = 0;
        estado.skin.pos.y = 0;
      }
    }
  });
  return estado;
}

/** Fija (o libera, con null) una pose manual — ataque/alerta de Neo, ataque/derrota de Agentes, habla/bye del Oráculo. */
export function fijarPose(actor: GameObj, pose: string | null): void {
  const estado = estadosSprite.get(actor);
  if (!estado) return;
  estado.pose = pose;
  aplicarSprite(estado, pose ?? "idle");
}

/**
 * Orienta a un actor hacia una x del mundo — las poses manuales no deben
 * heredar la última dirección de caminata: el ataque mira al rival y la
 * alerta de Neo a las balas (que siempre entran por la derecha).
 */
export function orientarHacia(actor: GameObj, xObjetivo: number): void {
  const estado = estadosSprite.get(actor);
  if (!estado) return;
  estado.mirandoIzquierda = xObjetivo < actor.pos.x + estado.ancho / 2;
  aplicarSprite(estado, estado.animActual);
}

/** Idle bob: leve oscilación vertical constante (el Oráculo "flota").
 * Aditivo, no absoluto: aplicarSprite (update del padre, corre antes) ya dejó
 * la y con los pies anclados según la pose; escribir una y absoluta acá
 * pisaría ese anclaje cuando la pose agranda el sprite (zoom de conversación). */
function animarIdle(k: KAPLAYCtx, parte: GameObj, amplitud = 1.5): void {
  let t = Math.random() * 10;
  parte.onUpdate(() => {
    t += k.dt() * 4;
    parte.pos.y += Math.sin(t) * amplitud;
  });
}

/** Área de colisión rectangular con origen en el top-left del actor (igual que sus partes visuales). */
function areaRectangular(k: KAPLAYCtx, ancho: number, alto: number) {
  return k.area({ shape: new k.Rect(k.vec2(0, 0), ancho, alto) });
}

/** Neo (jugador): idle, ciclo de caminata, ataque y alerta. El frame de alerta
 * cae con la cabeza hacia la izquierda; sin flip cuando el rival está a la
 * derecha, Neo se arquea hacia atrás, alejándose del golpe (pedido del alumno). */
export function crearNeo(k: KAPLAYCtx, x: number, y: number): GameObj {
  const neo = k.add([k.pos(x, y), areaRectangular(k, ANCHO_NEO, ALTO_NEO), k.z(2), "player"]);
  montarSprite(k, neo, "neo", ANCHO_NEO, ALTO_NEO, { caminata: true, poses: POSES_NEO });
  return neo;
}

/** Agente Smith / Jefe: idle, caminata (persecución), ataque (te quita una vida) y derrota (antes de la explosión). */
export function crearAgente(k: KAPLAYCtx, x: number, y: number, esJefe = false): ActorAgente {
  const escala = esJefe ? ESCALA_JEFE : 1;
  const ancho = ANCHO_AGENTE * escala;
  const alto = ALTO_AGENTE * escala;
  const tags = esJefe ? ["agente", "jefe"] : ["agente"];
  const root = k.add([k.pos(x, y), areaRectangular(k, ancho, alto), k.z(1), ...tags]);
  if (esJefe) {
    root.add([k.rect(ancho + 6, alto + 6), k.pos(-3, -3), k.color(...ROJO), k.opacity(0.18), k.z(-1)]);
  }
  montarSprite(k, root, esJefe ? "jefe" : "smith", ancho, alto, {
    caminata: true,
    poses: esJefe ? POSES_JEFE : POSES_SMITH,
  });
  return { root, ancho, alto };
}

/** El Oráculo: NPC sereno que flota (el aura verde viene incorporada en el sprite). */
export function crearOraculo(k: KAPLAYCtx, x: number, y: number): GameObj {
  const ancho = ANCHO_AGENTE;
  const alto = ALTO_AGENTE;
  const oraculo = k.add([k.pos(x, y), areaRectangular(k, ancho, alto), k.z(1), "oraculo"]);
  const estado = montarSprite(k, oraculo, "oraculo", ancho, alto, {
    caminata: false,
    poses: POSES_ORACULO,
    anclaje: "centro",
  });
  animarIdle(k, estado.skin, 1.2);
  return oraculo;
}

/** Flash breve de golpe: superpone un rect semitransparente sobre el actor. */
export function flashGolpe(
  k: KAPLAYCtx,
  actor: GameObj,
  ancho: number,
  alto: number,
  color: [number, number, number],
  duracion = 0.12
): void {
  const flash = actor.add([k.rect(ancho, alto), k.color(...color), k.opacity(0.55), k.z(5)]);
  k.wait(duracion, () => k.destroy(flash));
}

/** Explosión simple al derrotar a un Agente: partículas = rects que se dispersan y desaparecen. */
export function crearExplosion(k: KAPLAYCtx, x: number, y: number): void {
  const colores: Array<[number, number, number]> = [ROJO, BLANCO, NEGRO];
  for (let i = 0; i < 10; i++) {
    const angulo = (Math.PI * 2 * i) / 10 + k.rand(-0.3, 0.3);
    const velocidad = k.rand(90, 200);
    const particula = k.add([
      k.rect(6, 6),
      k.pos(x, y),
      k.color(...k.choose(colores)),
      k.opacity(0.9),
      k.move(k.vec2(Math.cos(angulo), Math.sin(angulo)), velocidad),
      k.z(6),
    ]);
    k.wait(0.4, () => k.destroy(particula));
  }
}

export interface BarraHP {
  actualizar(hpActual: number, hpMaximo: number): void;
}

/** Barra de HP como hija del actor: sigue su posición automáticamente al moverse. */
export function crearBarraHP(k: KAPLAYCtx, actor: GameObj, ancho: number): BarraHP {
  const alto = 6;
  const y = -12;
  actor.add([k.rect(ancho, alto), k.pos(0, y), k.color(...NEGRO), k.z(4)]);
  const relleno = actor.add([k.rect(ancho, alto), k.pos(0, y), k.color(...VERDE), k.z(5)]);
  return {
    actualizar(hpActual: number, hpMaximo: number) {
      const proporcion = hpMaximo > 0 ? Math.max(0, hpActual) / hpMaximo : 0;
      relleno.width = ancho * proporcion;
      relleno.color = k.rgb(...(proporcion > 0.34 ? VERDE : ROJO));
    },
  };
}
