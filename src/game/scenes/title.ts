import { KAPLAYCtx } from "kaplay";
import { reproducirMusica } from "../audio";
import { ANCHO, ALTO, CHARS_MATRIX, VERDE, VERDE_OSCURO, BLANCO } from "../theme";

export function registrarTitle(k: KAPLAYCtx): void {
  k.scene("title", () => {
    // El primer play suele quedar bloqueado por el autoplay del navegador:
    // iniciarAudio() lo reintenta con la primera tecla (el ENTER de despertar).
    reproducirMusica("musica-menu.mp3");
    // Lluvia de código
    k.loop(0.06, () => {
      const char = k.add([
        k.text(k.choose(CHARS_MATRIX), { size: 16 }),
        k.pos(k.rand(0, ANCHO), -20),
        k.color(...VERDE_OSCURO),
        k.opacity(k.rand(0.2, 0.8)),
        k.move(k.vec2(0, 1), k.rand(80, 220)),
        k.z(0),
      ]);
      k.wait(6, () => k.destroy(char));
    });

    k.add([
      k.text("WAKE UP, DEV", { size: 56 }),
      k.pos(ANCHO / 2, ALTO / 2 - 60),
      k.anchor("center"),
      k.color(...VERDE),
      k.z(1),
    ]);

    k.add([
      k.text("La Matrix del Máster en Desarrollo con IA", { size: 18 }),
      k.pos(ANCHO / 2, ALTO / 2),
      k.anchor("center"),
      k.color(...BLANCO),
      k.z(1),
    ]);

    const prompt = k.add([
      k.text("PULSA ENTER PARA DESPERTAR", { size: 20 }),
      k.pos(ANCHO / 2, ALTO / 2 + 90),
      k.anchor("center"),
      k.color(...VERDE),
      k.opacity(1),
      k.z(1),
    ]);
    k.loop(0.6, () => (prompt.opacity = prompt.opacity > 0 ? 0 : 1));

    k.onKeyPress("enter", () => k.go("zion"));
  });
}
