import { KAPLAYCtx } from "kaplay";
import { detenerMusica, sfx } from "../audio";
import { GameState } from "../state";
import { ANCHO, ALTO, ROJO, BLANCO, VERDE } from "../theme";

export function registrarGameover(
  k: KAPLAYCtx,
  estado: () => GameState,
  reiniciar: () => void
): void {
  k.scene("gameover", () => {
    const st = estado();
    // Silencio dramático: se corta la música de combate y suena la caída.
    detenerMusica();
    sfx.fallo();

    k.add([
      k.text("LOS AGENTES TE ATRAPARON", { size: 40 }),
      k.pos(ANCHO / 2, ALTO / 2 - 60),
      k.anchor("center"),
      k.color(...ROJO),
    ]);

    k.add([
      k.text(`Score final: ${st.session.score}`, { size: 22 }),
      k.pos(ANCHO / 2, ALTO / 2),
      k.anchor("center"),
      k.color(...BLANCO),
    ]);

    k.add([
      k.text("ENTER: tomar la píldora roja otra vez", { size: 18 }),
      k.pos(ANCHO / 2, ALTO / 2 + 70),
      k.anchor("center"),
      k.color(...VERDE),
    ]);

    k.onKeyPress("enter", () => {
      reiniciar();
      k.go("title");
    });
  });
}
