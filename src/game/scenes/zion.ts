import { KAPLAYCtx } from "kaplay";
import { GameState } from "../state";
import { ANCHO, ALTO, VERDE, VERDE_OSCURO, BLANCO } from "../theme";

/** Hub entre niveles: muestra los módulos y el progreso. */
export function registrarZion(k: KAPLAYCtx, estado: () => GameState): void {
  k.scene("zion", () => {
    const st = estado();

    k.add([
      k.text("ZION — Elige tu módulo", { size: 32 }),
      k.pos(ANCHO / 2, 70),
      k.anchor("center"),
      k.color(...VERDE),
    ]);

    st.bancos.forEach((banco, i) => {
      const prog = st.session.progreso.get(banco.modulo.id);
      // Sin corchetes: Kaplay los parsea como tags de texto estilado y lanza
      // "unclosed tags" en cada frame (p.ej. con "[LIBERADO]").
      const estadoTxt = prog?.completado ? "— LIBERADO —" : "— EN LA MATRIX —";
      k.add([
        k.text(`${i + 1}. ${banco.modulo.nombre} ${estadoTxt}`, { size: 20, width: 800 }),
        k.pos(ANCHO / 2, 170 + i * 60),
        k.anchor("center"),
        k.color(...(prog?.completado ? VERDE_OSCURO : BLANCO)),
      ]);
    });

    k.add([
      k.text(`Score: ${st.session.score}   Vidas: ${st.session.vidas}`, { size: 18 }),
      k.pos(ANCHO / 2, ALTO - 90),
      k.anchor("center"),
      k.color(...VERDE_OSCURO),
    ]);

    k.add([
      k.text("Pulsa el número del módulo para entrar", { size: 16 }),
      k.pos(ANCHO / 2, ALTO - 50),
      k.anchor("center"),
      k.color(...VERDE),
    ]);

    st.bancos.forEach((banco, i) => {
      k.onKeyPress(String(i + 1) as never, () => k.go("level", { moduloId: banco.modulo.id }));
    });
  });
}
