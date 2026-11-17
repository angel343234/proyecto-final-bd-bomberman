/**
 * server.js - Backend Node.js + Express + MySQL2 para Bomberman (jhoukem/Bomberman)
 * Universidad Autónoma de Aguascalientes (UAA) - I.C.I. 5° Semestre
 * Materia: Bases de Datos | Profesor: Dr. Jaime Muñoz Arteaga
 * Equipo #13: Pedro Fernando López Vázquez, Santiago Andrey Muñoz Muñoz,
 *             Ángel Josué Muñoz Muñoz, Luis Gerardo Escamilla López
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend y recursos originales (spritesheet.png, bm.ttf, audios)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/rsc', express.static(path.join(__dirname, 'rsc')));

// Pool de conexiones a MySQL / MariaDB (bomberman_db)
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bomberman_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 1. Obtener todos los usuarios con sus estadísticas desde la vista ANSI/SPARC vw_desempeno_jugador
app.get('/api/usuarios', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM vw_desempeno_jugador ORDER BY puntos_acumulados DESC, victorias DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error en GET /api/usuarios:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Obtener usuario por nombre_usuario
app.get('/api/usuario/:nombre', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM vw_desempeno_jugador WHERE nombre_usuario = ?',
            [req.params.nombre]
        );
        res.json(rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Registrar un nuevo usuario e inicializar su fila 1:1 en ESTADISTICA_JUGADOR
app.post('/api/usuarios', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const {
            nombre_usuario,
            correo,
            nombre_pila = 'Jugador',
            apellido_paterno = 'Bomberman',
            apellido_materno = null,
            telefono = '449-000-0000',
            plataforma = 'Navegador Web HTML5 Canvas'
        } = req.body;

        const [existing] = await conn.execute(
            'SELECT id_usuario FROM USUARIO WHERE nombre_usuario = ?',
            [nombre_usuario]
        );
        if (existing.length > 0) {
            await conn.rollback();
            const [userStats] = await pool.execute(
                'SELECT * FROM vw_desempeno_jugador WHERE id_usuario = ?',
                [existing[0].id_usuario]
            );
            return res.json(userStats[0]);
        }

        const [result] = await conn.execute(
            `INSERT INTO USUARIO (nombre_usuario, correo, fecha_registro, nombre_pila, apellido_paterno, apellido_materno, id_rango)
             VALUES (?, ?, CURDATE(), ?, ?, ?, 1)`,
            [nombre_usuario, correo || `${nombre_usuario}@edu.uaa.mx`, nombre_pila, apellido_paterno, apellido_materno]
        );
        const idUsuario = result.insertId;

        await conn.execute('INSERT INTO ESTADISTICA_JUGADOR (id_usuario) VALUES (?)', [idUsuario]);
        await conn.execute('INSERT IGNORE INTO USUARIO_TELEFONO (id_usuario, telefono) VALUES (?, ?)', [idUsuario, telefono]);
        await conn.execute('INSERT IGNORE INTO USUARIO_PLATAFORMA (id_usuario, plataforma) VALUES (?, ?)', [idUsuario, plataforma]);
        await conn.execute('INSERT IGNORE INTO USUARIO_SKIN (id_usuario, id_skin, fecha_adquisicion, puntos_pagados, skin_equipada) VALUES (?, 1, NOW(), 0, TRUE)', [idUsuario]);

        await conn.commit();

        const [created] = await pool.execute(
            'SELECT * FROM vw_desempeno_jugador WHERE id_usuario = ?',
            [idUsuario]
        );
        res.status(201).json(created[0]);
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// 4. Catálogos de mapas y skins
app.get('/api/mapas', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM MAPA_ESCENARIO ORDER BY id_mapa');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/skins', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM SKIN_BOMBERMAN ORDER BY id_skin');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Iniciar y cerrar sesión de juego (SESION_JUEGO)
app.post('/api/sesiones', async (req, res) => {
    try {
        const {
            id_usuario = 1,
            sistema_operativo = 'Windows 11 x64',
            motor_ejecucion = 'HTML5 Canvas + SDL2 Assets'
        } = req.body;
        const [result] = await pool.execute(
            `INSERT INTO SESION_JUEGO (id_usuario, fecha_inicio, sistema_operativo, motor_ejecucion)
             VALUES (?, NOW(), ?, ?)`,
            [id_usuario, sistema_operativo, motor_ejecucion]
        );
        res.status(201).json({ id_sesion: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sesiones/cerrar', async (req, res) => {
    try {
        const { id_sesion } = req.body;
        await pool.execute('UPDATE SESION_JUEGO SET fecha_fin = NOW() WHERE id_sesion = ?', [id_sesion]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Registrar finalización de partida (PARTIDA + CELDA_MAPA + ESTADISTICA_JUGADOR)
app.post('/api/partidas', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const {
            id_usuario = 1,
            id_sesion = 101,
            id_mapa = 1,
            duracion_segundos = 60,
            resultado = 'Victoria',
            puntos_obtenidos = 500,
            bombas_colocadas = 5,
            muros_destruidos = 8,
            bots_eliminados = 3,
            celdas_muestra = [],
            powerups_recogidos = []
        } = req.body;

        const [resPartida] = await conn.execute(
            `INSERT INTO PARTIDA
             (id_usuario, id_sesion, id_mapa, fecha_inicio, duracion_segundos, resultado,
              puntos_obtenidos, bombas_colocadas, muros_destruidos, bots_eliminados)
             VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND), ?, ?, ?, ?, ?, ?)`,
            [
                id_usuario,
                id_sesion,
                id_mapa,
                Math.max(1, duracion_segundos),
                Math.max(1, duracion_segundos),
                resultado,
                puntos_obtenidos,
                bombas_colocadas,
                muros_destruidos,
                Math.min(3, Math.max(0, bots_eliminados))
            ]
        );
        const idPartida = resPartida.insertId;

        // Guardar muestra de celdas del tablero (entidad débil CELDA_MAPA)
        if (Array.isArray(celdas_muestra) && celdas_muestra.length > 0) {
            for (const c of celdas_muestra.slice(0, 12)) {
                await conn.execute(
                    `INSERT IGNORE INTO CELDA_MAPA
                     (id_partida, num_celda, pos_fila_y, pos_col_x, tipo_celda, tiene_portal_wrap, estado_final_celda)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        idPartida,
                        c.num_celda,
                        c.pos_fila_y,
                        c.pos_col_x,
                        c.tipo_celda || 'GROUND',
                        Boolean(c.tiene_portal_wrap),
                        c.estado_final_celda || 'Libre'
                    ]
                );
            }
        }

        // Guardar powerups recogidos (relación N:M PARTIDA_POWERUP)
        if (Array.isArray(powerups_recogidos) && powerups_recogidos.length > 0) {
            for (const pw of powerups_recogidos) {
                await conn.execute(
                    `INSERT INTO PARTIDA_POWERUP (id_partida, id_powerup, cantidad_recogida, segundo_aparicion, aplicado_a_jugador)
                     VALUES (?, ?, ?, ?, TRUE)
                     ON DUPLICATE KEY UPDATE cantidad_recogida = cantidad_recogida + VALUES(cantidad_recogida)`,
                    [idPartida, pw.id_powerup, pw.cantidad || 1, pw.segundo || 10]
                );
            }
        }

        const esVictoria = resultado === 'Victoria' ? 1 : 0;
        const esDerrota = resultado === 'Derrota' ? 1 : 0;

        await conn.execute(
            `UPDATE ESTADISTICA_JUGADOR
             SET partidas_jugadas = partidas_jugadas + 1,
                 tiempo_total_seg = tiempo_total_seg + ?,
                 puntos_acumulados = puntos_acumulados + ?,
                 victorias = victorias + ?,
                 derrotas = derrotas + ?
             WHERE id_usuario = ?`,
            [Math.max(1, duracion_segundos), puntos_obtenidos, esVictoria, esDerrota, id_usuario]
        );

        // Actualizar rango automáticamente según puntos acumulados
        await conn.execute(
            `UPDATE USUARIO u
             JOIN ESTADISTICA_JUGADOR e ON u.id_usuario = e.id_usuario
             SET u.id_rango = (
                 SELECT r.id_rango FROM RANGO r
                 WHERE r.puntos_minimos <= e.puntos_acumulados
                 ORDER BY r.puntos_minimos DESC LIMIT 1
             )
             WHERE u.id_usuario = ?`,
            [id_usuario]
        );

        await conn.commit();

        const [stats] = await pool.execute(
            'SELECT * FROM vw_desempeno_jugador WHERE id_usuario = ?',
            [id_usuario]
        );
        res.status(201).json({ id_partida: idPartida, estadisticas: stats[0] });
    } catch (err) {
        await conn.rollback();
        console.error('Error en POST /api/partidas:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// 7. Registrar un power-up recogido durante una partida en curso
app.post('/api/partidas/powerup', async (req, res) => {
    try {
        const { id_partida, id_powerup = 1, segundo_aparicion = 15 } = req.body;
        if (id_partida) {
            await pool.execute(
                `INSERT INTO PARTIDA_POWERUP (id_partida, id_powerup, cantidad_recogida, segundo_aparicion, aplicado_a_jugador)
                 VALUES (?, ?, 1, ?, TRUE)
                 ON DUPLICATE KEY UPDATE cantidad_recogida = cantidad_recogida + 1`,
                [id_partida, id_powerup, segundo_aparicion]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Registrar evento granular de interacción (REGISTRO_INTERACCION + contadores en SESION_JUEGO y ESTADISTICA_JUGADOR)
app.post('/api/interacciones', async (req, res) => {
    try {
        const {
            id_usuario = 1,
            id_sesion = 101,
            num_secuencia,
            id_comando = null,
            categoria_evento = 'Clic_Raton',
            origen_elemento = 'canvas#bomberman-board',
            detalle_valor = ''
        } = req.body;

        let seq = num_secuencia;
        if (!seq) {
            const [maxRows] = await pool.execute(
                'SELECT IFNULL(MAX(num_secuencia), 0) + 1 AS next_seq FROM REGISTRO_INTERACCION WHERE id_sesion = ?',
                [id_sesion]
            );
            seq = maxRows[0].next_seq;
        }

        await pool.execute(
            `INSERT IGNORE INTO REGISTRO_INTERACCION
             (id_sesion, num_secuencia, id_comando, categoria_evento, origen_elemento, detalle_valor, marca_tiempo)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [id_sesion, seq, id_comando || null, categoria_evento, origen_elemento, detalle_valor]
        );

        if (categoria_evento === 'Clic_Raton' || categoria_evento === 'Pulsacion_Pantalla') {
            await pool.execute('UPDATE SESION_JUEGO SET clics_sesion = clics_sesion + 1 WHERE id_sesion = ?', [id_sesion]);
            await pool.execute('UPDATE ESTADISTICA_JUGADOR SET total_clics = total_clics + 1 WHERE id_usuario = ?', [id_usuario]);
        } else if (categoria_evento === 'Comando_Teclado') {
            await pool.execute('UPDATE SESION_JUEGO SET comandos_teclado_sesion = comandos_teclado_sesion + 1 WHERE id_sesion = ?', [id_sesion]);
            await pool.execute('UPDATE ESTADISTICA_JUGADOR SET total_comandos_teclado = total_comandos_teclado + 1 WHERE id_usuario = ?', [id_usuario]);
        } else if (categoria_evento === 'Interaccion_Menu') {
            await pool.execute('UPDATE SESION_JUEGO SET interacciones_menu_sesion = interacciones_menu_sesion + 1 WHERE id_sesion = ?', [id_sesion]);
            await pool.execute('UPDATE ESTADISTICA_JUGADOR SET total_interacciones_menu = total_interacciones_menu + 1 WHERE id_usuario = ?', [id_usuario]);
        }

        res.status(201).json({ ok: true, num_secuencia: seq });
    } catch (err) {
        console.error('Error en POST /api/interacciones:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 9. Consultar estadísticas individuales y vista vw_desempeno_jugador
app.get('/api/estadisticas/:idUsuario', async (req, res) => {
    try {
        const [stats] = await pool.execute(
            'SELECT * FROM vw_desempeno_jugador WHERE id_usuario = ?',
            [req.params.idUsuario]
        );
        const [partidas] = await pool.execute(
            'SELECT * FROM vw_historial_partidas_bomberman WHERE id_usuario = ? ORDER BY fecha_inicio DESC LIMIT 8',
            [req.params.idUsuario]
        );
        res.json({
            jugador: stats[0] || null,
            historial_partidas: partidas
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Consultar bitácora reciente de interacciones
app.get('/api/interacciones/recientes', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT r.id_sesion, r.num_secuencia, u.nombre_usuario, r.categoria_evento,
                    ck.tecla_sdl, r.origen_elemento, r.detalle_valor, r.marca_tiempo
             FROM REGISTRO_INTERACCION r
             JOIN SESION_JUEGO s ON r.id_sesion = s.id_sesion
             JOIN USUARIO u ON s.id_usuario = u.id_usuario
             LEFT JOIN COMANDO_TECLADO ck ON r.id_comando = ck.id_comando
             ORDER BY r.marca_tiempo DESC, r.num_secuencia DESC
             LIMIT 15`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================================`);
        console.log(` Servidor Bomberman + MySQL (bomberman_db) activo en:`);
        console.log(` -> http://localhost:${PORT}`);
        console.log(`====================================================================`);
    });
}

module.exports = { app, pool };
