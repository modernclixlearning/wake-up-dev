import { GameObj, KAPLAYCtx, KEventController } from "kaplay";
import { hayIA } from "../../ai/factory";
import { QuizEngine } from "../../domain/quiz-engine";
import { RetoAbierta, RetoMultipleChoice } from "../../domain/reto";
import { GameState } from "../state";
import { ANCHO, ALTO, VERDE, VERDE_OSCURO, ROJO, BLANCO, NEGRO } from "../theme";
import { abrirOraculo, abrirRetoAbierto, hayOverlayAbierto } from "../ui/overlay";

const VELOCIDAD = 220;
const MAX_AGENTES = 6;

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
    let enEncuentro = false;
    const bloqueado = () => enEncuentro || hayOverlayAbierto();

    // HUD
    const hud = k.add([k.text("", { size: 16 }), k.pos(16, 12), k.color(...VERDE), k.z(5)]);
    const actualizarHud = () => {
      hud.text = `${banco.modulo.nombre}  |  Vidas: ${st.session.vidas}  Score: ${st.session.score}  Agentes: ${k.get("agente").length}`;
    };

    // Jugador (Neo)
    const player = k.add([
      k.rect(22, 22),
      k.pos(60, ALTO / 2),
      k.area(),
      k.color(...VERDE),
      k.outline(2, k.rgb(...BLANCO)),
      k.z(2),
      "player",
    ]);

    // El Oráculo (NPC): arriba a la izquierda
    const oraculo = k.add([
      k.rect(26, 26),
      k.pos(70, 80),
      k.area(),
      k.color(...BLANCO),
      k.outline(2, k.rgb(...VERDE)),
      k.z(1),
      "oraculo",
    ]);
    oraculo.add([k.text("?", { size: 18 }), k.pos(7, 3), k.color(...NEGRO)]);
    k.add([
      k.text("Oráculo", { size: 11 }),
      k.pos(70, 114),
      k.color(...VERDE_OSCURO),
      k.z(1),
    ]);

    // Agentes Smith
    const nAgentes = Math.min(MAX_AGENTES, quiz.restantes);
    for (let i = 0; i < nAgentes; i++) {
      const agente = k.add([
        k.rect(24, 24),
        k.pos(k.rand(ANCHO * 0.3, ANCHO - 60), k.rand(70, ALTO - 60)),
        k.area(),
        k.color(...ROJO),
        k.z(1),
        "agente",
      ]);
      agente.add([k.text("A", { size: 16 }), k.pos(5, 3), k.color(...NEGRO)]);
    }
    actualizarHud();

    // Movimiento
    k.onKeyDown("left", () => !bloqueado() && player.move(-VELOCIDAD, 0));
    k.onKeyDown("right", () => !bloqueado() && player.move(VELOCIDAD, 0));
    k.onKeyDown("up", () => !bloqueado() && player.move(0, -VELOCIDAD));
    k.onKeyDown("down", () => !bloqueado() && player.move(0, VELOCIDAD));
    player.onUpdate(() => {
      player.pos.x = k.clamp(player.pos.x, 0, ANCHO - 22);
      player.pos.y = k.clamp(player.pos.y, 40, ALTO - 22);
    });

    const mostrarFeedback = (ok: boolean, texto: string) => {
      const msg = k.add([
        k.text(`${ok ? "CORRECTO" : "FALLASTE"} — ${texto}`, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 46),
        k.color(...(ok ? VERDE : ROJO)),
        k.z(6),
      ]);
      k.wait(4, () => k.destroy(msg));
    };

    const registrarResultado = (agente: GameObj, correcta: boolean, feedback: string, esBonus: boolean) => {
      if (correcta) {
        st.session.registrarAcierto(moduloId, esBonus);
        k.destroy(agente);
        mostrarFeedback(true, feedback);
      } else {
        st.session.registrarFallo(moduloId);
        player.pos = k.vec2(60, ALTO / 2);
        mostrarFeedback(false, feedback);
        if (st.session.derrotado) {
          k.wait(1.6, () => k.go("gameover"));
        }
      }
      actualizarHud();
      comprobarNivelLimpio();
    };

    // Encuentro clásico: pregunta de opciones en el canvas (teclas 1-4).
    const encuentroMultipleChoice = (agente: GameObj, reto: RetoMultipleChoice) => {
      enEncuentro = true;
      const overlay: GameObj[] = [];
      const teclas: KEventController[] = [];

      overlay.push(
        k.add([k.rect(ANCHO - 80, ALTO - 120), k.pos(40, 60), k.color(...NEGRO), k.outline(3, k.rgb(...VERDE)), k.opacity(0.95), k.z(10)]),
        k.add([k.text("AGENTE SMITH TE BLOQUEA — responde:", { size: 16 }), k.pos(60, 80), k.color(...ROJO), k.z(11)]),
        k.add([k.text(reto.pregunta, { size: 20, width: ANCHO - 160 }), k.pos(60, 115), k.color(...BLANCO), k.z(11)])
      );
      reto.opciones.forEach((op, i) => {
        overlay.push(
          k.add([k.text(`${i + 1}) ${op}`, { size: 17, width: ANCHO - 160 }), k.pos(80, 215 + i * 55), k.color(...VERDE), k.z(11)])
        );
      });

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
          k.destroy(agente);
          actualizarHud();
          comprobarNivelLimpio();
        }
        return;
      }
      registrarResultado(agente, evaluacion.aprobado, evaluacion.feedback, reto.bonus2026);
    };

    const iniciarEncuentro = (agente: GameObj) => {
      let reto = quiz.siguiente();
      // Salteá retos cuya variante ya se usó como fallback en esta partida.
      while (reto && respondidos.has(reto.id)) reto = quiz.siguiente();
      if (!reto) {
        k.destroy(agente);
        actualizarHud();
        comprobarNivelLimpio();
        return;
      }
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

    const comprobarNivelLimpio = () => {
      if (k.get("agente").length > 0 || st.session.derrotado) return;
      st.session.completarModulo(moduloId);
      const portal = k.add([
        k.rect(36, 60),
        k.pos(ANCHO - 70, ALTO / 2 - 30),
        k.area(),
        k.color(...VERDE_OSCURO),
        k.outline(3, k.rgb(...VERDE)),
        k.z(1),
        "portal",
      ]);
      portal.add([k.text("EXIT", { size: 10 }), k.pos(4, 24), k.color(...VERDE)]);
      player.onCollide("portal", () => k.go("zion"));
    };

    player.onCollide("agente", (agente) => {
      if (!bloqueado()) iniciarEncuentro(agente);
    });

    player.onCollide("oraculo", () => {
      if (bloqueado()) return;
      enEncuentro = true;
      const contexto = [banco.modulo.nombre, banco.modulo.descripcion, banco.modulo.resumen ?? ""].join("\n");
      abrirOraculo(st.ai, contexto, () => {
        enEncuentro = false;
        // Alejar a Neo para no reabrir el chat al instante.
        player.pos = k.vec2(70, 180);
      });
    });
  });
}
