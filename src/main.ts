import kaplay from "kaplay";
import bancoFundamentos from "./content/retos/01-fundamentos.json";
import bancoIngenieria from "./content/retos/02-ingenieria.json";
import bancoArquitectura from "./content/retos/03-arquitectura.json";
import bancoFundamentosIA from "./content/retos/04-fundamentos-ia.json";
import bancoHerramientas from "./content/retos/05-herramientas.json";
import bancoFlujoIA from "./content/retos/09-flujo-desarrollo-ia.json";
import { BancoModulo } from "./domain/reto";
import { cargarSprites } from "./game/actores";
import { cargarFondos } from "./game/escenario";
import { iniciarAudio } from "./game/audio";
import { crearEstadoInicial, GameState } from "./game/state";
import { ANCHO, ALTO } from "./game/theme";
import { registrarTitle } from "./game/scenes/title";
import { registrarZion } from "./game/scenes/zion";
import { registrarLevel } from "./game/scenes/level";
import { registrarGameover } from "./game/scenes/gameover";

const bancos: BancoModulo[] = [
  bancoFundamentos as BancoModulo,
  bancoIngenieria as BancoModulo,
  bancoArquitectura as BancoModulo,
  bancoFundamentosIA as BancoModulo,
  bancoHerramientas as BancoModulo,
  bancoFlujoIA as BancoModulo,
];

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
  // Sprites pixel art (F11 v3): escalar sin suavizado, pixeles nítidos.
  crisp: true,
});

cargarSprites(k);
cargarFondos(k);
iniciarAudio();

registrarTitle(k);
registrarZion(k, getEstado);
registrarLevel(k, getEstado);
registrarGameover(k, getEstado, reiniciar);

k.go("title");
