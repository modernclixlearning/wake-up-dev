import { GameObj, KAPLAYCtx, KEventController } from "kaplay";
import { hayIA } from "../../ai/factory";
import {
  calcularBonusFase,
  conectarGolpe,
  crearCombate,
  crearFase,
  derrotado,
  enemigoAturdido,
  EstadoCombate,
  FaseCombate,
  GOLPES_PARA_ATURDIR,
  golpear,
  HP_AGENTE_NORMAL,
  HP_JEFE,
  recibirGolpe,
} from "../../domain/combate";
import { calcularCuentaAtras } from "../../domain/cuenta-atras";
import { dificultadPara } from "../../domain/dificultad";
import { calcularDuracionFeedback } from "../../domain/feedback";
import { QuizEngine } from "../../domain/quiz-engine";
import { Reto, RetoAbierta, RetoMultipleChoice } from "../../domain/reto";
import {
  ActorAgente,
  ALTO_AGENTE,
  ALTO_NEO,
  ALTO_ORACULO,
  ANCHO_AGENTE,
  ANCHO_NEO,
  ANCHO_ORACULO,
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
import { estaMuteado, musicaDeModulo, reproducirMusica, sfx } from "../audio";
import { ALTO_PORTAL, ANCHO_PORTAL, crearPortal, dibujarEscenario } from "../escenario";
import { crearIconoSonido } from "../iconos";
import { guardarPartida } from "../persistencia";
import { GameState } from "../state";
import { ANCHO, ALTO, CARRIL_INFERIOR, CARRIL_SUPERIOR, VERDE, VERDE_OSCURO, ROJO, BLANCO, NEGRO } from "../theme";
import { abrirOraculo, abrirRetoAbierto, hayOverlayAbierto } from "../ui/overlay";

const VELOCIDAD = 220;
const VELOCIDAD_JEFE = 55;
const MAX_AGENTES = 4;

// Diseño del nivel como pasillo horizontal (F11 v2, tipo Double Dragon/Mario):
// Neo arranca a la izquierda, los Agentes están repartidos a lo largo del
// recorrido y la cámara lo sigue; el Jefe y el portal de salida quedan al final.
const MARGEN_INICIO = 160;
const SEPARACION_AGENTE = 420;
const MARGEN_JEFE = 460;
const MARGEN_PORTAL = 200;

// Combate arcade (F12): piñas cuerpo a cuerpo contra los Smiths (ESPACIO) y
// tiros contra el Jefe con la misma tecla. Aturdir al enemigo (3 golpes) abre
// la pregunta; si no peleás, el enemigo te pega a vos y perdés vidas.
const COOLDOWN_PINA = 0.35;
const ALCANCE_PINA = 34;
const TOLERANCIA_CARRIL = 70;
const RANGO_FRENO_SMITH = 16;
const TELEGRAFIA_ATAQUE = 0.55;
const RECUPERACION_STAGGER = 0.9;
const GRACIA_TRAS_PREGUNTA = 1.2;
const INVULNERABLE_TRAS_GOLPE = 1.2;
// El empuje deja al Smith justo fuera del alcance de la piña (34): los dos
// tienen que volver a cerrar la distancia y el intercambio respira.
const EMPUJE_SMITH_GOLPEADO = 40;
const EMPUJE_NEO_GOLPEADO = 110;
const CADENCIA_DISPARO_JEFE = 1.6;
const DISTANCIA_DISPARO_JEFE = 300;
/** Cara a cara con el Jefe: pausa dramática desde que entra en pantalla hasta el primer tiro. */
const INTRO_JEFE = 1.8;
const VELOCIDAD_BALA_JEFE = 260;
const VELOCIDAD_BALA_NEO = 420;

interface Combate {
  estado: EstadoCombate;
  barra: BarraHP;
  ancho: number;
  alto: number;
  /** Solo el Agente "activo" pelea contra Neo (F11 v2): el resto espera su turno quieto. */
  activo: boolean;
  /** Fase arcade en curso: golpes conectados/recibidos hasta aturdirlo (F12). */
  fase: FaseCombate;
  /** Marcador visual de la fase ("2/3") flotando sobre la barra de HP. */
  marcador: GameObj;
  /** Momento (k.time) a partir del cual el enemigo puede volver a atacar. */
  proximoAtaque: number;
  /** true durante la telegrafía del golpe: el enemigo frena para avisar. */
  atacando: boolean;
  /** Timer de la telegrafía en curso: se cancela si una piña lo hace trastabillar. */
  telegrafia: KEventController | null;
}

export function registrarLevel(k: KAPLAYCtx, estado: () => GameState): void {
  k.scene("level", ({ moduloId }: { moduloId: string }) => {
    const st = estado();
    const banco = st.bancos.find((b) => b.modulo.id === moduloId);
    if (!banco) {
      k.go("zion");
      return;
    }
    // Dificultad progresiva (F16): NO depende del módulo —se entran en el orden
    // que el jugador quiera desde Zion— sino de cuántos lleva liberados.
    const modulosLiberados = [...st.session.progreso.values()].filter((p) => p.completado).length;
    const dif = dificultadPara(modulosLiberados);
    // Más baja que la del menú: en el nivel compite con los SFX del combate.
    reproducirMusica(musicaDeModulo(moduloId), 0.35);
    const quiz = new QuizEngine(banco);
    const respondidos = new Set<string>();
    const combates = new Map<GameObj, Combate>();
    /** Agentes en su animación de derrota (F11 v3): siguen en pantalla ~0.6s
     * antes de explotar, pero ya no deben disparar encuentros nuevos. */
    const muriendo = new Set<GameObj>();
    let enEncuentro = false;
    let jefeApareceUnaVez = false;
    /** El Jefe no dispara hasta el cara a cara EN PANTALLA (pedido del alumno:
     * sus balas llegaban desde fuera del cuadro antes de siquiera verlo). */
    let jefePresentado = false;
    let finIntroJefe = 0;
    let avisoTutorialDado = false;
    /** Ventana de invulnerabilidad de Neo tras recibir un golpe (evita el chain-hit). */
    let invulnerableHasta = 0;
    let proximaPina = 0;
    const bloqueado = () => enEncuentro || hayOverlayAbierto();
    const esInvulnerable = () => k.time() < invulnerableHasta;

    const nAgentes = Math.min(MAX_AGENTES, quiz.restantes);
    const anchoNivel = MARGEN_INICIO + Math.max(1, nAgentes) * SEPARACION_AGENTE + MARGEN_JEFE + MARGEN_PORTAL;

    // El camino (F14) sale del propio escenario: la banda que se ve dibujada es
    // exactamente la que acota a los personajes. Calcularlo por separado acá
    // abriría la puerta a que el clamp y el dibujo se desincronicen.
    const camino = dibujarEscenario(k, moduloId, anchoNivel);

    /**
     * Acota a un actor al camino. Trabaja sobre los PIES (`pos.y + alto`), que
     * es lo que "pisa" el suelo y lo único comparable entre actores de distinta
     * altura. El segundo clamp es red de seguridad: el Jefe mide 240 y no entra
     * en la parte más al fondo de la banda sin meter la cabeza en el HUD.
     */
    const acotarAlCamino = (obj: GameObj, ancho: number, alto: number) => {
      const pies = camino.acotarPies(obj.pos.x + ancho / 2, obj.pos.y + alto);
      obj.pos.y = k.clamp(pies - alto, CARRIL_SUPERIOR, CARRIL_INFERIOR - alto);
    };

    // HUD: fijo a la pantalla (k.fixed) — sin esto, al mover la cámara con el
    // scroll del pasillo el texto se iría del cuadro junto con el mundo.
    const hud = k.add([k.text("", { size: 16 }), k.pos(16, 12), k.color(...VERDE), k.z(5), k.fixed()]);
    const actualizarHud = () => {
      hud.text = `${banco.modulo.nombre}  |  Vidas: ${st.session.vidas}  Score: ${st.session.score}  Agentes: ${k.get("agente").length}`;
    };
    // Estado del sonido SIEMPRE visible: icono 8-bit de altavoz en la esquina
    // superior derecha. Si está muteado muestra el icono tachado en rojo.
    // El icono necesita k.fixed() para no moverse con la cámara de scroll.
    // Lo agregamos dentro de un objeto fijo manual: crearIconoSonido añade a
    // la escena con k.add, así que pasamos las coordenadas de pantalla fijas.
    // Icono nuevo ≈26px ancho: mover x a ANCHO-32 para que quepa en el canvas.
    const iconoMute = crearIconoSonido(k, ANCHO - 32, 20);
    // El root del icono necesita k.fixed() para ignorar el scroll de cámara.
    iconoMute.root.use(k.fixed());
    k.add([
      k.text("M = ", { size: 13 }),
      k.pos(ANCHO - 86, 20),
      k.anchor("left"),
      k.color(...VERDE),
      k.z(5),
      k.fixed(),
    ]);
    const actualizarMute = () => iconoMute.actualizar(estaMuteado());
    actualizarMute();
    k.onKeyPress("m", () => k.wait(0, actualizarMute));
    k.add([
      // VERDE, no VERDE_OSCURO: sobre la banda del HUD (negro al 72%) apoyada
      // en un fondo claro como el dojo, el verde oscuro da 1.6:1 — invisible.
      // Con VERDE son 6.8:1 en ese mismo peor caso (WCAG AA pide 4.5:1).
      k.text("Flechas: moverte   ESPACIO: atacar   M: sonido", { size: 12 }),
      k.pos(16, 34),
      k.color(...VERDE),
      k.z(5),
      k.fixed(),
    ]);

    // El Oráculo (NPC): al principio del camino y pegado a su borde de fondo,
    // donde la entrada del nivel está abierta a todo lo ancho (ver el perfil
    // del camino en domain/camino.ts). Derivar la Y de la banda en vez de
    // fijarla a mano garantiza que quede SIEMPRE pisable: un Oráculo fuera del
    // camino sería inalcanzable y se llevaría puesta la mecánica del Oráculo.
    // Se crea ANTES que Neo: junto al z (0 vs 2), el orden de creación asegura
    // que el jugador se dibuje en primer plano al pasarle por delante.
    const Y_ORACULO = camino.bandaEn(70 + ANCHO_ORACULO / 2).min + 20 - ALTO_ORACULO;
    const oraculo = crearOraculo(k, 70, Y_ORACULO);
    k.add([
      k.text("Oráculo", { size: 12 }),
      k.pos(70, Y_ORACULO + ALTO_ORACULO + 6),
      k.color(...VERDE),
      k.z(1),
    ]);

    // Jugador (Neo)
    const player = crearNeo(k, 60, ALTO / 2);
    acotarAlCamino(player, ANCHO_NEO, ALTO_NEO);

    // Perspectiva del beat-em-up (F14): en una banda caminable la profundidad
    // la da la Y de los PIES — quien está más abajo está más cerca de cámara y
    // se dibuja delante. Los z fijos por tipo de actor producían superposiciones
    // "mutantes" (el Oráculo tapando a Neo según desde dónde llegara, leído
    // como bug en el playtest). El rango queda en 1.234..1.47 (pies/1000):
    // por encima del portal (1) y por debajo de balas (3), señal (4) y HUD (5).
    const zPorPies = (pies: number) => 1 + pies / 1000;
    oraculo.z = zPorPies(Y_ORACULO + ALTO_ORACULO);
    k.onUpdate(() => {
      player.z = zPorPies(player.pos.y + ALTO_NEO);
      for (const [agente, combate] of combates) {
        agente.z = zPorPies(agente.pos.y + combate.alto);
      }
    });

    // Aviso neutro en pantalla (instrucciones, anuncios): sin el prefijo
    // CORRECTO/FALLASTE de mostrarFeedback y un poco más arriba para no pisarlo.
    /** Respaldo oscuro detrás de un texto de aviso: desde F14 v3 el suelo
     * tileado tapa la banda oscura inferior que garantizaba la legibilidad,
     * así que cada aviso lleva su propio fondo (mismo 0.72 que la banda del
     * HUD, calculado para WCAG AA sobre el suelo blanco del dojo). */
    const respaldoAviso = (y: number, alto: number) =>
      k.add([k.rect(ANCHO - 96, alto), k.pos(48, y - 6), k.color(0, 0, 0), k.opacity(0.72), k.z(6), k.fixed()]);

    const mostrarAviso = (texto: string, duracion = 4) => {
      const fondo = respaldoAviso(ALTO - 80, 44);
      const msg = k.add([
        k.text(texto, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 80),
        k.color(...VERDE),
        k.z(6),
        k.fixed(),
      ]);
      k.wait(duracion, () => {
        k.destroy(msg);
        k.destroy(fondo);
      });
    };

    const mostrarFeedback = (ok: boolean, texto: string) => {
      const fondo = respaldoAviso(ALTO - 46, 40);
      const msg = k.add([
        k.text(`${ok ? "CORRECTO" : "FALLASTE"} — ${texto}`, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 46),
        k.color(...(ok ? VERDE : ROJO)),
        k.z(6),
        k.fixed(),
      ]);
      k.wait(4, () => {
        k.destroy(msg);
        k.destroy(fondo);
      });
    };

    /**
     * Cartel didáctico centrado: muestra la explicación completa tras responder
     * un reto. Tamaño grande, fondo propio, legible en cualquier escenario.
     * - Duración calculada por longitud del texto (mínimo 3s, máximo 12s).
     * - Cualquier tecla cierra el cartel antes de que expire.
     * - Mientras está visible, `enEncuentro` permanece true → Neo no recibe golpes.
     * - Solo puede haber un cartel de este tipo a la vez (deduplicación por flag).
     */
    let explicacionActiva = false;
    const mostrarExplicacion = (ok: boolean, texto: string, alCerrar?: () => void) => {
      // Deduplicación: si ya hay un cartel central, no apilar otro encima.
      if (explicacionActiva) return;
      explicacionActiva = true;
      enEncuentro = true;

      const duracion = calcularDuracionFeedback(texto);
      const PADDING = 40;
      const ANCHO_PANEL = ANCHO - PADDING * 2;
      const teclaHandlers: KEventController[] = [];

      const prefijo = ok ? "CORRECTO" : "FALLASTE";
      // Fondo semitransparente oscuro: legible sobre el escenario blanco (sala de
      // entrenamiento) y sobre los fondos oscuros del resto de módulos.
      const fondo = k.add([
        k.rect(ANCHO, ALTO),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.75),
        k.z(20),
        k.fixed(),
      ]);
      const borde = k.add([
        k.rect(ANCHO_PANEL, ALTO - PADDING * 2),
        k.pos(PADDING, PADDING),
        k.color(...NEGRO),
        k.outline(3, k.rgb(...(ok ? VERDE : ROJO))),
        k.z(21),
        k.fixed(),
      ]);
      const etiqueta = k.add([
        k.text(prefijo, { size: 32 }),
        k.pos(ANCHO / 2, PADDING + 40),
        k.color(...(ok ? VERDE : ROJO)),
        k.anchor("center"),
        k.z(22),
        k.fixed(),
      ]);
      const cuerpo = k.add([
        k.text(texto, { size: 28, width: ANCHO_PANEL - 48 }),
        k.pos(ANCHO / 2, PADDING + 100),
        k.color(...BLANCO),
        k.anchor("top"),
        k.z(22),
        k.fixed(),
      ]);
      const instruccion = k.add([
        k.text("Pulsá cualquier tecla para continuar", { size: 16 }),
        k.pos(ANCHO / 2, ALTO - PADDING - 24),
        k.color(...VERDE),
        k.anchor("center"),
        k.z(22),
        k.fixed(),
      ]);

      const piezas = [fondo, borde, etiqueta, cuerpo, instruccion];

      const cerrar = () => {
        if (!explicacionActiva) return;
        explicacionActiva = false;
        enEncuentro = false;
        teclaHandlers.forEach((h) => h.cancel());
        teclaHandlers.length = 0;
        piezas.forEach((p) => k.destroy(p));
        alCerrar?.();
      };

      // Timer de cierre automático
      const timer = k.wait(duracion, cerrar);

      // Registrar el handler en el SIGUIENTE frame para evitar que el mismo
      // keypress que cerró el overlay de pregunta cierre este cartel al instante.
      // Kaplay procesa todos los onKeyPress del mismo evento en una sola pasada:
      // si registramos aquí, la tecla "2" (o la que sea) ya está siendo procesada
      // y el handler disparará dentro del mismo frame → panel abre y se cierra solo.
      k.wait(0, () => {
        if (!explicacionActiva) return; // ya cerrado (timeout llegó antes del próximo frame)
        const manejador = k.onKeyPress(() => {
          timer.cancel();
          cerrar();
        });
        teclaHandlers.push(manejador);
      });
    };

    // ---- Geometría del combate: cajas de Neo y el Agente ----

    /** Separación horizontal entre las cajas de Neo y el Agente (0 = se tocan). */
    const gapHorizontal = (agente: GameObj, combate: Combate) => {
      const izqA = agente.pos.x;
      const derA = agente.pos.x + combate.ancho;
      const izqN = player.pos.x;
      const derN = player.pos.x + ANCHO_NEO;
      return Math.max(izqA - derN, izqN - derA, 0);
    };

    /** true si Neo y el Agente están a la altura del mismo "carril" (eje Y). */
    const alineadosEnY = (agente: GameObj, combate: Combate) => {
      const centroA = agente.pos.y + combate.alto / 2;
      const centroN = player.pos.y + ALTO_NEO / 2;
      return Math.abs(centroA - centroN) <= TOLERANCIA_CARRIL;
    };

    const enRangoPina = (agente: GameObj, combate: Combate) =>
      gapHorizontal(agente, combate) <= ALCANCE_PINA && alineadosEnY(agente, combate);

    const actualizarMarcador = (combate: Combate) => {
      const golpes = combate.fase.golpesConectados;
      combate.marcador.text = golpes > 0 ? `${golpes}/${GOLPES_PARA_ATURDIR}` : "";
    };

    // Cola de Agentes normales en orden de aparición (F11 v2): solo el primero
    // pelea contra Neo; el resto queda quieto hasta que le toca su turno.
    const colaAgentes: GameObj[] = [];

    // Marca a un Agente como "activo": empieza a perseguir a Neo y muestra un aviso.
    const marcarActivo = (agente: GameObj) => {
      const combate = combates.get(agente);
      if (!combate || combate.activo) return;
      combate.activo = true;
      agente.add([k.text("!", { size: 20 }), k.pos(combate.ancho / 2 - 5, -38), k.color(...ROJO), k.z(6)]);
      if (!avisoTutorialDado) {
        avisoTutorialDado = true;
        mostrarAviso(
          `¡Un Agente viene por vos! ESPACIO = piña — conectá ${GOLPES_PARA_ATURDIR} para aturdirlo y ahí responde. Si te quedás quieto, te muele a golpes.`,
          6
        );
      }
    };

    // Al caer un Agente activo, entran los que hagan falta para mantener el
    // cupo de simultáneos de la dificultad (F16), no siempre uno solo.
    const activarSiguienteEnCola = () => {
      const vivos = colaAgentes.filter((a) => combates.has(a));
      const activos = vivos.filter((a) => combates.get(a)!.activo).length;
      vivos
        .filter((a) => !combates.get(a)!.activo)
        .slice(0, Math.max(0, dif.agentesSimultaneos - activos))
        .forEach(marcarActivo);
    };

    // ---- Golpes del enemigo hacia Neo ----

    /** Neo recibe un golpe físico (piña del Smith o bala del Jefe): -1 vida. */
    const golpearANeo = (agente: GameObj, combate: Combate, tipo: "pina" | "bala") => {
      if (esInvulnerable() || bloqueado()) return;
      invulnerableHasta = k.time() + INVULNERABLE_TRAS_GOLPE;
      combate.fase = recibirGolpe(combate.fase);
      st.session.recibirGolpeFisico();
      if (tipo === "bala") sfx.balaRecibida();
      else sfx.pinaRecibida();
      flashGolpe(k, player, ANCHO_NEO, ALTO_NEO, ROJO);
      // Rebote alejándose del atacante: sin esto el Smith te encadena golpes.
      const direccion = player.pos.x + ANCHO_NEO / 2 < agente.pos.x + combate.ancho / 2 ? -1 : 1;
      player.pos = k.vec2(
        k.clamp(player.pos.x + direccion * EMPUJE_NEO_GOLPEADO, 0, anchoNivel - ANCHO_NEO),
        player.pos.y
      );
      mostrarFeedback(false, "el Agente te conectó un golpe (-1 vida)");
      actualizarHud();
      if (st.session.derrotado) {
        k.wait(1.4, () => k.go("gameover"));
      }
    };

    /** Telegrafía + golpe del Smith: avisa con la pose de ataque y pega si seguís
     * en rango. Una piña de Neo durante el windup lo hace trastabillar y cancela
     * el golpe (stagger clásico de beat'em up: la agresión te defiende). */
    const telegrafiarGolpeSmith = (agente: GameObj, combate: Combate) => {
      combate.atacando = true;
      orientarHacia(agente, player.pos.x + ANCHO_NEO / 2);
      fijarPose(agente, "ataque");
      combate.telegrafia = k.wait(TELEGRAFIA_ATAQUE, () => {
        combate.atacando = false;
        combate.telegrafia = null;
        if (!agente.exists() || muriendo.has(agente)) return;
        fijarPose(agente, null);
        combate.proximoAtaque = k.time() + dif.cadenciaAtaque;
        if (bloqueado()) return;
        if (enRangoPina(agente, combate)) golpearANeo(agente, combate, "pina");
      });
    };

    /** Fogonazo en la boca del arma: vende el disparo mejor que la bala sola. */
    const flashDisparo = (x: number, y: number) => {
      const chispa = k.add([k.rect(14, 8), k.pos(x - 7, y - 4), k.color(...BLANCO), k.opacity(0.9), k.z(4)]);
      k.wait(0.07, () => k.destroy(chispa));
    };

    /** Bala del Jefe: nace en la boca de su pistola (el puño extendido de la
     * pose de ataque — factor 1.5 de ancho, altura del cañón), apuntada a Neo. */
    const dispararBalaJefe = (jefe: GameObj, combate: Combate) => {
      orientarHacia(jefe, player.pos.x + ANCHO_NEO / 2);
      fijarPose(jefe, "ataque");
      k.wait(0.3, () => {
        if (jefe.exists() && !muriendo.has(jefe)) fijarPose(jefe, null);
      });
      sfx.disparo();
      // 0.28: altura del cañón en el frame jefe-disparo (apunta levemente arriba).
      const destino = k.vec2(player.pos.x + ANCHO_NEO / 2, player.pos.y + ALTO_NEO / 2);
      const centro = k.vec2(jefe.pos.x + combate.ancho / 2, jefe.pos.y + combate.alto * 0.28);
      const haciaIzquierda = destino.x < centro.x;
      const origen = k.vec2(
        haciaIzquierda ? jefe.pos.x - combate.ancho * 0.5 : jefe.pos.x + combate.ancho * 1.5,
        centro.y
      );
      // Dirección desde el centro del tirador: desde la boca podría invertirse
      // a quemarropa (la boca queda más allá del objetivo).
      const direccion = destino.sub(centro).unit();
      flashDisparo(origen.x, origen.y);
      k.add([
        k.rect(14, 6),
        k.pos(origen),
        k.color(...ROJO),
        k.area(),
        k.move(direccion, VELOCIDAD_BALA_JEFE),
        k.offscreen({ destroy: true }),
        k.z(3),
        "balaJefe",
      ]);
    };

    /** true si el Jefe está dentro del cuadro visible de la cámara (con margen
     * para que se lo vea entero, no apenas un borde asomando). */
    const jefeALaVista = (jefe: GameObj, combate: Combate) => {
      const camX = k.getCamPos().x;
      return (
        jefe.pos.x < camX + ANCHO / 2 - 40 && jefe.pos.x + combate.ancho > camX - ANCHO / 2 + 40
      );
    };

    /** Cara a cara con el Jefe (pedido del alumno): al entrar en pantalla se
     * planta apuntándote, suena su tema de aparición y hay una pausa dramática
     * antes del primer tiro — nada de balas desde fuera del cuadro. */
    const presentarJefe = (jefe: GameObj) => {
      jefePresentado = true;
      finIntroJefe = k.time() + INTRO_JEFE;
      sfx.aparicionJefe();
      orientarHacia(jefe, player.pos.x + ANCHO_NEO / 2);
      fijarPose(jefe, "ataque");
      k.wait(INTRO_JEFE, () => {
        if (jefe.exists() && !muriendo.has(jefe)) fijarPose(jefe, null);
      });
      mostrarAviso('El Jefe te reconoce: "Sr. Anderson..." — ahora sí, a los tiros.', 4);
    };

    // Persecución (F12): el Smith activo va hacia Neo y, cuando lo alcanza,
    // telegrafía y pega — si no te defendés ni esquivás, te saca vidas. El
    // Jefe avanza lento y pelea a distancia (sus tiros salen de su propio loop).
    const iniciarPersecucion = (agente: GameObj) => {
      const esJefe = agente.is("jefe");
      agente.onUpdate(() => {
        const combate = combates.get(agente);
        if (!combate || !combate.activo || bloqueado() || muriendo.has(agente)) return;
        if (combate.atacando) return;
        if (esJefe) {
          if (!jefePresentado && jefeALaVista(agente, combate)) {
            presentarJefe(agente);
            return;
          }
          // Durante el cara a cara el Jefe se queda plantado midiéndote.
          if (jefePresentado && k.time() < finIntroJefe) return;
        }
        const hacia = player.pos.sub(agente.pos);
        const distancia = hacia.len();
        const gap = gapHorizontal(agente, combate);
        const frenado = esJefe
          ? gap <= DISTANCIA_DISPARO_JEFE
          : gap <= RANGO_FRENO_SMITH && alineadosEnY(agente, combate);
        if (!frenado && distancia > 4) {
          const velocidad = esJefe ? VELOCIDAD_JEFE : dif.velocidadAgente;
          const paso = Math.min(1, (velocidad * k.dt()) / distancia);
          agente.pos = agente.pos.add(hacia.scale(paso));
        }
        // Los Agentes pisan el mismo camino que Neo (F14): si persiguieran por
        // fuera de la banda, quedarían a una altura donde la piña no alinea.
        acotarAlCamino(agente, combate.ancho, combate.alto);
        if (!esJefe && k.time() >= combate.proximoAtaque && enRangoPina(agente, combate)) {
          telegrafiarGolpeSmith(agente, combate);
        }
      });
      if (esJefe) {
        const loopDisparo = k.loop(CADENCIA_DISPARO_JEFE, () => {
          if (!agente.exists() || muriendo.has(agente)) {
            loopDisparo.cancel();
            return;
          }
          const combate = combates.get(agente);
          if (!combate || !combate.activo || bloqueado()) return;
          // Sin cara a cara previo no hay tiroteo, y tampoco dispara si quedó
          // fuera del cuadro (p.ej. Neo volvió a buscar al Oráculo).
          if (!jefePresentado || k.time() < finIntroJefe) return;
          if (!jefeALaVista(agente, combate)) return;
          dispararBalaJefe(agente, combate);
        });
      }
    };

    // Registra el estado de combate de un Agente recién creado (barra de HP incluida).
    const registrarCombate = (info: ActorAgente, hpMaximo: number) => {
      const barra = crearBarraHP(k, info.root, info.ancho);
      const estadoCombate = crearCombate(hpMaximo);
      barra.actualizar(estadoCombate.hpActual, estadoCombate.hpMaximo);
      const marcador = info.root.add([
        k.text("", { size: 12 }),
        k.pos(info.ancho / 2 - 8, -28),
        k.color(...BLANCO),
        k.z(6),
      ]);
      combates.set(info.root, {
        estado: estadoCombate,
        barra,
        ancho: info.ancho,
        alto: info.alto,
        activo: false,
        fase: crearFase(),
        marcador,
        proximoAtaque: 0,
        atacando: false,
        telegrafia: null,
      });
      iniciarPersecucion(info.root);
    };

    // Agentes Smith: repartidos a lo largo del pasillo, en el mismo orden en que se enfrentan.
    for (let i = 0; i < nAgentes; i++) {
      const x = MARGEN_INICIO + (i + 1) * SEPARACION_AGENTE;
      // Nacen SOBRE el camino (F14), a una altura cualquiera de su banda: fuera
      // de ella el primer frame los teletransportaría al borde de un tirón.
      const banda = camino.bandaEn(x + ANCHO_AGENTE / 2);
      const info = crearAgente(k, x, k.rand(banda.min, banda.max) - ALTO_AGENTE);
      registrarCombate(info, HP_AGENTE_NORMAL);
      colaAgentes.push(info.root);
    }
    // Simultaneidad: en los primeros niveles pelea uno; más adelante vienen
    // de a dos o tres a la vez (el salto que más se NOTA de las cuatro perillas).
    colaAgentes.slice(0, dif.agentesSimultaneos).forEach(marcarActivo);
    actualizarHud();

    // Movimiento: Neo avanza libre dentro del carril; la cámara lo sigue en el eje X.
    k.onKeyDown("left", () => !bloqueado() && player.move(-VELOCIDAD, 0));
    k.onKeyDown("right", () => !bloqueado() && player.move(VELOCIDAD, 0));
    k.onKeyDown("up", () => !bloqueado() && player.move(0, -VELOCIDAD));
    k.onKeyDown("down", () => !bloqueado() && player.move(0, VELOCIDAD));
    // Señal de proximidad del Oráculo (wud#10). Dos correcciones sobre el
    // primer intento, que no se veía nunca en pantalla:
    //  - La Y era `oraculo.pos.y - ALTO_AGENTE - 10`. Como `pos` es la esquina
    //    SUPERIOR del actor y ALTO_AGENTE son 160, eso daba y = -76: el cartel
    //    se dibujaba fuera del cuadro, por encima del borde de arriba.
    //  - El radio comparaba las esquinas superiores con `dist < 80`, pero los
    //    actores miden 96x160: para cuando esas esquinas están a 80px, Neo y el
    //    Oráculo ya se están tocando y el chat se abrió solo. Se mide de CENTRO
    //    a centro con un radio que avisa ANTES del contacto, que es el punto.
    const CENTRO_ORACULO = k.vec2(oraculo.pos.x + ANCHO_ORACULO / 2, oraculo.pos.y + ALTO_ORACULO / 2);
    const RADIO_ORACULO = 220;
    let senalOraculo: GameObj | null = null;

    /** Cartel flotante sobre la cabeza del Oráculo, con fondo propio para que se
     * lea sobre cualquiera de los 10 escenarios. Sin `k.fixed()`: va en
     * coordenadas de mundo y scrollea con el NPC. */
    const crearSenalOraculo = () => {
      const texto = "Preguntame tus dudas";
      const ancho = texto.length * 6 + 16;
      // Sin corchetes en k.text(): Kaplay los parsea como tags de texto estilado
      // y lanza "unclosed tags" en cada frame (ver AGENTS.md).
      const contenedor = k.add([k.pos(CENTRO_ORACULO.x, oraculo.pos.y - 24), k.z(4)]);
      contenedor.add([
        k.rect(ancho, 18),
        k.pos(-ancho / 2, -3),
        k.color(...NEGRO),
        k.opacity(0.75),
        k.outline(1, k.rgb(...VERDE_OSCURO)),
      ]);
      contenedor.add([k.text(texto, { size: 11 }), k.pos(0, 0), k.anchor("top"), k.color(...VERDE)]);
      return contenedor;
    };

    player.onUpdate(() => {
      player.pos.x = k.clamp(player.pos.x, 0, anchoNivel - ANCHO_NEO);
      // F14: el clamp vertical ya no es una banda constante sino el camino.
      acotarAlCamino(player, ANCHO_NEO, ALTO_NEO);
      const camX = k.clamp(player.pos.x, ANCHO / 2, Math.max(ANCHO / 2, anchoNivel - ANCHO / 2));
      k.setCamPos(camX, ALTO / 2);

      const centroNeo = k.vec2(player.pos.x + ANCHO_NEO / 2, player.pos.y + ALTO_NEO / 2);
      const cerca = centroNeo.dist(CENTRO_ORACULO) < RADIO_ORACULO;
      if (cerca && !bloqueado()) {
        if (!senalOraculo) senalOraculo = crearSenalOraculo();
      } else if (senalOraculo) {
        k.destroy(senalOraculo);
        senalOraculo = null;
      }
    });

    // ---- Ataque de Neo (F12): ESPACIO = piña contra Smiths / disparo contra el Jefe ----

    /** El enemigo quedó aturdido: bonus de la fase y se abre la pregunta. */
    const aturdir = (agente: GameObj, combate: Combate) => {
      sfx.aturdido();
      st.session.score += calcularBonusFase(combate.fase);
      guardarPartida(st.session);
      combate.fase = crearFase();
      actualizarMarcador(combate);
      actualizarHud();
      // Sin balas en vuelo durante la pregunta: golpearían a Neo "gratis".
      k.destroyAll("balaJefe");
      k.destroyAll("balaNeo");
      iniciarEncuentro(agente);
    };

    /** Un golpe de Neo (piña o bala) conecta contra el Agente. */
    const conectarGolpeA = (agente: GameObj, combate: Combate) => {
      combate.fase = conectarGolpe(combate.fase);
      actualizarMarcador(combate);
      // El Agente golpeado se defiende: si era un Smith en espera, se activa.
      marcarActivo(agente);
      // Stagger: si estaba telegrafiando su golpe, la piña se lo interrumpe.
      if (combate.telegrafia) {
        combate.telegrafia.cancel();
        combate.telegrafia = null;
        combate.atacando = false;
        fijarPose(agente, null);
        combate.proximoAtaque = k.time() + RECUPERACION_STAGGER;
      }
      orientarHacia(agente, player.pos.x + ANCHO_NEO / 2);
      flashGolpe(k, agente, combate.ancho, combate.alto, ROJO);
      // Retroceso corto del Smith: vende el impacto y te da aire entre piñas.
      if (!agente.is("jefe")) {
        const direccion = agente.pos.x + combate.ancho / 2 < player.pos.x + ANCHO_NEO / 2 ? -1 : 1;
        agente.pos.x = k.clamp(agente.pos.x + direccion * EMPUJE_SMITH_GOLPEADO, 0, anchoNivel - combate.ancho);
      }
      if (enemigoAturdido(combate.fase)) aturdir(agente, combate);
    };

    /** Bala de Neo: nace en la boca de la escopeta (pose "disparo", factor 1.8
     * de ancho, altura del cañón), apuntada al centro del Jefe. */
    const dispararBalaNeo = (jefe: GameObj, combate: Combate) => {
      sfx.disparo();
      const destino = k.vec2(jefe.pos.x + combate.ancho / 2, jefe.pos.y + combate.alto / 2);
      const centro = k.vec2(player.pos.x + ANCHO_NEO / 2, player.pos.y + ALTO_NEO * 0.32);
      const haciaIzquierda = destino.x < centro.x;
      const origen = k.vec2(
        haciaIzquierda ? player.pos.x - ANCHO_NEO * 0.8 : player.pos.x + ANCHO_NEO * 1.8,
        centro.y
      );
      // Igual que el Jefe: dirección desde el centro para no invertir el tiro
      // a quemarropa; la bala y el fogonazo salen de la boca de la escopeta.
      const direccion = destino.sub(centro).unit();
      orientarHacia(player, destino.x);
      flashDisparo(origen.x, origen.y);
      k.add([
        k.rect(14, 6),
        k.pos(origen),
        k.color(...VERDE),
        k.area(),
        k.move(direccion, VELOCIDAD_BALA_NEO),
        k.offscreen({ destroy: true }),
        k.z(3),
        "balaNeo",
      ]);
    };

    k.onKeyPress("space", () => {
      if (bloqueado()) return;
      if (k.time() < proximaPina) return;
      proximaPina = k.time() + COOLDOWN_PINA;
      // Fase de Jefe: la misma tecla dispara en vez de dar piñas — y Neo saca
      // la escopeta (frame "disparo"); la piña usa la pose de ataque sin arma.
      const jefe = k.get("jefe").find((j) => combates.has(j) && !muriendo.has(j));
      fijarPose(player, jefe ? "disparo" : "ataque");
      k.wait(0.25, () => fijarPose(player, null));
      if (jefe) {
        dispararBalaNeo(jefe, combates.get(jefe)!);
        return;
      }
      const objetivo = [...combates.entries()].find(
        ([agente, combate]) => !muriendo.has(agente) && enRangoPina(agente, combate)
      );
      if (!objetivo) {
        sfx.pinaAlAire();
        return;
      }
      sfx.pina();
      orientarHacia(player, objetivo[0].pos.x + objetivo[1].ancho / 2);
      conectarGolpeA(objetivo[0], objetivo[1]);
    });

    // Bala de Neo que alcanza a un Agente (el Jefe): cuenta como golpe conectado.
    k.onCollide("balaNeo", "agente", (bala: GameObj, agente: GameObj) => {
      k.destroy(bala);
      const combate = combates.get(agente);
      if (!combate || muriendo.has(agente) || bloqueado()) return;
      sfx.balaImpacto();
      conectarGolpeA(agente, combate);
    });

    // Bala del Jefe que alcanza a Neo.
    player.onCollide("balaJefe", (bala: GameObj) => {
      k.destroy(bala);
      const jefe = k.get("jefe").find((j) => combates.has(j));
      if (!jefe) return;
      golpearANeo(jefe, combates.get(jefe)!, "bala");
    });

    const comprobarNivelLimpio = () => {
      if (st.session.derrotado) return;
      if (k.get("agente").length > 0) return;
      if (!jefeApareceUnaVez) {
        jefeApareceUnaVez = true;
        spawnJefe();
        return;
      }
      st.session.completarModulo(moduloId);
      guardarPartida(st.session);
      sfx.victoria();
      // Portal a escala de Neo (160 de alto): una salida más baja que el
      // jugador se veía absurda con los sprites 3x.
      // Puerta propia de cada escenario (F17). Apoyada en el camino, no en el
      // centro de la pantalla: una salida flotando fuera de la calzada rompe la
      // lectura del recorrido.
      crearPortal(
        k,
        anchoNivel - 100,
        camino.centroEn(anchoNivel - 100 + ANCHO_PORTAL / 2) - ALTO_PORTAL,
        moduloId
      );
      player.onCollide("portal", () => k.go("zion"));
    };

    // Jefe de nivel (F11): tras limpiar los Agentes normales, uno más fuerte cierra el módulo.
    const spawnJefe = () => {
      mostrarAviso(
        "Un Agente Smith más fuerte bloquea la salida... ESPACIO = disparar. Esquivá sus tiros moviéndote.",
        6
      );
      const xJefe = anchoNivel - MARGEN_PORTAL - 80;
      const info = crearAgente(k, xJefe, ALTO / 2, true);
      // Plantado en el centro del camino: con 240 de alto, ALTO/2 lo dejaría con
      // los pies fuera del límite inferior. Ahí el camino ya es la arena abierta
      // (ver domain/camino.ts) — un pasillo estrecho volvería injusto esquivar.
      info.root.pos.y = k.clamp(
        camino.centroEn(xJefe + info.ancho / 2) - info.alto,
        CARRIL_SUPERIOR,
        CARRIL_INFERIOR - info.alto
      );
      registrarCombate(info, HP_JEFE);
      marcarActivo(info.root);
      actualizarHud();
    };

    /** Da aire tras cerrar una pregunta: el enemigo no puede pegar al instante. */
    const darGraciaPostPregunta = (agente: GameObj) => {
      const combate = combates.get(agente);
      if (combate) combate.proximoAtaque = k.time() + GRACIA_TRAS_PREGUNTA;
      invulnerableHasta = Math.max(invulnerableHasta, k.time() + GRACIA_TRAS_PREGUNTA);
    };

    // Resultado de la pregunta tras aturdir a un Agente (F12): la respuesta
    // correcta es la que baja el HP real; después el combate arcade continúa
    // (hay que volver a aturdirlo a golpes para la próxima pregunta).
    const registrarResultado = (agente: GameObj, correcta: boolean, feedback: string, esEstadoDelArte: boolean) => {
      enEncuentro = false;
      if (correcta) {
        sfx.acierto();
        st.session.registrarAcierto(moduloId, esEstadoDelArte);
        guardarPartida(st.session);
        const combate = combates.get(agente);
        if (!combate) {
          // Sin estado de combate registrado: red de seguridad, comportamiento anterior (1 golpe = 1 baja).
          k.destroy(agente);
          mostrarExplicacion(true, feedback, () => {
            actualizarHud();
            comprobarNivelLimpio();
          });
          return;
        }
        combate.estado = golpear(combate.estado);
        combate.barra.actualizar(combate.estado.hpActual, combate.estado.hpMaximo);
        // Pose de remate (F11 v3): acompaña al flash de golpe sobre el Agente
        // — escopeta contra el Jefe, piña contra los Smiths (F12).
        orientarHacia(player, agente.pos.x + combate.ancho / 2);
        fijarPose(player, agente.is("jefe") ? "disparo" : "ataque");
        k.wait(0.35, () => fijarPose(player, null));
        flashGolpe(k, agente, combate.ancho, combate.alto, ROJO);
        if (derrotado(combate.estado)) {
          // Derrota (F11 v3): el Agente cae (frame "derrota") y recién después
          // explota — `muriendo` evita que dispare encuentros en esa ventana.
          // La explicación se muestra antes de la explosión: el cartel ya está en
          // pantalla cuando el `k.wait(0.6)` detona la animación de explosión.
          combates.delete(agente);
          muriendo.add(agente);
          fijarPose(agente, "derrota");
          mostrarExplicacion(true, feedback);
          k.wait(0.6, () => {
            sfx.explosion();
            crearExplosion(k, agente.pos.x + combate.ancho / 2, agente.pos.y + combate.alto / 2);
            k.destroy(agente);
            actualizarHud();
            activarSiguienteEnCola();
            comprobarNivelLimpio();
          });
          return;
        }
        actualizarHud();
        // La explicación va sola en el panel: es lo que enseña. El estado del
        // combate es un aviso de refilo y se queda en el toast de abajo, que no
        // bloquea (ISSUE-013 AC-6) — mezclarlos diluía la explicación con una
        // pista de gameplay en el mismo cartel.
        mostrarExplicacion(true, feedback, () => {
          mostrarFeedback(true, `Agente ${combate.estado.hpActual}/${combate.estado.hpMaximo} HP — seguí a las piñas`);
          darGraciaPostPregunta(agente);
        });
        return;
      }
      sfx.fallo();
      st.session.registrarFallo(moduloId);
      guardarPartida(st.session);
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
      actualizarHud();
      if (st.session.derrotado) {
        // El gameover espera a que el jugador lea la explicación (se cierra por
        // tecla o por el timer calculado) y solo entonces cambia de escena.
        mostrarExplicacion(false, feedback, () => k.go("gameover"));
        return;
      }
      mostrarExplicacion(false, feedback, () => darGraciaPostPregunta(agente));
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
          k.text("AGENTE SMITH ATURDIDO — remátalo respondiendo:", { size: 16 }),
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

      // Cuenta atrás (F15): el Agente está aturdido, no dormido. Si el reloj
      // llega a cero se despierta y conecta el golpe — es lo que impide
      // congelar el combate y buscar la respuesta con calma en otra pestaña.
      const limite = dif.segundosParaResponder;
      const arranque = k.time();
      const reloj = k.add([
        k.text("", { size: 20 }),
        k.pos(ANCHO - 60, 80),
        k.anchor("right"),
        k.color(...VERDE),
        k.z(12),
        k.fixed(),
      ]);
      overlay.push(reloj);
      // Barra que se vacía: comunica la urgencia de un vistazo, sin leer números.
      const ANCHO_BARRA = ANCHO - 120;
      overlay.push(
        k.add([
          k.rect(ANCHO_BARRA, 4),
          k.pos(60, 104),
          k.color(...VERDE_OSCURO),
          k.opacity(0.35),
          k.z(11),
          k.fixed(),
        ])
      );
      const barra = k.add([
        k.rect(ANCHO_BARRA, 4),
        k.pos(60, 104),
        k.color(...VERDE),
        k.z(12),
        k.fixed(),
      ]);
      overlay.push(barra);
      let ultimoPitido = -1;
      const tic = k.onUpdate(() => {
        if (!enEncuentro) return;
        const estado = calcularCuentaAtras(limite - (k.time() - arranque), limite);
        reloj.text = estado.texto;
        reloj.color = k.rgb(...(estado.urgente ? ROJO : VERDE));
        barra.width = ANCHO_BARRA * estado.fraccion;
        barra.color = k.rgb(...(estado.urgente ? ROJO : VERDE));
        // Tres pitidos cortos (3, 2, 1) y uno largo al agotarse: el aviso se
        // oye sin mirar la pantalla. Un solo tono, sin melodía — la alarma no
        // compite con la música del nivel.
        if (!estado.agotado && estado.segundos <= 3 && estado.segundos !== ultimoPitido) {
          ultimoPitido = estado.segundos;
          sfx.cuentaAtras();
        }
        if (estado.agotado) seAcabaElTiempo();
      });
      teclas.push(tic);

      // Indicación explícita de las teclas para responder (sin corchetes — Kaplay
      // los parsea como tags). Dos correcciones de legibilidad sobre la versión
      // anterior, que era ilegible (reportado jugando):
      //  - Estaba centrada en ALTO-60 = 480, que es EXACTAMENTE la Y del borde
      //    inferior del panel (60 + ALTO-120): el texto se dibujaba encima de la
      //    línea verde brillante del contorno. Ahora va dentro del panel.
      //  - VERDE_OSCURO (0,120,40) sobre el negro del panel da 3.7:1, por debajo
      //    del 4.5:1 que pide WCAG AA para texto normal. VERDE da 15:1.
      overlay.push(
        k.add([
          k.text("Teclas 1, 2, 3 o 4 para responder", { size: 14 }),
          k.pos(ANCHO / 2, ALTO - 82),
          k.color(...VERDE),
          k.anchor("center"),
          k.z(11),
          k.fixed(),
        ])
      );

      // Smith adaptativo (F9): si venís fallando y hay IA, podés pedir una pista.
      const conPista = hayIA(st.ai) && st.session.nivelJugador(moduloId) === 1;
      if (conPista) {
        const aviso = k.add([
          // Mismo motivo que el cartel de teclas: VERDE_OSCURO sobre el panel
          // negro no llega al 4.5:1 de WCAG AA para texto de este tamaño.
          // `width` es obligatorio: este mismo objeto pasa a mostrar la pista del
          // Oráculo, que es texto libre de un modelo. Sin ancho, Kaplay no
          // envuelve y la pista se sale del panel por el lateral.
          k.text("P) Pedir una pista al Oráculo", { size: 14, width: ANCHO - 140 }),
          k.pos(60, ALTO - 132),
          k.color(...VERDE),
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
              // El modelo puede ignorar el límite de 30 palabras del prompt; el
              // panel no crece, así que se recorta antes de pintarlo.
              const texto = pista.trim().replace(/\s+/g, " ");
              const recortada = texto.length > 200 ? `${texto.slice(0, 197)}...` : texto;
              if (enEncuentro) aviso.text = `Oráculo: ${recortada}`;
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
        registrarResultado(agente, resultado.correcta, resultado.explicacion, reto.estadoDelArte2026);
      };

      /** Se acabó el tiempo: cuenta como fallo — Smith despierta y pega. No
       * pasa por `quiz.responderMultipleChoice`: ese método exige un índice
       * válido y lanza RangeError con -1. El reto ya quedó marcado al lanzarlo,
       * así que basta con registrar el fallo. */
      function seAcabaElTiempo(): void {
        if (!enEncuentro) return;
        cerrar();
        sfx.tiempoAgotado();
        registrarResultado(
          agente,
          false,
          `Se te acabó el tiempo y el Agente despertó. ${reto.explicacion}`,
          reto.estadoDelArte2026
        );
      }

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
      registrarResultado(agente, evaluacion.aprobado, evaluacion.feedback, reto.estadoDelArte2026);
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

    const iniciarEncuentro = (agente: GameObj) => {
      // Guarda de concurrencia (bug real encontrado jugando F11 v2): cualquier
      // función que pueda dispararse por más de un camino necesita esta guarda
      // — sin ella se crean dos overlays de pregunta a la vez.
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
      lanzarPregunta(agente, reto);
    };

    player.onCollide("oraculo", () => {
      if (bloqueado()) return;
      enEncuentro = true;
      // El Oráculo "habla" mientras el chat está abierto y saluda al cerrarlo.
      // El zoom de conversación (POSES_ORACULO) crece DETRÁS de Neo: antes se
      // le subía el z por encima del jugador y el manto lo tapaba entero —
      // leído como bug en el playtest. El jugador nunca pierde el primer plano.
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
        player.pos = k.vec2(70, oraculo.pos.y + ALTO_ORACULO + 24);
      });
    });
  });
}
