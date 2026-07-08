import { GameObj, KAPLAYCtx } from "kaplay";
import { QuizEngine } from "../../domain/quiz-engine";
import { Reto, RetoMultipleChoice, esMultipleChoice } from "../../domain/reto";
import { GameState } from "../state";
import { ANCHO, ALTO, VERDE, VERDE_OSCURO, ROJO, BLANCO, NEGRO } from "../theme";

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

    // HUD
    const hud = k.add([
      k.text("", { size: 16 }),
      k.pos(16, 12),
      k.color(...VERDE),
      k.z(5),
    ]);
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

    // Agentes Smith
    const nAgentes = Math.min(MAX_AGENTES, quiz.restantes);
    for (let i = 0; i < nAgentes; i++) {
      const x = k.rand(ANCHO * 0.3, ANCHO - 60);
      const y = k.rand(70, ALTO - 60);
      const agente = k.add([
        k.rect(24, 24),
        k.pos(x, y),
        k.area(),
        k.color(...ROJO),
        k.z(1),
        "agente",
      ]);
      agente.add([k.text("A", { size: 16 }), k.pos(5, 3), k.color(...NEGRO)]);
    }
    actualizarHud();

    // Movimiento
    k.onKeyDown("left", () => !enEncuentro && player.move(-VELOCIDAD, 0));
    k.onKeyDown("right", () => !enEncuentro && player.move(VELOCIDAD, 0));
    k.onKeyDown("up", () => !enEncuentro && player.move(0, -VELOCIDAD));
    k.onKeyDown("down", () => !enEncuentro && player.move(0, VELOCIDAD));
    player.onUpdate(() => {
      player.pos.x = k.clamp(player.pos.x, 0, ANCHO - 22);
      player.pos.y = k.clamp(player.pos.y, 40, ALTO - 22);
    });

    // Saca el siguiente reto resoluble sin IA (las abiertas usan su variante fallback en F3).
    const siguienteResoluble = (): RetoMultipleChoice | null => {
      let reto: Reto | null;
      while ((reto = quiz.siguiente()) !== null) {
        const mc = esMultipleChoice(reto) ? reto : quiz.fallbackDe(reto.fallbackId);
        if (mc && !respondidos.has(mc.id)) {
          respondidos.add(mc.id);
          return mc;
        }
      }
      return null;
    };

    const abrirEncuentro = (agente: GameObj) => {
      const reto = siguienteResoluble();
      if (!reto) {
        k.destroy(agente);
        actualizarHud();
        comprobarNivelLimpio();
        return;
      }
      enEncuentro = true;
      const overlay: GameObj[] = [];

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
        enEncuentro = false;
      };

      const responder = (indice: number) => {
        if (!enEncuentro || indice >= reto.opciones.length) return;
        const resultado = quiz.responderMultipleChoice(reto, indice);
        cerrar();
        if (resultado.correcta) {
          st.session.registrarAcierto(moduloId, reto.bonus2026);
          k.destroy(agente);
          mostrarFeedback(true, resultado.explicacion);
        } else {
          st.session.registrarFallo(moduloId);
          player.pos = k.vec2(60, ALTO / 2);
          mostrarFeedback(false, resultado.explicacion);
          if (st.session.derrotado) {
            k.wait(1.6, () => k.go("gameover"));
          }
        }
        actualizarHud();
        comprobarNivelLimpio();
      };

      for (let i = 0; i < reto.opciones.length; i++) {
        k.onKeyPress(String(i + 1) as never, () => responder(i));
      }
    };

    const mostrarFeedback = (ok: boolean, explicacion: string) => {
      const msg = k.add([
        k.text(`${ok ? "CORRECTO" : "FALLASTE"} — ${explicacion}`, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 46),
        k.color(...(ok ? VERDE : ROJO)),
        k.z(6),
      ]);
      k.wait(4, () => k.destroy(msg));
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
      if (!enEncuentro) abrirEncuentro(agente);
    });
  });
}
