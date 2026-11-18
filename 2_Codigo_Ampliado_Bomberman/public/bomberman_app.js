/**
 * bomberman_app.js - Motor Bomberman 20x20 (fiel a jhoukem/Bomberman en C/SDL2)
 * conectado en tiempo real a MySQL/MariaDB (bomberman_db)
 * Equipo #13 - UAA - Bases de Datos
 */

const WIDTH = 480;
const HEIGHT = 480;
const SIZE = 20;
const CELL_SIZE = WIDTH / SIZE; // 24 px
const NB_BOMBERMAN = 4;

const CELL_TYPE = { GROUND: 0, WALL: 1, WALL_BREAKABLE: 2 };
const BONUS_TYPE = {
    MOREPOWER: { id: 1, code: 'MOREPOWER', pts: 100, sx: 68, sy: 131 },
    MOREBOMB:  { id: 2, code: 'MOREBOMB',  pts: 100, sx: 0,  sy: 131 },
    MORESPEED: { id: 3, code: 'MORESPEED', pts: 120, sx: 17, sy: 131 },
    MALUS:     { id: 4, code: 'MALUS',     pts: 25,  sx: 85, sy: 131 },
    MAXPOWER:  { id: 5, code: 'MAXPOWER',  pts: 250, sx: 102, sy: 131 }
};

// Estado de sesión y conexión a BD
let idUsuarioActivo = 1;
let nombreUsuarioActivo = 'angel_munoz';
let idSesionActiva = 101;
let idMapaActivo = 1;
let murosInicialesMapa = 150;
let skinOffsetY = 0;

// Contadores de partida
let inicioPartidaMs = Date.now();
let partidaTerminada = false;
let partidaPausada = false;
let puntosPartida = 0;
let bombasColocadas = 0;
let murosDestruidos = 0;
let botsEliminados = 0;
let powerupsRecogidos = [];

// Recursos gráficos y sonoros originales de rsc/
const spritesheet = new Image();
spritesheet.src = '/rsc/spritesheet.png';
const sfxExplosion = new Audio('/rsc/explosion.wav');
const sfxPowerUp = new Audio('/rsc/power_up.wav');
sfxExplosion.volume = 0.25;
sfxPowerUp.volume = 0.25;

const canvas = document.getElementById('bomberman-board');
const ctx = canvas.getContext('2d');

let grid = [];
let players = [];
let activeBombs = [];
let groundSpriteX = 119;
let wallBreakableSpriteX = 17;

// =========================================================================
// 1. COMUNICACIÓN CON EL BACKEND NODE.JS + MYSQL (bomberman_db)
// =========================================================================

async function iniciarSesionBD() {
    try {
        const res = await fetch('/api/sesiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: idUsuarioActivo,
                sistema_operativo: navigator.platform || 'Windows 11 x64',
                motor_ejecucion: 'HTML5 Canvas + SDL2 Assets'
            })
        });
        const data = await res.json();
        if (data.id_sesion) idSesionActiva = data.id_sesion;
    } catch (e) {
        console.warn('Modo offline local:', e);
    }
}

async function registrarInteraccion(categoriaEvento, origenElemento, detalleValor, idComando = null) {
    try {
        await fetch('/api/interacciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: idUsuarioActivo,
                id_sesion: idSesionActiva,
                id_comando: idComando,
                categoria_evento: categoriaEvento,
                origen_elemento: origenElemento,
                detalle_valor: detalleValor
            })
        });
        await cargarBitacoraReciente();
        await actualizarEstadisticasJugador(idUsuarioActivo);
    } catch (e) {
        console.warn('Error registrando interacción:', e);
    }
}

async function registrarFinPartida(resultadoPartida) {
    const duracionSegundos = Math.max(1, Math.floor((Date.now() - inicioPartidaMs) / 1000));
    if (resultadoPartida === 'Victoria') {
        puntosPartida += 500;
    }

    // Extraer muestra de celdas para la entidad débil CELDA_MAPA
    const celdasMuestra = [];
    for (let y = 0; y < SIZE && celdasMuestra.length < 8; y += 4) {
        for (let x = 0; x < SIZE && celdasMuestra.length < 8; x += 5) {
            const cell = grid[y][x];
            celdasMuestra.push({
                num_celda: y * SIZE + x + 1,
                pos_fila_y: y,
                pos_col_x: x,
                tipo_celda: cell.initialType === CELL_TYPE.WALL ? 'WALL' :
                            cell.initialType === CELL_TYPE.WALL_BREAKABLE ? 'WALL_BREAKABLE' : 'GROUND',
                tiene_portal_wrap: (y === SIZE / 2 && (x === 0 || x === SIZE - 1)) || (x === SIZE / 2 && (y === 0 || y === SIZE - 1)),
                estado_final_celda: cell.bonus ? 'Con_Bonus' :
                                    (cell.initialType === CELL_TYPE.WALL_BREAKABLE && cell.type === CELL_TYPE.GROUND) ? 'Destruida' :
                                    (cell.type === CELL_TYPE.WALL ? 'Intacta' : 'Libre')
            });
        }
    }

    try {
        await fetch('/api/partidas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: idUsuarioActivo,
                id_sesion: idSesionActiva,
                id_mapa: idMapaActivo,
                duracion_segundos: duracionSegundos,
                resultado: resultadoPartida,
                puntos_obtenidos: puntosPartida,
                bombas_colocadas: bombasColocadas,
                muros_destruidos: murosDestruidos,
                bots_eliminados: botsEliminados,
                celdas_muestra: celdasMuestra,
                powerups_recogidos: powerupsRecogidos
            })
        });
        await cargarUsuariosYRanking();
        await actualizarEstadisticasJugador(idUsuarioActivo);
    } catch (e) {
        console.warn('Error registrando partida:', e);
    }
}

async function cargarUsuariosYRanking() {
    const res = await fetch('/api/usuarios');
    const usuarios = await res.json();

    const sel = document.getElementById('selector-usuario');
    sel.innerHTML = '';
    usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id_usuario;
        opt.textContent = `${u.nombre_usuario} (ID: ${u.id_usuario} - ${u.puntos_acumulados} pts)`;
        if (u.id_usuario === idUsuarioActivo) opt.selected = true;
        sel.appendChild(opt);
    });

    const tbody = document.querySelector('#tabla-ranking tbody');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const ratio = u.derrotas === 0 ? Number(u.victorias).toFixed(2) : Number(u.relacion_v_d).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id_usuario}</td>
            <td><b>${u.nombre_usuario}</b></td>
            <td>${u.partidas_jugadas}</td>
            <td>${u.puntos_acumulados}</td>
            <td>${u.victorias}V / ${u.derrotas}D</td>
            <td class="txt-gold">${ratio}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function actualizarEstadisticasJugador(idUsuario) {
    const res = await fetch(`/api/estadisticas/${idUsuario}`);
    const data = await res.json();
    if (!data.jugador) return;
    const j = data.jugador;
    nombreUsuarioActivo = j.nombre_usuario;

    document.getElementById('stat-id').textContent = j.id_usuario;
    document.getElementById('stat-nombre').textContent = j.nombre_usuario;
    document.getElementById('stat-rango').textContent = j.nombre_rango;
    document.getElementById('stat-partidas').textContent = j.partidas_jugadas;
    document.getElementById('stat-tiempo').textContent = `${j.tiempo_total_seg} s (${j.tiempo_formateado})`;
    document.getElementById('stat-puntos').textContent = j.puntos_acumulados;
    document.getElementById('stat-victorias').textContent = j.victorias;
    document.getElementById('stat-derrotas').textContent = j.derrotas;
    const ratioVD = j.derrotas === 0 ? Number(j.victorias).toFixed(2) : Number(j.relacion_v_d).toFixed(2);
    document.getElementById('stat-vd').textContent = ratioVD;
    document.getElementById('stat-clics').textContent = j.total_clics;
    document.getElementById('stat-teclado').textContent = j.total_comandos_teclado;
    document.getElementById('stat-menu').textContent = j.total_interacciones_menu;
}

async function cargarMapas() {
    const res = await fetch('/api/mapas');
    const mapas = await res.json();
    const sel = document.getElementById('selector-mapa');
    sel.innerHTML = '';
    mapas.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id_mapa;
        opt.dataset.muros = m.muros_destructibles_iniciales;
        opt.textContent = `${m.nombre_escenario} (${m.muros_destructibles_iniciales} muros)`;
        sel.appendChild(opt);
    });
}

async function cargarBitacoraReciente() {
    const res = await fetch('/api/interacciones/recientes');
    const logs = await res.json();
    const tbody = document.querySelector('#tabla-interacciones tbody');
    tbody.innerHTML = '';
    logs.slice(0, 10).forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.num_secuencia}</td>
            <td>${l.categoria_evento}</td>
            <td>${l.origen_elemento} · <small>${l.detalle_valor || ''}</small></td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 2. LÓGICA DEL JUEGO BOMBERMAN (FIEL A board.c, bomberman.c, bomb.c, bonus.c, ai.c)
// =========================================================================

function resetBoard() {
    grid = [];
    activeBombs = [];
    for (let i = 0; i < SIZE; i++) {
        grid[i] = [];
        for (let j = 0; j < SIZE; j++) {
            let type = CELL_TYPE.GROUND;
            if (i === 0 || j === 0 || i === SIZE - 1 || j === SIZE - 1) {
                type = CELL_TYPE.WALL;
            }
            grid[i][j] = { type, initialType: type, bomb: null, bonus: null };
        }
    }
    // 4 portales de borde para map wrapping (board.c líneas 110-113)
    grid[SIZE / 2][0].type = grid[SIZE / 2][0].initialType = CELL_TYPE.GROUND;
    grid[SIZE / 2][SIZE - 1].type = grid[SIZE / 2][SIZE - 1].initialType = CELL_TYPE.GROUND;
    grid[0][SIZE / 2].type = grid[0][SIZE / 2].initialType = CELL_TYPE.GROUND;
    grid[SIZE - 1][SIZE / 2].type = grid[SIZE - 1][SIZE / 2].initialType = CELL_TYPE.GROUND;

    // Bloques destructibles respetando las 4 esquinas (offset = 3)
    const offset = 3;
    for (let k = 0; k < murosInicialesMapa; k++) {
        let sx, sy;
        do {
            sx = 1 + Math.floor(Math.random() * (SIZE - 2));
            sy = 1 + Math.floor(Math.random() * (SIZE - 2));
        } while (
            (sx <= 3 && sy <= 3) ||
            (sx <= 3 && SIZE - sy <= offset) ||
            (sy <= 3 && SIZE - sx <= offset) ||
            (SIZE - sx <= offset && SIZE - sy <= offset)
        );
        grid[sy][sx].type = CELL_TYPE.WALL_BREAKABLE;
        grid[sy][sx].initialType = CELL_TYPE.WALL_BREAKABLE;
    }

    const aleaG = Math.floor(Math.random() * 4);
    groundSpriteX = 68 + aleaG + aleaG * 16;
    const aleaW = Math.floor(Math.random() * 3);
    wallBreakableSpriteX = 17 + aleaW + aleaW * 16;
}

function resetBomberman() {
    const spawns = [
        { gx: 1, gy: 1, sy: skinOffsetY },
        { gx: SIZE - 2, gy: 1, sy: 24 },
        { gx: 1, gy: SIZE - 2, sy: 48 },
        { gx: SIZE - 2, gy: SIZE - 2, sy: 72 }
    ];
    players = spawns.map((sp, idx) => ({
        id: idx,
        gx: sp.gx,
        gy: sp.gy,
        direction: 0, // 0: DOWN, 1: LEFT, 2: RIGHT, 3: UP
        bomb_left: 3,
        bomb_power: 3,
        speed: 1.5,
        is_dead: false,
        spriteY: sp.sy,
        aiCooldown: 0
    }));
}

function resetGame() {
    resetBoard();
    resetBomberman();
    inicioPartidaMs = Date.now();
    partidaTerminada = false;
    partidaPausada = false;
    puntosPartida = 0;
    bombasColocadas = 0;
    murosDestruidos = 0;
    botsEliminados = 0;
    powerupsRecogidos = [];
    document.getElementById('status-overlay').classList.add('hidden');
    actualizarHUD();
}

function wrapCoord(v) {
    if (v >= SIZE) return 0;
    if (v < 0) return SIZE - 1;
    return v;
}

function moveBomberman(player, dir) {
    if (player.is_dead || partidaTerminada || partidaPausada) return false;
    player.direction = dir;
    const dx = dir === 1 ? -1 : dir === 2 ? 1 : 0;
    const dy = dir === 3 ? -1 : dir === 0 ? 1 : 0;
    const nx = wrapCoord(player.gx + dx);
    const ny = wrapCoord(player.gy + dy);

    if (grid[ny][nx].type === CELL_TYPE.GROUND && !grid[ny][nx].bomb) {
        player.gx = nx;
        player.gy = ny;
        if (grid[ny][nx].bonus) {
            applyBonusOnBomberman(ny, nx, player);
        }
        return true;
    }
    return false;
}

function spawnBonus(y, x) {
    const alea = Math.floor(Math.random() * 100);
    if (alea < 10) grid[y][x].bonus = BONUS_TYPE.MALUS;
    else if (alea < 30) grid[y][x].bonus = BONUS_TYPE.MORESPEED;
    else if (alea < 60) grid[y][x].bonus = BONUS_TYPE.MOREBOMB;
    else if (alea < 95) grid[y][x].bonus = BONUS_TYPE.MOREPOWER;
    else grid[y][x].bonus = BONUS_TYPE.MAXPOWER;
}

function applyBonusOnBomberman(y, x, player) {
    const bonus = grid[y][x].bonus;
    if (!bonus) return;
    sfxPowerUp.currentTime = 0;
    sfxPowerUp.play().catch(() => {});

    if (player.speed === 1.0) player.speed = 1.5;

    if (bonus.code === 'MOREBOMB') player.bomb_left++;
    else if (bonus.code === 'MOREPOWER' && player.bomb_power < (SIZE / 2) - 1) player.bomb_power++;
    else if (bonus.code === 'MORESPEED' && player.speed + 0.3 <= 3.0) player.speed = Number((player.speed + 0.3).toFixed(1));
    else if (bonus.code === 'MALUS') player.speed = 1.0;
    else if (bonus.code === 'MAXPOWER') player.bomb_power = (SIZE / 2) - 1;

    if (player.id === 0) {
        puntosPartida += bonus.pts;
        powerupsRecogidos.push({
            id_powerup: bonus.id,
            cantidad: 1,
            segundo: Math.max(1, Math.floor((Date.now() - inicioPartidaMs) / 1000))
        });
    }
    grid[y][x].bonus = null;
    actualizarHUD();
}

function dropBomb(player) {
    if (player.is_dead || partidaTerminada || partidaPausada) return;
    if (player.bomb_left <= 0 || grid[player.gy][player.gx].bomb) return;

    player.bomb_left--;
    const bomb = {
        x: player.gx,
        y: player.gy,
        owner: player,
        power: player.bomb_power,
        timer: 90,
        has_explode: false,
        flameCells: []
    };
    grid[player.gy][player.gx].bomb = bomb;
    activeBombs.push(bomb);

    if (player.id === 0) {
        bombasColocadas++;
        actualizarHUD();
    }
}

function explodeAround(bomb) {
    if (bomb.has_explode) return;
    bomb.has_explode = true;
    bomb.timer = 18;
    bomb.owner.bomb_left++;
    sfxExplosion.currentTime = 0;
    sfxExplosion.play().catch(() => {});

    const cells = [{ x: bomb.x, y: bomb.y }];
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    for (const d of dirs) {
        for (let step = 1; step <= bomb.power; step++) {
            const cy = wrapCoord(bomb.y + d.dy * step);
            const cx = wrapCoord(bomb.x + d.dx * step);
            const cell = grid[cy][cx];

            if (cell.bonus) cell.bonus = null;

            if (cell.bomb && !cell.bomb.has_explode) {
                explodeAround(cell.bomb);
                break;
            }

            if (cell.type === CELL_TYPE.WALL) {
                break;
            }
            cells.push({ x: cx, y: cy });

            if (cell.type === CELL_TYPE.WALL_BREAKABLE) {
                cell.type = CELL_TYPE.GROUND;
                if (bomb.owner.id === 0) {
                    murosDestruidos++;
                    puntosPartida += 25;
                }
                if (Math.floor(Math.random() * 8) === 0) {
                    spawnBonus(cy, cx);
                }
                break;
            }
        }
    }
    bomb.flameCells = cells;
    handleDamages(bomb);
}

function handleDamages(bomb) {
    for (const fc of bomb.flameCells) {
        for (const p of players) {
            if (!p.is_dead && p.gx === fc.x && p.gy === fc.y) {
                p.is_dead = true;
                if (p.id > 0) {
                    botsEliminados++;
                    puntosPartida += 300;
                }
            }
        }
    }
}

function computeDangerMap(extraBomb = null) {
    const danger = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const bombsToCheck = extraBomb ? [...activeBombs, extraBomb] : activeBombs;
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];

    for (const b of bombsToCheck) {
        danger[b.y][b.x] = true;
        if (b.has_explode && b.flameCells) {
            for (const fc of b.flameCells) {
                danger[fc.y][fc.x] = true;
            }
            continue;
        }
        for (const d of dirs) {
            for (let step = 1; step <= b.power; step++) {
                const cy = wrapCoord(b.y + d.dy * step);
                const cx = wrapCoord(b.x + d.dx * step);
                const cell = grid[cy][cx];
                if (cell.type === CELL_TYPE.WALL) break;
                danger[cy][cx] = true;
                if (cell.type === CELL_TYPE.WALL_BREAKABLE) break;
            }
        }
    }
    return danger;
}

function bfsFindMove(startY, startX, goalPredicate, maxDepth = 12, allowDangerTraverse = false, dangerMap = null) {
    const dMap = dangerMap || computeDangerMap();
    const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const dirs = [
        { dir: 0, dx: 0, dy: 1 },  // DOWN
        { dir: 1, dx: -1, dy: 0 }, // LEFT
        { dir: 2, dx: 1, dy: 0 },  // RIGHT
        { dir: 3, dx: 0, dy: -1 }  // UP
    ];
    // Mezclar ligeramente el orden de direcciones para que los 3 bots no elijan patrones idénticos
    for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    const queue = [];
    visited[startY][startX] = true;

    for (const d of dirs) {
        const ny = wrapCoord(startY + d.dy);
        const nx = wrapCoord(startX + d.dx);
        if (grid[ny][nx].type !== CELL_TYPE.GROUND || grid[ny][nx].bomb) continue;
        if (!allowDangerTraverse && dMap[ny][nx]) continue;
        visited[ny][nx] = true;
        queue.push({ y: ny, x: nx, firstDir: d.dir, dist: 1 });
    }

    while (queue.length > 0) {
        const curr = queue.shift();
        if (goalPredicate(curr.y, curr.x, curr.dist, dMap)) {
            return { dir: curr.firstDir, dist: curr.dist };
        }
        if (curr.dist >= maxDepth) continue;

        for (const d of dirs) {
            const ny = wrapCoord(curr.y + d.dy);
            const nx = wrapCoord(curr.x + d.dx);
            if (visited[ny][nx]) continue;
            if (grid[ny][nx].type !== CELL_TYPE.GROUND || grid[ny][nx].bomb) continue;
            if (!allowDangerTraverse && dMap[ny][nx]) continue;
            visited[ny][nx] = true;
            queue.push({ y: ny, x: nx, firstDir: curr.firstDir, dist: curr.dist + 1 });
        }
    }
    return null;
}

function canBotSafelyDropBomb(bot) {
    if (bot.bomb_left <= 0 || grid[bot.gy][bot.gx].bomb) return false;
    const simDanger = computeDangerMap({ x: bot.gx, y: bot.gy, power: bot.bomb_power, has_explode: false });
    const escape = bfsFindMove(
        bot.gy,
        bot.gx,
        (y, x, dist, dMap) => !dMap[y][x],
        5,
        true,
        simDanger
    );
    return escape !== null && escape.dist <= 4;
}

function hasAdjacentTarget(bot) {
    const dirs = [
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }
    ];
    let nearBreakable = false;
    let nearEnemy = false;

    for (const d of dirs) {
        const ny = wrapCoord(bot.gy + d.dy);
        const nx = wrapCoord(bot.gx + d.dx);
        if (grid[ny][nx].type === CELL_TYPE.WALL_BREAKABLE) {
            nearBreakable = true;
        }
        for (const p of players) {
            if (!p.is_dead && p.id !== bot.id && Math.abs(p.gx - bot.gx) + Math.abs(p.gy - bot.gy) <= 2) {
                nearEnemy = true;
            }
        }
    }
    return { nearBreakable, nearEnemy };
}

function updateAIBots() {
    const dangerMap = computeDangerMap();

    for (let i = 1; i < NB_BOMBERMAN; i++) {
        const bot = players[i];
        if (bot.is_dead) continue;
        bot.aiCooldown++;
        // Si el bot está en peligro se mueve más rápido para escapar a tiempo
        const requiredTicks = dangerMap[bot.gy][bot.gx] ? 8 : 13;
        if (bot.aiCooldown < requiredTicks) continue;
        bot.aiCooldown = 0;

        // 1. MODO DEFENSIVO (set_new_defense_goal en ai.c): Si está en zona de explosión, huir por BFS a la celda segura más cercana
        if (dangerMap[bot.gy][bot.gx]) {
            const escapeMove = bfsFindMove(
                bot.gy,
                bot.gx,
                (y, x, dist, dMap) => !dMap[y][x],
                8,
                true,
                dangerMap
            );
            if (escapeMove) {
                moveBomberman(bot, escapeMove.dir);
            }
            continue;
        }

        // 2. MODO OFENSIVO TÁCTICO: Evaluar si conviene colocar una bomba (solo si tiene escape BFS garantizado)
        const { nearBreakable, nearEnemy } = hasAdjacentTarget(bot);
        if ((nearEnemy || (nearBreakable && Math.random() < 0.45)) && canBotSafelyDropBomb(bot)) {
            dropBomb(bot);
            // Inmediatamente dar el primer paso hacia la celda segura tras soltar la bomba
            const postBombDanger = computeDangerMap();
            const immediateEscape = bfsFindMove(
                bot.gy,
                bot.gx,
                (y, x, dist, dMap) => !dMap[y][x],
                6,
                true,
                postBombDanger
            );
            if (immediateEscape) {
                moveBomberman(bot, immediateEscape.dir);
            }
            continue;
        }

        // 3. RECOLECCIÓN DE POWER-UPS SEGUROS CERCANOS (excluyendo MALUS)
        const bonusMove = bfsFindMove(
            bot.gy,
            bot.gx,
            (y, x) => grid[y][x].bonus && grid[y][x].bonus.code !== 'MALUS',
            6,
            false,
            dangerMap
        );
        if (bonusMove) {
            moveBomberman(bot, bonusMove.dir);
            continue;
        }

        // 4. PERSECUCIÓN AL JUGADOR HUMANO O AVANCE HACIA MUROS DESTRUCTIBLES (sin pisar celdas peligrosas)
        const human = players[0];
        const huntMove = bfsFindMove(
            bot.gy,
            bot.gx,
            (y, x) => {
                if (human && !human.is_dead && Math.abs(x - human.gx) + Math.abs(y - human.gy) <= 1) {
                    return true;
                }
                // Si el camino al jugador está cerrado por muros, acercarse a un WALL_BREAKABLE en dirección al jugador
                const adjDirs = [{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:0},{dx:-1,dy:0}];
                return adjDirs.some(d => grid[wrapCoord(y + d.dy)][wrapCoord(x + d.dx)].type === CELL_TYPE.WALL_BREAKABLE);
            },
            14,
            false,
            dangerMap
        );

        if (huntMove) {
            moveBomberman(bot, huntMove.dir);
        } else {
            // Movimiento de patrullaje seguro (nunca entra en dangerMap)
            const safePatrol = bfsFindMove(
                bot.gy,
                bot.gx,
                (y, x, dist) => dist >= 2,
                4,
                false,
                dangerMap
            );
            if (safePatrol) {
                moveBomberman(bot, safePatrol.dir);
            }
        }
    }
}

function updateBoard() {
    if (partidaTerminada || partidaPausada) return;

    updateAIBots();

    for (let i = activeBombs.length - 1; i >= 0; i--) {
        const b = activeBombs[i];
        b.timer--;
        if (b.has_explode) {
            handleDamages(b);
            if (b.timer <= 0) {
                grid[b.y][b.x].bomb = null;
                activeBombs.splice(i, 1);
            }
        } else if (b.timer <= 0) {
            explodeAround(b);
        }
    }

    const humanAlive = !players[0].is_dead;
    const botsAlive = players.slice(1).filter(b => !b.is_dead).length;
    actualizarHUD();

    if (!humanAlive || botsAlive === 0) {
        partidaTerminada = true;
        const overlay = document.getElementById('status-overlay');
        const title = document.getElementById('overlay-title');
        const subtitle = document.getElementById('overlay-subtitle');
        overlay.classList.remove('hidden');

        if (humanAlive && botsAlive === 0) {
            title.textContent = 'VICTORIA!';
            title.style.color = '#4ade80';
            subtitle.textContent = `¡Eliminaste a los 3 bots! Puntos: ${puntosPartida + 500}`;
            registrarFinPartida('Victoria');
        } else {
            title.textContent = 'GAME OVER';
            title.style.color = '#ff8c00';
            subtitle.textContent = 'Has caído ante una explosión · Presiona ESC';
            registrarFinPartida('Derrota');
        }
    }
}

function renderBoard() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const cell = grid[y][x];
            const dx = x * CELL_SIZE;
            const dy = y * CELL_SIZE;

            if (spritesheet.complete && spritesheet.naturalWidth > 0) {
                if (cell.bonus) {
                    ctx.drawImage(spritesheet, cell.bonus.sx, cell.bonus.sy, 16, 16, dx, dy, CELL_SIZE, CELL_SIZE);
                } else if (cell.type === CELL_TYPE.GROUND) {
                    ctx.drawImage(spritesheet, groundSpriteX, 114, 16, 16, dx, dy, CELL_SIZE, CELL_SIZE);
                } else if (cell.type === CELL_TYPE.WALL) {
                    ctx.drawImage(spritesheet, 0, 114, 16, 16, dx, dy, CELL_SIZE, CELL_SIZE);
                } else if (cell.type === CELL_TYPE.WALL_BREAKABLE) {
                    ctx.drawImage(spritesheet, wallBreakableSpriteX, 114, 16, 16, dx, dy, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }

    // Dibujar bombas y flamas de explosión
    for (const b of activeBombs) {
        if (!b.has_explode) {
            const frame = Math.floor(Date.now() / 300) % 3;
            ctx.drawImage(spritesheet, frame * 16, 96, 16, 17, b.x * CELL_SIZE, b.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else {
            for (const fc of b.flameCells) {
                ctx.drawImage(spritesheet, 175, 131, 16, 16, fc.x * CELL_SIZE, fc.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    // Dibujar los 4 Bomberman
    for (const p of players) {
        const dx = p.gx * CELL_SIZE;
        const dy = p.gy * CELL_SIZE;
        if (p.is_dead) {
            ctx.drawImage(spritesheet, 192 + 48, p.spriteY, 16, 24, dx, dy, CELL_SIZE, CELL_SIZE);
        } else {
            const sx = p.direction * (3 * 16);
            ctx.drawImage(spritesheet, sx, p.spriteY, 16, 24, dx, dy, CELL_SIZE, CELL_SIZE);
        }
    }
}

function actualizarHUD() {
    if (!players.length) return;
    const seg = Math.floor((Date.now() - inicioPartidaMs) / 1000);
    const botsAlive = players.slice(1).filter(b => !b.is_dead).length;
    document.getElementById('hud-tiempo').textContent = `${seg}s`;
    document.getElementById('hud-puntos').textContent = puntosPartida;
    document.getElementById('hud-bombas').textContent = players[0].bomb_left;
    document.getElementById('hud-poder').textContent = players[0].bomb_power;
    document.getElementById('hud-vel').textContent = players[0].speed;
    document.getElementById('hud-bots').textContent = botsAlive;
}

// =========================================================================
// 3. MANEJADORES DE EVENTOS (TECLADO, CLICS DE RATÓN, TOUCH Y MENÚS)
// =========================================================================

document.addEventListener('keydown', (e) => {
    const p0 = players[0];
    if (!p0) return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        moveBomberman(p0, 3);
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_UP (move_up)', 1);
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        moveBomberman(p0, 0);
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_DOWN (move_down)', 2);
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        moveBomberman(p0, 1);
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_LEFT (move_left)', 3);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        moveBomberman(p0, 2);
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_RIGHT (move_right)', 4);
    } else if (e.code === 'Space') {
        e.preventDefault();
        dropBomb(p0);
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', `SDLK_SPACE (drop_bomb en x=${p0.gx},y=${p0.gy})`, 5);
    } else if (e.code === 'KeyP') {
        partidaPausada = !partidaPausada;
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_p (toggle_pause)', 6);
    } else if (e.code === 'Escape') {
        resetGame();
        registrarInteraccion('Comando_Teclado', 'SDL_Window/canvas', 'SDLK_ESCAPE (reset_game)', 7);
    }
});

// Clics de ratón o pulsaciones en pantalla sobre el tablero
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const cy = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    const categoria = e.pointerType === 'touch' ? 'Pulsacion_Pantalla' : 'Clic_Raton';

    const p0 = players[0];
    if (p0 && !p0.is_dead) {
        if (cx === p0.gx && cy === p0.gy) {
            dropBomb(p0);
        } else {
            const dx = cx - p0.gx;
            const dy = cy - p0.gy;
            if (Math.abs(dx) > Math.abs(dy)) moveBomberman(p0, dx > 0 ? 2 : 1);
            else moveBomberman(p0, dy > 0 ? 0 : 3);
        }
    }
    registrarInteraccion(categoria, 'canvas#bomberman-board', `click_celda(x=${cx},y=${cy})`, null);
});

// Botones táctiles en pantalla
document.querySelectorAll('.btn-touch').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
        const action = btn.dataset.action;
        const p0 = players[0];
        if (action === 'UP') moveBomberman(p0, 3);
        else if (action === 'DOWN') moveBomberman(p0, 0);
        else if (action === 'LEFT') moveBomberman(p0, 1);
        else if (action === 'RIGHT') moveBomberman(p0, 2);
        else if (action === 'BOMB') dropBomb(p0);

        const categoria = e.pointerType === 'touch' ? 'Pulsacion_Pantalla' : 'Clic_Raton';
        registrarInteraccion(categoria, `button.btn-touch#${action}`, `accion=${action}`, null);
    });
});

// Interacciones con los menús de configuración y perfil
document.getElementById('selector-usuario').addEventListener('change', async (e) => {
    idUsuarioActivo = Number(e.target.value);
    await iniciarSesionBD();
    await actualizarEstadisticasJugador(idUsuarioActivo);
    registrarInteraccion('Interaccion_Menu', 'select#selector-usuario', `id_usuario=${idUsuarioActivo}`, null);
});

document.getElementById('btn-crear-usuario').addEventListener('click', async () => {
    const input = document.getElementById('input-nuevo-usuario');
    const nombre = input.value.trim();
    if (!nombre) return;
    const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_usuario: nombre, nombre_pila: nombre, apellido_paterno: 'UAA' })
    });
    const nuevo = await res.json();
    if (nuevo && nuevo.id_usuario) {
        idUsuarioActivo = nuevo.id_usuario;
        input.value = '';
        await iniciarSesionBD();
        await cargarUsuariosYRanking();
        await actualizarEstadisticasJugador(idUsuarioActivo);
        registrarInteraccion('Interaccion_Menu', 'button#btn-crear-usuario', `alta_usuario=${nombre}`, null);
    }
});

document.getElementById('selector-mapa').addEventListener('change', (e) => {
    idMapaActivo = Number(e.target.value);
    const opt = e.target.selectedOptions[0];
    murosInicialesMapa = Number(opt.dataset.muros || 150);
    resetGame();
    registrarInteraccion('Interaccion_Menu', 'select#selector-mapa', `id_mapa=${idMapaActivo};muros=${murosInicialesMapa}`, null);
});

document.getElementById('selector-skin').addEventListener('change', (e) => {
    skinOffsetY = Number(e.target.value);
    if (players[0]) players[0].spriteY = skinOffsetY;
    registrarInteraccion('Interaccion_Menu', 'select#selector-skin', `fila_spritesheet_y=${skinOffsetY}`, null);
});

document.getElementById('btn-iniciar-partida').addEventListener('click', () => {
    resetGame();
    registrarInteraccion('Interaccion_Menu', 'button#btn-iniciar-partida', `nueva_partida_mapa=${idMapaActivo}`, null);
});

document.getElementById('btn-pausar-partida').addEventListener('click', () => {
    partidaPausada = !partidaPausada;
    registrarInteraccion('Interaccion_Menu', 'button#btn-pausar-partida', partidaPausada ? 'pausar' : 'reanudar', null);
});

// Inicialización general
(async function init() {
    await cargarMapas();
    await cargarUsuariosYRanking();
    await iniciarSesionBD();
    await actualizarEstadisticasJugador(idUsuarioActivo);
    await cargarBitacoraReciente();
    resetGame();

    setInterval(() => {
        updateBoard();
        renderBoard();
    }, 1000 / 30);
})();
