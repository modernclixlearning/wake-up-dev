import { GameObj, KAPLAYCtx, KEventController, Key } from "kaplay";
import { hayIA } from "../../ai/factory";
import {
  calcularBonusEsquive,
  crearCombate,
  derrotado,
  EstadoCombate,
  golpear,
  HP_AGENTE_NORMAL,
  HP_JEFE,
} from "../../domain/combate";
import { QuizEngine } from "../../domain/quiz-engine";
import { Reto, RetoAbierta, RetoMultipleChoice } from "../../domain/reto";
import {
  ActorAgente,
  ALTO_AGENTE,
  ALTO_NEO,
  ANCHO_AGENTE,
  ANCHO_NEO,
  BarraHP,
  crearAgente,
  crearBarraHP,
  crearExplosion,
  crearNeo,
  crearOraculo,
  fijarPose,
  flashGolpe,
  orientarHacia,
} from "../actores";
import { dibujarEscenario } from "../escenario";
import { GameState } from "../state";
import { ANCHO, ALTO, CARRIL_INFERIOR, CARRIL_SUPERIOR, VERDE, VERDE_OSCURO, ROJO, BLANCO, NEGRO } from "../theme";
import { abrirOraculo, abrirRetoAbierto, hayOverlayAbierto } from "../ui/overlay";

const VELOCIDAD = 220;
const VELOCIDAD_AGENTE = 100;
const MAX_AGENTES = 4;

// Diseño del nivel como pasillo horizontal (F11 v2, tipo Double Dragon/Mario):
// Neo arranca a la izquierda, los Agentes están repartidos a lo largo del
// recorrido y la cámara lo sigue; el Jefe y el portal de salida quedan al final.
const MARGEN_INICIO = 160;
const SEPARACION_AGENTE = 420;
const MARGEN_JEFE = 460;
const MARGEN_PORTAL = 200;

interface Combate {
  estado: EstadoCombate;
  barra: BarraHP;
  ancho: number;
  alto: number;
  /** Solo el Agente "activo" persigue a Neo (F11 v2): el resto espera su turno quieto. */
  activo: boolean;
}

/** Golpes del esquive bullet-time: reutiliza las flechas de movimiento, sin inputs nuevos. */
const FLECHAS: Array<{ tecla: Key; simbolo: string }> = [
  { tecla: "up", simbolo: "^" },
  { tecla: "down", simbolo: "v" },
  { tecla: "left", simbolo: "<" },
  { tecla: "right", simbolo: ">" },
];
const GOLPES_POR_RONDA = 3;
const DURACION_GOLPE = 0.9;

export function registrarLevel(k: KAPLAYCtx, estado: () => GameState): void {
  k.scene("level", ({ moduloId }: { moduloId: string }) => {
    const st = estado();
    const banco = st.bancos.find((b) => b.modulo.id === moduloId);
    if (!banco) {
      k.go("zion");
      return;
    }
    const quiz = new QuizEngine(banco);
    const respondidos = new Set<string>();
    const combates = new Map<GameObj, Combate>();
    /** Agentes en su animación de derrota (F11 v3): siguen en pantalla ~0.6s
     * antes de explotar, pero ya no deben disparar encuentros nuevos. */
    const muriendo = new Set<GameObj>();
    let enEncuentro = false;
    let jefeApareceUnaVez = false;
    const bloqueado = () => enEncuentro || hayOverlayAbierto();

    const nAgentes = Math.min(MAX_AGENTES, quiz.restantes);
    const anchoNivel = MARGEN_INICIO + Math.max(1, nAgentes) * SEPARACION_AGENTE + MARGEN_JEFE + MARGEN_PORTAL;

    dibujarEscenario(k, moduloId, anchoNivel);

    // HUD: fijo a la pantalla (k.fixed) — sin esto, al mover la cámara con el
    // scroll del pasillo el texto se iría del cuadro junto con el mundo.
    const hud = k.add([k.text("", { size: 16 }), k.pos(16, 12), k.color(...VERDE), k.z(5), k.fixed()]);
    const actualizarHud = () => {
      hud.text = `${banco.modulo.nombre}  |  Vidas: ${st.session.vidas}  Score: ${st.session.score}  Agentes: ${k.get("agente").length}`;
    };

    // Jugador (Neo)
    const player = crearNeo(k, 60, ALTO / 2);

    // El Oráculo (NPC): cerca del inicio del pasillo.
    const oraculo = crearOraculo(k, 70, CARRIL_SUPERIOR + 20);
    k.add([
      k.text("Oráculo", { size: 12 }),
      k.pos(70, CARRIL_SUPERIOR + 20 + ALTO_AGENTE + 6),
      k.color(...VERDE_OSCURO),
      k.z(1),
    ]);

    // Cola de Agentes normales en orden de aparición (F11 v2): solo el primero
    // persigue a Neo; el resto queda quieto hasta que le toca su turno.
    const colaAgentes: GameObj[] = [];

    // Marca a un Agente como "activo": empieza a perseguir a Neo y muestra un aviso.
    const marcarActivo = (agente: GameObj) => {
      const combate = combates.get(agente);
      if (!combate || combate.activo) return;
      combate.activo = true;
      agente.add([k.text("!", { size: 20 }), k.pos(combate.ancho / 2 - 5, -38), k.color(...ROJO), k.z(6)]);
    };

    // Al caer el Agente activo, le pasa el turno al siguiente de la cola que siga con vida.
    const activarSiguienteEnCola = () => {
      const siguiente = colaAgentes.find((a) => combates.get(a) && !combates.get(a)!.activo);
      if (siguiente) marcarActivo(siguiente);
    };

    // Persecución (F11 v2): mientras esté activo y el juego no esté bloqueado
    // (esquive/pregunta/overlay en curso), el Agente avanza hacia Neo — así el
    // encuentro lo busca a él, no al revés (pedido explícito tras el playtest).
    const iniciarPersecucion = (agente: GameObj) => {
      agente.onUpdate(() => {
        const combate = combates.get(agente);
        if (!combate || !combate.activo || bloqueado()) return;
        const hacia = player.pos.sub(agente.pos);
        const distancia = hacia.len();
        if (distancia > 4) {
          const paso = Math.min(1, (VELOCIDAD_AGENTE * k.dt()) / distancia);
          agente.pos = agente.pos.add(hacia.scale(paso));
        }
        agente.pos.y = k.clamp(agente.pos.y, CARRIL_SUPERIOR, CARRIL_INFERIOR - combate.alto);
      });
    };

    // Registra el estado de combate de un Agente recién creado (barra de HP incluida).
    const registrarCombate = (info: ActorAgente, hpMaximo: number) => {
      const barra = crearBarraHP(k, info.root, info.ancho);
      const estadoCombate = crearCombate(hpMaximo);
      barra.actualizar(estadoCombate.hpActual, estadoCombate.hpMaximo);
      combates.set(info.root, { estado: estadoCombate, barra, ancho: info.ancho, alto: info.alto, activo: false });
      iniciarPersecucion(info.root);
    };

    // Agentes Smith: repartidos a lo largo del pasillo, en el mismo orden en que se enfrentan.
    for (let i = 0; i < nAgentes; i++) {
      const x = MARGEN_INICIO + (i + 1) * SEPARACION_AGENTE;
      const y = k.rand(CARRIL_SUPERIOR + 10, CARRIL_INFERIOR - ALTO_AGENTE);
      const info = crearAgente(k, x, y);
      registrarCombate(info, HP_AGENTE_NORMAL);
      colaAgentes.push(info.root);
    }
    if (colaAgentes.length > 0) marcarActivo(colaAgentes[0]);
    actualizarHud();

    // Movimiento: Neo avanza libre dentro del carril; la cámara lo sigue en el eje X.
    k.onKeyDown("left", () => !bloqueado() && player.move(-VELOCIDAD, 0));
    k.onKeyDown("right", () => !bloqueado() && player.move(VELOCIDAD, 0));
    k.onKeyDown("up", () => !bloqueado() && player.move(0, -VELOCIDAD));
    k.onKeyDown("down", () => !bloqueado() && player.move(0, VELOCIDAD));
    player.onUpdate(() => {
      player.pos.x = k.clamp(player.pos.x, 0, anchoNivel - ANCHO_NEO);
      player.pos.y = k.clamp(player.pos.y, CARRIL_SUPERIOR, CARRIL_INFERIOR - ALTO_NEO);
      const camX = k.clamp(player.pos.x, ANCHO / 2, Math.max(ANCHO / 2, anchoNivel - ANCHO / 2));
      k.setCamPos(camX, ALTO / 2);
    });

    const mostrarFeedback = (ok: boolean, texto: string) => {
      const msg = k.add([
        k.text(`${ok ? "CORRECTO" : "FALLASTE"} — ${texto}`, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 46),
        k.color(...(ok ? VERDE : ROJO)),
        k.z(6),
        k.fixed(),
      ]);
      k.wait(4, () => k.destroy(msg));
    };

    const comprobarNivelLimpio = () => {
      if (st.session.derrotado) return;
      if (k.get("agente").length > 0) return;
      if (!jefeApareceUnaVez) {
        jefeApareceUnaVez = true;
        spawnJefe();
        return;
      }
      st.session.completarModulo(moduloId);
      // Portal a escala de Neo (160 de alto): una salida más baja que el
      // jugador se veía absurda con los sprites 3x.
      const portal = k.add([
        k.rect(56, 180),
        k.pos(anchoNivel - 100, ALTO / 2 - 90),
        k.area(),
        k.color(...VERDE_OSCURO),
        k.outline(3, k.rgb(...VERDE)),
        k.z(1),
        "portal",
      ]);
      portal.add([k.text("EXIT", { size: 12 }), k.pos(13, 84), k.color(...VERDE)]);
      player.onCollide("portal", () => k.go("zion"));
    };

    // Jefe de nivel (F11): tras limpiar los Agentes normales, uno más fuerte cierra el módulo.
    const spawnJefe = () => {
      mostrarFeedback(true, "Un Agente Smith más fuerte bloquea la salida...");
      const info = crearAgente(k, anchoNivel - MARGEN_PORTAL - 80, ALTO / 2, true);
      // Centrado vertical en el carril: con 240 de alto, ALTO/2 lo dejaría
      // con los pies fuera del límite inferior.
      info.root.pos.y = CARRIL_SUPERIOR + (CARRIL_INFERIOR - CARRIL_SUPERIOR - info.alto) / 2;
      registrarCombate(info, HP_JEFE);
      marcarActivo(info.root);
      actualizarHud();
    };

    // Resultado de una ronda de combate contra un Agente concreto (F11: multi-golpe).
    const registrarResultado = (agente: GameObj, correcta: boolean, feedback: string, esBonus: boolean) => {
      enEncuentro = false;
      if (correcta) {
        st.session.registrarAcierto(moduloId, esBonus);
        const combate = combates.get(agente);
        if (!combate) {
          // Sin estado de combate registrado: red de seguridad, comportamiento anterior (1 golpe = 1 baja).
          k.destroy(agente);
          mostrarFeedback(true, feedback);
          actualizarHud();
          comprobarNivelLimpio();
          return;
        }
        combate.estado = golpear(combate.estado);
        combate.barra.actualizar(combate.estado.hpActual, combate.estado.hpMaximo);
        // Pose de ataque (F11 v3): acompaña al flash de golpe sobre el Agente.
        orientarHacia(player, agente.pos.x + combate.ancho / 2);
        fijarPose(player, "ataque");
        k.wait(0.35, () => fijarPose(player, null));
        flashGolpe(k, agente, combate.ancho, combate.alto, BLANCO);
        if (derrotado(combate.estado)) {
          // Derrota (F11 v3): el Agente cae (frame "derrota") y recién después
          // explota — `muriendo` evita que dispare encuentros en esa ventana.
          combates.delete(agente);
          muriendo.add(agente);
          fijarPose(agente, "derrota");
          mostrarFeedback(true, feedback);
          k.wait(0.6, () => {
            crearExplosion(k, agente.pos.x + combate.ancho / 2, agente.pos.y + combate.alto / 2);
            k.destroy(agente);
            actualizarHud();
            activarSiguienteEnCola();
            comprobarNivelLimpio();
          });
          return;
        }
        mostrarFeedback(true, `${feedback}  (Agente ${combate.estado.hpActual}/${combate.estado.hpMaximo} HP)`);
        actualizarHud();
        k.wait(0.9, () => iniciarEncuentro(agente));
        return;
      }
      st.session.registrarFallo(moduloId);
      // El Agente conecta su golpe (F11 v3): pose de ataque mirando a Neo.
      const combateAgente = combates.get(agente);
      if (combateAgente) {
        orientarHacia(agente, player.pos.x + ANCHO_NEO / 2);
        fijarPose(agente, "ataque");
        k.wait(0.5, () => {
          if (agente.exists()) fijarPose(agente, null);
        });
      }
      flashGolpe(k, player, ANCHO_NEO, ALTO_NEO, ROJO);
      // Rebote hacia atrás (no un teleport al inicio del pasillo): te aleja del
      // Agente sin regalarte terreno recorrido ni perder la orientación del nivel.
      // El offset descuenta el ancho de Neo: con el sprite 3x, un margen fijo
      // chico lo dejaba todavía en colisión y reabría el encuentro al instante.
      player.pos = k.vec2(k.clamp(agente.pos.x - (ANCHO_NEO + 60), 0, anchoNivel - ANCHO_NEO), player.pos.y);
      mostrarFeedback(false, feedback);
      actualizarHud();
      if (st.session.derrotado) {
        k.wait(1.6, () => k.go("gameover"));
        return;
      }
      k.wait(0.9, () => iniciarEncuentro(agente));
    };

    // Encuentro clásico: pregunta de opciones en el canvas (teclas 1-4).
    const encuentroMultipleChoice = (agente: GameObj, reto: RetoMultipleChoice) => {
      enEncuentro = true;
      const overlay: GameObj[] = [];
      const teclas: KEventController[] = [];

      overlay.push(
        k.add([
          k.rect(ANCHO - 80, ALTO - 120),
          k.pos(40, 60),
          k.color(...NEGRO),
          k.outline(3, k.rgb(...VERDE)),
          k.opacity(0.95),
          k.z(10),
          k.fixed(),
        ]),
        k.add([
          k.text("AGENTE SMITH TE BLOQUEA — responde:", { size: 16 }),
          k.pos(60, 80),
          k.color(...ROJO),
          k.z(11),
          k.fixed(),
        ]),
        k.add([
          k.text(reto.pregunta, { size: 20, width: ANCHO - 160 }),
          k.pos(60, 115),
          k.color(...BLANCO),
          k.z(11),
          k.fixed(),
        ])
      );
      reto.opciones.forEach((op, i) => {
        overlay.push(
          k.add([
            k.text(`${i + 1}) ${op}`, { size: 17, width: ANCHO - 160 }),
            k.pos(80, 215 + i * 55),
            k.color(...VERDE),
            k.z(11),
            k.fixed(),
          ])
        );
      });

      // Smith adaptativo (F9): si venís fallando y hay IA, podés pedir una pista.
      const conPista = hayIA(st.ai) && st.session.nivelJugador(moduloId) === 1;
      if (conPista) {
        const aviso = k.add([
          k.text("P) Pedir una pista al Oráculo", { size: 14 }),
          k.pos(60, ALTO - 100),
          k.color(...VERDE_OSCURO),
          k.z(11),
          k.fixed(),
        ]);
        overlay.push(aviso);
        let pistaPedida = false;
        teclas.push(
          k.onKeyPress("p" as never, async () => {
            if (!enEncuentro || pistaPedida) return;
            pistaPedida = true;
            aviso.text = "El Oráculo susurra...";
            try {
              const pista = await st.ai.generarPista(reto);
              if (enEncuentro) aviso.text = `Oráculo: ${pista}`;
            } catch {
              if (enEncuentro) aviso.text = "El Oráculo guarda silencio (falló la conexión).";
            }
          })
        );
      }

      const cerrar = () => {
        overlay.forEach((o) => k.destroy(o));
        // Cancelar los handlers de este encuentro: si quedan vivos, el próximo
        // encuentro dispara los viejos primero y su overlay queda huérfano.
        teclas.forEach((t) => t.cancel());
        teclas.length = 0;
        enEncuentro = false;
      };

      const responder = (indice: number) => {
        if (!enEncuentro || indice >= reto.opciones.length) return;
        const resultado = quiz.responderMultipleChoice(reto, indice);
        cerrar();
        registrarResultado(agente, resultado.correcta, resultado.explicacion, reto.bonus2026);
      };

      for (let i = 0; i < reto.opciones.length; i++) {
        teclas.push(k.onKeyPress(String(i + 1) as never, () => responder(i)));
      }
    };

    // Encuentro abierto: textarea DOM + evaluación IA contra la rúbrica (F6).
    const encuentroAbierto = async (agente: GameObj, reto: RetoAbierta) => {
      enEncuentro = true;
      const evaluacion = await abrirRetoAbierto(st.ai, reto);
      enEncuentro = false;
      if (evaluacion === null) {
        // Se rindió o la IA falló: cae a la variante de opciones sin penalizar.
        const mc = quiz.fallbackDe(reto.fallbackId);
        if (mc && !respondidos.has(mc.id)) {
          respondidos.add(mc.id);
          encuentroMultipleChoice(agente, mc);
        } else {
          combates.delete(agente);
          k.destroy(agente);
          actualizarHud();
          activarSiguienteEnCola();
          comprobarNivelLimpio();
        }
        return;
      }
      registrarResultado(agente, evaluacion.aprobado, evaluacion.feedback, reto.bonus2026);
    };

    const lanzarPregunta = (agente: GameObj, reto: Reto) => {
      if (reto.tipo === "abierta") {
        if (hayIA(st.ai)) {
          void encuentroAbierto(agente, reto);
          return;
        }
        const mc = quiz.fallbackDe(reto.fallbackId);
        if (mc && !respondidos.has(mc.id)) {
          respondidos.add(mc.id);
          encuentroMultipleChoice(agente, mc);
        } else {
          iniciarEncuentro(agente);
        }
        return;
      }
      respondidos.add(reto.id);
      encuentroMultipleChoice(agente, reto);
    };

    // Esquive "bullet time" (F11, re-tematizado en F11 v3): antes de cada
    // pregunta, el Agente que te alcanzó tira una ráfaga de puñetazos en
    // cámara lenta que se esquivan con las mismas flechas del movimiento —
    // coherente con el combate cuerpo a cuerpo (antes eran balazos desde
    // fuera de pantalla, de cuando los Agentes eran shapes sin sprite).
    // No bloquea el flujo: al terminar, siempre se muestra la pregunta.
    const ejecutarEsquive = (agente: GameObj): Promise<{ esquivadas: number; total: number }> => {
      return new Promise((resolve) => {
        let esquivadas = 0;
        let indice = 0;
        const overlay: GameObj[] = [];
        const teclas: KEventController[] = [];
        const combate = combates.get(agente);
        const anchoAgente = combate?.ancho ?? ANCHO_AGENTE;
        const altoAgente = combate?.alto ?? ALTO_AGENTE;

        // Poses de la ráfaga (F11 v3): el Agente golpea y Neo queda en alerta,
        // cada uno encarando al otro.
        orientarHacia(player, agente.pos.x + anchoAgente / 2);
        orientarHacia(agente, player.pos.x + ANCHO_NEO / 2);
        fijarPose(player, "alerta");
        fijarPose(agente, "ataque");

        overlay.push(
          k.add([
            k.text("ESQUIVE — pulsá la flecha antes del golpe", { size: 14 }),
            k.pos(ANCHO / 2, 40),
            k.anchor("center"),
            k.color(...VERDE),
            k.z(9),
            k.fixed(),
          ])
        );

        const limpiar = () => {
          fijarPose(player, null);
          if (agente.exists()) fijarPose(agente, null);
          overlay.forEach((o) => k.destroy(o));
          overlay.length = 0;
          teclas.forEach((t) => t.cancel());
          teclas.length = 0;
        };

        const siguienteGolpe = () => {
          if (indice >= GOLPES_POR_RONDA) {
            limpiar();
            resolve({ esquivadas, total: GOLPES_POR_RONDA });
            return;
          }
          indice++;
          const opcion = k.choose(FLECHAS);
          let resuelta = false;
          // El puño sale del cuerpo del Agente hacia Neo, en cámara lenta
          // (bullet time): la distancia es corta porque el Agente te alcanzó,
          // la duración fija hace el resto.
          const xInicial = agente.pos.x + anchoAgente / 2;
          const yInicial = agente.pos.y + altoAgente * 0.35;
          const xImpacto = player.pos.x + ANCHO_NEO / 2;
          const direccion = xImpacto < xInicial ? -1 : 1;
          const velocidad = Math.max(20, Math.abs(xImpacto - xInicial) / DURACION_GOLPE);

          const golpe = k.add([
            k.rect(18, 18),
            k.pos(xInicial, yInicial),
            k.color(...ROJO),
            k.z(9),
            k.move(k.vec2(direccion, 0), velocidad),
          ]);
          golpe.add([k.text(opcion.simbolo, { size: 20 }), k.pos(0, -26), k.color(...BLANCO)]);
          overlay.push(golpe);

          const tecla = k.onKeyPress(opcion.tecla, () => {
            if (resuelta) return;
            esquivadas++;
            terminarGolpe();
          });
          teclas.push(tecla);

          // Cierra esta ronda de la secuencia y cancela su propio listener antes de pasar a la siguiente.
          function terminarGolpe() {
            if (resuelta) return;
            resuelta = true;
            tecla.cancel();
            k.destroy(golpe);
            siguienteGolpe();
          }

          k.wait(DURACION_GOLPE, terminarGolpe);
        };

        siguienteGolpe();
      });
    };

    const iniciarEncuentro = (agente: GameObj) => {
      // Guarda de concurrencia (bug real encontrado jugando F11 v2): durante la
      // pausa de 0.9s entre rondas contra el mismo Agente, `enEncuentro` está en
      // false y el Agente activo puede volver a alcanzarte y disparar `onCollide`
      // otra vez, en carrera con el reintento ya programado por ese `k.wait`. Sin
      // esto, ambos llamados crean su propio overlay de pregunta a la vez y el
      // texto queda superpuesto/ilegible.
      if (enEncuentro) return;
      // Un Agente en su animación de derrota ya está fuera de combate: si Neo
      // lo toca durante esos ~0.6s no debe abrirse un encuentro nuevo.
      if (muriendo.has(agente)) return;
      enEncuentro = true;
      // Smith adaptativo (F9): la dificultad del próximo reto sigue tu desempeño;
      // contra el Jefe de nivel (F11) siempre se usan los retos más difíciles del banco.
      const nivel = agente.is("jefe") ? 3 : st.session.nivelJugador(moduloId);
      let reto = quiz.siguienteAdaptativo(nivel);
      // Salteá retos cuya variante ya se usó como fallback en esta partida.
      while (reto && respondidos.has(reto.id)) reto = quiz.siguienteAdaptativo(nivel);
      if (!reto) {
        // Mazo agotado (bancos chicos): red de seguridad, el Agente cae sin pelea.
        combates.delete(agente);
        k.destroy(agente);
        enEncuentro = false;
        actualizarHud();
        activarSiguienteEnCola();
        comprobarNivelLimpio();
        return;
      }
      const retoElegido = reto;
      void ejecutarEsquive(agente).then(({ esquivadas, total }) => {
        if (esquivadas > 0) {
          st.session.score += calcularBonusEsquive(esquivadas, total);
          actualizarHud();
        }
        lanzarPregunta(agente, retoElegido);
      });
    };

    player.onCollide("agente", (agente: GameObj) => {
      if (!bloqueado()) iniciarEncuentro(agente);
    });

    player.onCollide("oraculo", () => {
      if (bloqueado()) return;
      enEncuentro = true;
      // El Oráculo "habla" mientras el chat está abierto y saluda al cerrarlo.
      fijarPose(oraculo, "habla");
      const contexto = [banco.modulo.nombre, banco.modulo.descripcion, banco.modulo.resumen ?? ""].join("\n");
      abrirOraculo(st.ai, contexto, () => {
        enEncuentro = false;
        fijarPose(oraculo, "bye");
        k.wait(1.2, () => {
          if (oraculo.exists()) fijarPose(oraculo, null);
        });
        // Alejar a Neo para no reabrir el chat al instante: siempre por debajo
        // del área del Oráculo (con sprites 3x, un offset fijo quedaba adentro).
        player.pos = k.vec2(70, CARRIL_SUPERIOR + 20 + ALTO_AGENTE + 24);
      });
    });
  });
}
