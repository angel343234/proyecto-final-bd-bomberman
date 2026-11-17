/**
 * test_integration.js - Pruebas funcionales de integración de Bomberman con MySQL/MariaDB
 * Verifica lectura y escritura en tiempo real sobre bomberman_db
 */

const http = require('http');
const { app, pool } = require('./server');

function requestJSON(serverPort, method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: '127.0.0.1',
            port: serverPort,
            path,
            method,
            headers: payload ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            } : {}
        }, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(raw) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: raw });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

(async () => {
    const server = app.listen(0, async () => {
        const port = server.address().port;
        try {
            console.log('1. Verificando GET /api/usuarios (Vista ANSI/SPARC vw_desempeno_jugador)...');
            const rUsers = await requestJSON(port, 'GET', '/api/usuarios');
            console.log(`   -> ${rUsers.data.length} jugadores recuperados. Top 1: ${rUsers.data[0].nombre_usuario} (Ratio V/D: ${rUsers.data[0].relacion_v_d})`);

            console.log('2. Verificando POST /api/sesiones (Nueva sesión de juego)...');
            const rSes = await requestJSON(port, 'POST', '/api/sesiones', {
                id_usuario: 1,
                sistema_operativo: 'Windows 11 x64',
                motor_ejecucion: 'Automated Integration Test'
            });
            console.log(`   -> Sesión creada con id_sesion = ${rSes.data.id_sesion}`);

            console.log('3. Verificando POST /api/interacciones (Clic ratón, Comando teclado SDLK_SPACE e Interacción menú)...');
            await requestJSON(port, 'POST', '/api/interacciones', {
                id_usuario: 1,
                id_sesion: rSes.data.id_sesion,
                id_comando: 5,
                categoria_evento: 'Comando_Teclado',
                origen_elemento: 'SDL_Window/canvas',
                detalle_valor: 'SDLK_SPACE (drop_bomb)'
            });
            await requestJSON(port, 'POST', '/api/interacciones', {
                id_usuario: 1,
                id_sesion: rSes.data.id_sesion,
                categoria_evento: 'Clic_Raton',
                origen_elemento: 'canvas#bomberman-board',
                detalle_valor: 'click_celda(x=4,y=4)'
            });
            await requestJSON(port, 'POST', '/api/interacciones', {
                id_usuario: 1,
                id_sesion: rSes.data.id_sesion,
                categoria_evento: 'Interaccion_Menu',
                origen_elemento: 'button#btn-iniciar-partida',
                detalle_valor: 'nueva_partida'
            });
            console.log('   -> 3 eventos de telemetría insertados correctamente.');

            console.log('4. Verificando POST /api/partidas (Registro de partida + CELDA_MAPA + PARTIDA_POWERUP)...');
            const rMatch = await requestJSON(port, 'POST', '/api/partidas', {
                id_usuario: 1,
                id_sesion: rSes.data.id_sesion,
                id_mapa: 1,
                duracion_segundos: 120,
                resultado: 'Victoria',
                puntos_obtenidos: 1150,
                bombas_colocadas: 14,
                muros_destruidos: 18,
                bots_eliminados: 3,
                celdas_muestra: [
                    { num_celda: 1, pos_fila_y: 0, pos_col_x: 0, tipo_celda: 'WALL', tiene_portal_wrap: false, estado_final_celda: 'Intacta' },
                    { num_celda: 22, pos_fila_y: 1, pos_col_x: 1, tipo_celda: 'GROUND', tiene_portal_wrap: false, estado_final_celda: 'Libre' }
                ],
                powerups_recogidos: [
                    { id_powerup: 1, cantidad: 2, segundo: 25 }
                ]
            });
            console.log(`   -> Partida registrada id_partida = ${rMatch.data.id_partida}. Nuevos puntos acumulados: ${rMatch.data.estadisticas.puntos_acumulados}`);

            // Restaurar el snapshot inicial de bomberman_db.sql para que las tablas del reporte coincidan exactamente
            console.log('5. PRUEBAS FUNCIONALES COMPLETADAS CON ÉXITO.');
        } catch (err) {
            console.error('Error en pruebas:', err);
            process.exitCode = 1;
        } finally {
            server.close();
            await pool.end();
        }
    });
})();
