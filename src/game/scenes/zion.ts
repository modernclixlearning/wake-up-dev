import { KAPLAYCtx } from "kaplay";
import { crearProvider } from "../../ai/factory";
import { GameSession } from "../../domain/session";
import { teclaDeModulo } from "../../domain/teclado";
import { reproducirMusica, estaMuteado } from "../audio";
import { borrarPartida } from "../persistencia";
import { GameState } from "../state";
import { ANCHO, ALTO, VERDE, VERDE_OSCURO, BLANCO, ROJO } from "../theme";
import { abrirAjustes, hayOverlayAbierto } from "../ui/overlay";

/** Hub entre niveles: muestra los módulos, el progreso y el acceso a ajustes. */

export function registrarZion(k: KAPLAYCtx, estado: () => GameState): void {
  k.scene("zion", () => {
    const st = estado();
    // Si venís del title sigue la misma pista sin reiniciarse; si volvés de un
    // nivel, corta la música de combate y retoma la del menú.
    reproducirMusica("musica-menu.mp3");

    k.add([
      k.text("ZION — Elige tu módulo", { size: 32 }),
      k.pos(ANCHO / 2, 70),
      k.anchor("center"),
      k.color(...VERDE),
    ]);

    // Interlineado adaptativo: con paso fijo de 55, a partir de 6 módulos el
    // último caía sobre la línea "IA conectada" y el score de abajo.
    const pasoLista =
      st.bancos.length > 1 ? Math.min(55, (ALTO - 155 - 150) / (st.bancos.length - 1)) : 0;
    st.bancos.forEach((banco, i) => {
      const prog = st.session.progreso.get(banco.modulo.id);
      // Sin corchetes: Kaplay los parsea como tags de texto estilado y lanza
      // "unclosed tags" en cada frame (p.ej. con "[LIBERADO]").
      const estadoTxt = prog?.completado ? "— LIBERADO —" : "— EN LA MATRIX —";
      k.add([
        k.text(`${teclaDeModulo(i)}. ${banco.modulo.nombre} ${estadoTxt}`, { size: 20, width: 800 }),
        k.pos(ANCHO / 2, 150 + i * pasoLista),
        k.anchor("center"),
        k.color(...(prog?.completado ? VERDE_OSCURO : BLANCO)),
      ]);
    });

    const estadoIA = k.add([
      k.text("", { size: 15 }),
      k.pos(ANCHO / 2, ALTO - 120),
      k.anchor("center"),
      k.color(...VERDE_OSCURO),
    ]);
    const refrescarEstadoIA = () => {
      const conIA = st.ai.nombre !== "static-fallback";
      estadoIA.text = conIA
        ? `IA conectada: ${st.ai.nombre} (Oráculo y retos abiertos activos)`
        : "Sin IA — pulsa A para conectar tu API key (opcional)";
    };
    refrescarEstadoIA();

    k.add([
      k.text(`Score: ${st.session.score}   Vidas: ${st.session.vidas}`, { size: 18 }),
      k.pos(ANCHO / 2, ALTO - 85),
      k.anchor("center"),
      k.color(...VERDE_OSCURO),
    ]);

    k.add([
      k.text("1-9 y 0 = entrar al módulo   ·   A = ajustes de IA   ·   R = reiniciar partida", {
        size: 16,
      }),
      k.pos(ANCHO / 2, ALTO - 45),
      k.anchor("center"),
      k.color(...VERDE),
    ]);

    // Estado del sonido: misma lógica que level.ts (avisoMute) para que el
    // tester sepa que hay 10 pistas y cómo recuperar el audio si pulsó M.
    const avisoMute = k.add([
      k.text("", { size: 14 }),
      k.pos(ANCHO / 2, ALTO - 20),
      k.anchor("center"),
      k.color(...VERDE),
      k.z(1),
    ]);
    const actualizarMute = () => {
      const silenciado = estaMuteado();
      avisoMute.text = silenciado ? "M = música: SILENCIADA" : "M = música: ACTIVADA";
      avisoMute.color = silenciado ? k.rgb(...ROJO) : k.rgb(...VERDE);
    };
    actualizarMute();
    // Solo refrescar el cartel; el toggle ya lo hace iniciarAudio() en window.
    k.onKeyPress("m", () => k.wait(0, actualizarMute));

    // Reinicio de partida con confirmación doble: la primera R avisa, la
    // segunda (dentro de los 4s) borra el avance guardado y arranca de cero.
    const avisoReinicio = k.add([
      k.text("", { size: 14 }),
      k.pos(ANCHO / 2, ALTO - 4),
      k.anchor("center"),
      k.color(...ROJO),
    ]);
    let confirmandoReinicio = false;
    k.onKeyPress("r", () => {
      if (hayOverlayAbierto()) return;
      if (!confirmandoReinicio) {
        confirmandoReinicio = true;
        avisoReinicio.text = "¿Borrar todo tu avance? Pulsa R de nuevo para confirmar";
        k.wait(4, () => {
          confirmandoReinicio = false;
          avisoReinicio.text = "";
        });
        return;
      }
      borrarPartida();
      st.session = new GameSession();
      k.go("zion");
    });

    st.bancos.forEach((banco, i) => {
      const tecla = teclaDeModulo(i);
      if (!tecla) return;
      k.onKeyPress(tecla as never, () => {
        if (hayOverlayAbierto()) return;
        k.go("level", { moduloId: banco.modulo.id });
      });
    });

    k.onKeyPress("a", () => {
      if (hayOverlayAbierto()) return;
      abrirAjustes((config) => {
        st.ai = crearProvider(config);
        refrescarEstadoIA();
      });
    });
  });
}
