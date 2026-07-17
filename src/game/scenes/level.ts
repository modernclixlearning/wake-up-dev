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
import { QuizEngine } from "../../domain/quiz-engine";
import { Reto, RetoAbierta, RetoMultipleChoice } from "../../domain/reto";
import {
  ActorAgente,
  ALTO_AGENTE,
  ALTO_NEO,
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
import { reproducirMusica, sfx } from "../audio";
import { dibujarEscenario } from "../escenario";
import { GameState } from "../state";
import { ANCHO, ALTO, CARRIL_INFERIOR, CARRIL_SUPERIOR, VERDE, VERDE_OSCURO, ROJO, BLANCO, NEGRO } from "../theme";
import { abrirOraculo, abrirRetoAbierto, hayOverlayAbierto } from "../ui/overlay";

const VELOCIDAD = 220;
const VELOCIDAD_AGENTE = 100;
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
const COOLDOWN_ATAQUE_SMITH = 2;
const RECUPERACION_STAGGER = 0.9;
const GRACIA_TRAS_PREGUNTA = 1.2;
const INVULNERABLE_TRAS_GOLPE = 1.2;
// El empuje deja al Smith justo fuera del alcance de la piña (34): los dos
// tienen que volver a cerrar la distancia y el intercambio respira.
const EMPUJE_SMITH_GOLPEADO = 40;
const EMPUJE_NEO_GOLPEADO = 110;
const CADENCIA_DISPARO_JEFE = 1.6;
const DISTANCIA_DISPARO_JEFE = 300;
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
    // Más baja que la del menú: en el nivel compite con los SFX del combate.
    reproducirMusica("musica-nivel.mp3", 0.35);
    const quiz = new QuizEngine(banco);
    const respondidos = new Set<string>();
    const combates = new Map<GameObj, Combate>();
    /** Agentes en su animación de derrota (F11 v3): siguen en pantalla ~0.6s
     * antes de explotar, pero ya no deben disparar encuentros nuevos. */
    const muriendo = new Set<GameObj>();
    let enEncuentro = false;
    let jefeApareceUnaVez = false;
    let avisoTutorialDado = false;
    /** Ventana de invulnerabilidad de Neo tras recibir un golpe (evita el chain-hit). */
    let invulnerableHasta = 0;
    let proximaPina = 0;
    const bloqueado = () => enEncuentro || hayOverlayAbierto();
    const esInvulnerable = () => k.time() < invulnerableHasta;

    const nAgentes = Math.min(MAX_AGENTES, quiz.restantes);
    const anchoNivel = MARGEN_INICIO + Math.max(1, nAgentes) * SEPARACION_AGENTE + MARGEN_JEFE + MARGEN_PORTAL;

    dibujarEscenario(k, moduloId, anchoNivel);

    // HUD: fijo a la pantalla (k.fixed) — sin esto, al mover la cámara con el
    // scroll del pasillo el texto se iría del cuadro junto con el mundo.
    const hud = k.add([k.text("", { size: 16 }), k.pos(16, 12), k.color(...VERDE), k.z(5), k.fixed()]);
    const actualizarHud = () => {
      hud.text = `${banco.modulo.nombre}  |  Vidas: ${st.session.vidas}  Score: ${st.session.score}  Agentes: ${k.get("agente").length}`;
    };
    k.add([
      k.text("Flechas: moverte   ESPACIO: atacar   M: sonido", { size: 12 }),
      k.pos(16, 34),
      k.color(...VERDE_OSCURO),
      k.z(5),
      k.fixed(),
    ]);

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

    // Aviso neutro en pantalla (instrucciones, anuncios): sin el prefijo
    // CORRECTO/FALLASTE de mostrarFeedback y un poco más arriba para no pisarlo.
    const mostrarAviso = (texto: string, duracion = 4) => {
      const msg = k.add([
        k.text(texto, { size: 14, width: ANCHO - 120 }),
        k.pos(60, ALTO - 80),
        k.color(...VERDE),
        k.z(6),
        k.fixed(),
      ]);
      k.wait(duracion, () => k.destroy(msg));
    };

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

    // Al caer el Agente activo, le pasa el turno al siguiente de la cola que siga con vida.
    const activarSiguienteEnCola = () => {
      const siguiente = colaAgentes.find((a) => combates.get(a) && !combates.get(a)!.activo);
      if (siguiente) marcarActivo(siguiente);
    };

    // ---- Golpes del enemigo hacia Neo ----

    /** Neo recibe un golpe físico (piña del Smith o bala del Jefe): -1 vida. */
    const golpearANeo = (agente: GameObj, combate: Combate) => {
      if (esInvulnerable() || bloqueado()) return;
      invulnerableHasta = k.time() + INVULNERABLE_TRAS_GOLPE;
      combate.fase = recibirGolpe(combate.fase);
      st.session.recibirGolpeFisico();
      sfx.golpeRecibido();
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
        combate.proximoAtaque = k.time() + COOLDOWN_ATAQUE_SMITH;
        if (bloqueado()) return;
        if (enRangoPina(agente, combate)) golpearANeo(agente, combate);
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
      const destino = k.vec2(player.pos.x + ANCHO_NEO / 2, player.pos.y + ALTO_NEO / 2);
      const centro = k.vec2(jefe.pos.x + combate.ancho / 2, jefe.pos.y + combate.alto * 0.43);
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

    // Persecución (F12): el Smith activo va hacia Neo y, cuando lo alcanza,
    // telegrafía y pega — si no te defendés ni esquivás, te saca vidas. El
    // Jefe avanza lento y pelea a distancia (sus tiros salen de su propio loop).
    const iniciarPersecucion = (agente: GameObj) => {
      const esJefe = agente.is("jefe");
      agente.onUpdate(() => {
        const combate = combates.get(agente);
        if (!combate || !combate.activo || bloqueado() || muriendo.has(agente)) return;
        if (combate.atacando) return;
        const hacia = player.pos.sub(agente.pos);
        const distancia = hacia.len();
        const gap = gapHorizontal(agente, combate);
        const frenado = esJefe
          ? gap <= DISTANCIA_DISPARO_JEFE
          : gap <= RANGO_FRENO_SMITH && alineadosEnY(agente, combate);
        if (!frenado && distancia > 4) {
          const velocidad = esJefe ? VELOCIDAD_JEFE : VELOCIDAD_AGENTE;
          const paso = Math.min(1, (velocidad * k.dt()) / distancia);
          agente.pos = agente.pos.add(hacia.scale(paso));
        }
        agente.pos.y = k.clamp(agente.pos.y, CARRIL_SUPERIOR, CARRIL_INFERIOR - combate.alto);
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

    // ---- Ataque de Neo (F12): ESPACIO = piña contra Smiths / disparo contra el Jefe ----

    /** El enemigo quedó aturdido: bonus de la fase y se abre la pregunta. */
    const aturdir = (agente: GameObj, combate: Combate) => {
      sfx.aturdido();
      st.session.score += calcularBonusFase(combate.fase);
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
      flashGolpe(k, agente, combate.ancho, combate.alto, BLANCO);
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
      sfx.pina();
      conectarGolpeA(agente, combate);
    });

    // Bala del Jefe que alcanza a Neo.
    player.onCollide("balaJefe", (bala: GameObj) => {
      k.destroy(bala);
      const jefe = k.get("jefe").find((j) => combates.has(j));
      if (!jefe) return;
      golpearANeo(jefe, combates.get(jefe)!);
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
      sfx.victoria();
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
      mostrarAviso(
        "Un Agente Smith más fuerte bloquea la salida... ESPACIO = disparar. Esquivá sus tiros moviéndote.",
        6
      );
      const info = crearAgente(k, anchoNivel - MARGEN_PORTAL - 80, ALTO / 2, true);
      // Centrado vertical en el carril: con 240 de alto, ALTO/2 lo dejaría
      // con los pies fuera del límite inferior.
      info.root.pos.y = CARRIL_SUPERIOR + (CARRIL_INFERIOR - CARRIL_SUPERIOR - info.alto) / 2;
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
    const registrarResultado = (agente: GameObj, correcta: boolean, feedback: string, esBonus: boolean) => {
      enEncuentro = false;
      if (correcta) {
        sfx.acierto();
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
        // Pose de remate (F11 v3): acompaña al flash de golpe sobre el Agente
        // — escopeta contra el Jefe, piña contra los Smiths (F12).
        orientarHacia(player, agente.pos.x + combate.ancho / 2);
        fijarPose(player, agente.is("jefe") ? "disparo" : "ataque");
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
            sfx.explosion();
            crearExplosion(k, agente.pos.x + combate.ancho / 2, agente.pos.y + combate.alto / 2);
            k.destroy(agente);
            actualizarHud();
            activarSiguienteEnCola();
            comprobarNivelLimpio();
          });
          return;
        }
        mostrarFeedback(true, `${feedback}  (Agente ${combate.estado.hpActual}/${combate.estado.hpMaximo} HP — seguí a las piñas)`);
        actualizarHud();
        darGraciaPostPregunta(agente);
        return;
      }
      sfx.fallo();
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
      darGraciaPostPregunta(agente);
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
