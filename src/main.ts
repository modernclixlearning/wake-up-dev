import kaplay from "kaplay";
import bancoFundamentos from "./content/retos/01-fundamentos.json";
import { BancoModulo } from "./domain/reto";
import { crearEstadoInicial, GameState } from "./game/state";
import { ANCHO, ALTO } from "./game/theme";
import { registrarTitle } from "./game/scenes/title";
import { registrarZion } from "./game/scenes/zion";
import { registrarLevel } from "./game/scenes/level";
import { registrarGameover } from "./game/scenes/gameover";

const bancos: BancoModulo[] = [bancoFundamentos as BancoModulo];

let estado: GameState = crearEstadoInicial(bancos);
const getEstado = () => estado;
const reiniciar = () => {
  estado = crearEstadoInicial(bancos);
};

const k = kaplay({
  width: ANCHO,
  height: ALTO,
  background: [0, 0, 0],
  global: false,
  letterbox: true,
  pixelDensity: 1,
});

registrarTitle(k);
registrarZion(k, getEstado);
registrarLevel(k, getEstado);
registrarGameover(k, getEstado, reiniciar);

k.go("title");
