-- =====================================================================================
-- UNIVERSIDAD AUTÓNOMA DE AGUASCALIENTES (UAA)
-- CENTRO DE CIENCIAS BÁSICAS - DEPARTAMENTO DE SISTEMAS DE INFORMACIÓN
-- Materia: Bases de Datos (BD) | Carrera: I.C.I. | Semestre: 5°
-- Profesor: Dr. Jaime Muñoz Arteaga
-- Equipo #13:
--   - Pedro Fernando López Vázquez
--   - Santiago Andrey Muñoz Muñoz
--   - Ángel Josué Muñoz Muñoz
--   - Luis Gerardo Escamilla López
-- Videojuego Base: Bomberman (https://github.com/jhoukem/Bomberman)
-- Archivo: bomberman_db.sql (DDL, Índices, Vistas ANSI/SPARC, DML de prueba y Consultas)
-- =====================================================================================

DROP DATABASE IF EXISTS bomberman_db;
CREATE DATABASE IF NOT EXISTS bomberman_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bomberman_db;

-- =====================================================================================
-- 1. NIVEL LÓGICO E INTERNO (DDL - TABLAS NORMALIZADAS 1FN A 4FN)
-- =====================================================================================

-- 1.1 Entidad Fuerte: RANGO
CREATE TABLE RANGO (
    id_rango INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rango VARCHAR(40) NOT NULL UNIQUE,
    nivel_numerico INT NOT NULL UNIQUE,
    puntos_minimos INT NOT NULL CHECK (puntos_minimos >= 0),
    multiplicador_puntaje DECIMAL(4,2) NOT NULL DEFAULT 1.00
) ENGINE=InnoDB;

-- 1.2 Entidad Fuerte: USUARIO (incluye atributo compuesto descompuesto nombre_completo
--     y relación recursiva 1:N Reta_Invita mediante id_usuario_referente)
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(40) NOT NULL UNIQUE,
    correo VARCHAR(120) NOT NULL UNIQUE,
    fecha_registro DATE NOT NULL,
    nombre_pila VARCHAR(60) NOT NULL,
    apellido_paterno VARCHAR(60) NOT NULL,
    apellido_materno VARCHAR(60) NULL,
    id_rango INT NOT NULL DEFAULT 1,
    id_usuario_referente INT NULL,
    fecha_invitacion DATE NULL,
    FOREIGN KEY (id_rango) REFERENCES RANGO(id_rango),
    FOREIGN KEY (id_usuario_referente) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 1.3 Relación por atributo multievaluado (4FN): USUARIO_TELEFONO
CREATE TABLE USUARIO_TELEFONO (
    id_usuario INT NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_usuario, telefono),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.4 Relación por atributo multievaluado (4FN): USUARIO_PLATAFORMA
CREATE TABLE USUARIO_PLATAFORMA (
    id_usuario INT NOT NULL,
    plataforma VARCHAR(40) NOT NULL,
    PRIMARY KEY (id_usuario, plataforma),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.5 Entidad Fuerte: ESTADISTICA_JUGADOR (Relación 1:1 Posee con USUARIO)
--     Nota 3FN: relacion_v_d es atributo derivado y se calcula en la vista vw_desempeno_jugador
CREATE TABLE ESTADISTICA_JUGADOR (
    id_estadistica INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    partidas_jugadas INT NOT NULL DEFAULT 0 CHECK (partidas_jugadas >= 0),
    tiempo_total_seg INT NOT NULL DEFAULT 0 CHECK (tiempo_total_seg >= 0),
    puntos_acumulados INT NOT NULL DEFAULT 0 CHECK (puntos_acumulados >= 0),
    victorias INT NOT NULL DEFAULT 0 CHECK (victorias >= 0),
    derrotas INT NOT NULL DEFAULT 0 CHECK (derrotas >= 0),
    total_clics INT NOT NULL DEFAULT 0 CHECK (total_clics >= 0),
    total_comandos_teclado INT NOT NULL DEFAULT 0 CHECK (total_comandos_teclado >= 0),
    total_interacciones_menu INT NOT NULL DEFAULT 0 CHECK (total_interacciones_menu >= 0),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.6 Entidad Fuerte: MAPA_ESCENARIO (Basada en BOARD de board.h / board.c: SIZE=20, 150 muros, 3 bots)
CREATE TABLE MAPA_ESCENARIO (
    id_mapa INT AUTO_INCREMENT PRIMARY KEY,
    nombre_escenario VARCHAR(60) NOT NULL UNIQUE,
    filas_l_size INT NOT NULL DEFAULT 20 CHECK (filas_l_size BETWEEN 10 AND 30),
    columnas_c_size INT NOT NULL DEFAULT 20 CHECK (columnas_c_size BETWEEN 10 AND 30),
    muros_destructibles_iniciales INT NOT NULL DEFAULT 150 CHECK (muros_destructibles_iniciales >= 0),
    cantidad_bots INT NOT NULL DEFAULT 3 CHECK (cantidad_bots BETWEEN 1 AND 3),
    puntaje_base_victoria INT NOT NULL DEFAULT 500 CHECK (puntaje_base_victoria > 0),
    CHECK (muros_destructibles_iniciales <= (filas_l_size - 2) * (columnas_c_size - 2))
) ENGINE=InnoDB;

-- 1.7 Entidad Fuerte: SESION_JUEGO (incluye atributo compuesto dispositivo: sistema_operativo, motor_ejecucion)
CREATE TABLE SESION_JUEGO (
    id_sesion INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NULL,
    sistema_operativo VARCHAR(50) NOT NULL,
    motor_ejecucion VARCHAR(50) NOT NULL,
    clics_sesion INT NOT NULL DEFAULT 0 CHECK (clics_sesion >= 0),
    comandos_teclado_sesion INT NOT NULL DEFAULT 0 CHECK (comandos_teclado_sesion >= 0),
    interacciones_menu_sesion INT NOT NULL DEFAULT 0 CHECK (interacciones_menu_sesion >= 0),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.8 Entidad Fuerte: PARTIDA
CREATE TABLE PARTIDA (
    id_partida INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_sesion INT NOT NULL,
    id_mapa INT NOT NULL,
    fecha_inicio DATETIME NOT NULL,
    duracion_segundos INT NOT NULL DEFAULT 0 CHECK (duracion_segundos >= 0),
    resultado VARCHAR(15) NOT NULL CHECK (resultado IN ('Victoria', 'Derrota', 'Abandonada')),
    puntos_obtenidos INT NOT NULL DEFAULT 0 CHECK (puntos_obtenidos >= 0),
    bombas_colocadas INT NOT NULL DEFAULT 0 CHECK (bombas_colocadas >= 0),
    muros_destruidos INT NOT NULL DEFAULT 0 CHECK (muros_destruidos >= 0),
    bots_eliminados INT NOT NULL DEFAULT 0 CHECK (bots_eliminados BETWEEN 0 AND 3),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_sesion) REFERENCES SESION_JUEGO(id_sesion) ON DELETE CASCADE,
    FOREIGN KEY (id_mapa) REFERENCES MAPA_ESCENARIO(id_mapa)
) ENGINE=InnoDB;

-- 1.9 Entidad Débil #1: CELDA_MAPA (Depende de PARTIDA; refleja CELL y CELL_TYPE de cell_type.h)
CREATE TABLE CELDA_MAPA (
    id_partida INT NOT NULL,
    num_celda INT NOT NULL,
    pos_fila_y INT NOT NULL CHECK (pos_fila_y >= 0),
    pos_col_x INT NOT NULL CHECK (pos_col_x >= 0),
    tipo_celda VARCHAR(20) NOT NULL CHECK (tipo_celda IN ('GROUND', 'WALL', 'WALL_BREAKABLE')),
    tiene_portal_wrap BOOLEAN NOT NULL DEFAULT FALSE,
    estado_final_celda VARCHAR(20) NOT NULL CHECK (estado_final_celda IN ('Intacta', 'Destruida', 'Con_Bonus', 'Libre')),
    PRIMARY KEY (id_partida, num_celda),
    FOREIGN KEY (id_partida) REFERENCES PARTIDA(id_partida) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.10 Entidad Fuerte: POWER_UP (Catálogo de BONUS_TYPE en bonus.h / bonus.c)
CREATE TABLE POWER_UP (
    id_powerup INT AUTO_INCREMENT PRIMARY KEY,
    codigo_tipo VARCHAR(20) NOT NULL UNIQUE CHECK (codigo_tipo IN ('MOREPOWER', 'MORESPEED', 'MOREBOMB', 'MAXPOWER', 'MALUS')),
    nombre_item VARCHAR(60) NOT NULL,
    probabilidad_aparicion_pct DECIMAL(5,2) NOT NULL CHECK (probabilidad_aparicion_pct BETWEEN 0 AND 100),
    efecto_estadistica VARCHAR(140) NOT NULL,
    puntos_otorgados INT NOT NULL DEFAULT 100
) ENGINE=InnoDB;

-- 1.11 Interrelación N:M #1 (Recoge_Item): PARTIDA_POWERUP (con 3 atributos propios)
CREATE TABLE PARTIDA_POWERUP (
    id_partida INT NOT NULL,
    id_powerup INT NOT NULL,
    cantidad_recogida INT NOT NULL DEFAULT 1 CHECK (cantidad_recogida >= 1),
    segundo_aparicion INT NOT NULL DEFAULT 10 CHECK (segundo_aparicion >= 0),
    aplicado_a_jugador BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_partida, id_powerup),
    FOREIGN KEY (id_partida) REFERENCES PARTIDA(id_partida) ON DELETE CASCADE,
    FOREIGN KEY (id_powerup) REFERENCES POWER_UP(id_powerup) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.12 Interrelación N:M #4 (Configura_Drop): MAPA_POWERUP (con 3 atributos propios)
CREATE TABLE MAPA_POWERUP (
    id_mapa INT NOT NULL,
    id_powerup INT NOT NULL,
    maximo_por_partida INT NOT NULL DEFAULT 10 CHECK (maximo_por_partida >= 0),
    probabilidad_mapa_pct DECIMAL(5,2) NOT NULL CHECK (probabilidad_mapa_pct BETWEEN 0 AND 100),
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_mapa, id_powerup),
    FOREIGN KEY (id_mapa) REFERENCES MAPA_ESCENARIO(id_mapa) ON DELETE CASCADE,
    FOREIGN KEY (id_powerup) REFERENCES POWER_UP(id_powerup) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.13 Entidad Fuerte: COMANDO_TECLADO (Controles SDL2 en input.c + atajos ampliados)
CREATE TABLE COMANDO_TECLADO (
    id_comando INT AUTO_INCREMENT PRIMARY KEY,
    tecla_sdl VARCHAR(30) NOT NULL UNIQUE,
    nombre_accion VARCHAR(60) NOT NULL,
    descripcion_funcion VARCHAR(200) NOT NULL,
    categoria_comando VARCHAR(25) NOT NULL CHECK (categoria_comando IN ('Movimiento', 'Combate', 'Menu_Sistema'))
) ENGINE=InnoDB;

-- 1.14 Entidad Débil #2: REGISTRO_INTERACCION (Depende de SESION_JUEGO)
CREATE TABLE REGISTRO_INTERACCION (
    id_sesion INT NOT NULL,
    num_secuencia INT NOT NULL,
    id_comando INT NULL,
    categoria_evento VARCHAR(25) NOT NULL CHECK (categoria_evento IN ('Clic_Raton', 'Pulsacion_Pantalla', 'Comando_Teclado', 'Interaccion_Menu')),
    origen_elemento VARCHAR(80) NOT NULL,
    detalle_valor VARCHAR(100) NULL,
    marca_tiempo DATETIME NOT NULL,
    PRIMARY KEY (id_sesion, num_secuencia),
    FOREIGN KEY (id_sesion) REFERENCES SESION_JUEGO(id_sesion) ON DELETE CASCADE,
    FOREIGN KEY (id_comando) REFERENCES COMANDO_TECLADO(id_comando) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 1.15 Entidad Fuerte: LOGRO
CREATE TABLE LOGRO (
    id_logro INT AUTO_INCREMENT PRIMARY KEY,
    nombre_logro VARCHAR(80) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NOT NULL,
    puntos_recompensa INT NOT NULL DEFAULT 100 CHECK (puntos_recompensa >= 0),
    categoria_logro VARCHAR(25) NOT NULL CHECK (categoria_logro IN ('Progreso', 'Desempeno', 'Interaccion'))
) ENGINE=InnoDB;

-- 1.16 Interrelación N:M #2 (Desbloquea): USUARIO_LOGRO (con 3 atributos propios)
CREATE TABLE USUARIO_LOGRO (
    id_usuario INT NOT NULL,
    id_logro INT NOT NULL,
    fecha_desbloqueo DATETIME NOT NULL,
    progreso_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00 CHECK (progreso_pct BETWEEN 0 AND 100),
    notificado BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_usuario, id_logro),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_logro) REFERENCES LOGRO(id_logro) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.17 Entidad Fuerte: SKIN_BOMBERMAN (Basada en spritesheet.png de rsc/)
CREATE TABLE SKIN_BOMBERMAN (
    id_skin INT AUTO_INCREMENT PRIMARY KEY,
    nombre_skin VARCHAR(60) NOT NULL UNIQUE,
    color_traje VARCHAR(30) NOT NULL,
    fila_spritesheet_y INT NOT NULL CHECK (fila_spritesheet_y IN (0, 24, 48, 72)),
    costo_puntos INT NOT NULL DEFAULT 0 CHECK (costo_puntos >= 0)
) ENGINE=InnoDB;

-- 1.18 Relación por atributo multievaluado (4FN): SKIN_ETIQUETA
CREATE TABLE SKIN_ETIQUETA (
    id_skin INT NOT NULL,
    etiqueta_estilo VARCHAR(40) NOT NULL,
    PRIMARY KEY (id_skin, etiqueta_estilo),
    FOREIGN KEY (id_skin) REFERENCES SKIN_BOMBERMAN(id_skin) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 1.19 Interrelación N:M #3 (Adquiere_Skin): USUARIO_SKIN (con 3 atributos propios)
CREATE TABLE USUARIO_SKIN (
    id_usuario INT NOT NULL,
    id_skin INT NOT NULL,
    fecha_adquisicion DATETIME NOT NULL,
    puntos_pagados INT NOT NULL DEFAULT 0 CHECK (puntos_pagados >= 0),
    skin_equipada BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_usuario, id_skin),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_skin) REFERENCES SKIN_BOMBERMAN(id_skin) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Índices físicos adicionales (Nivel Interno ANSI/SPARC)
CREATE INDEX idx_partida_usuario_resultado ON PARTIDA(id_usuario, resultado);
CREATE INDEX idx_interaccion_categoria ON REGISTRO_INTERACCION(categoria_evento, marca_tiempo);
CREATE INDEX idx_sesion_usuario ON SESION_JUEGO(id_usuario, fecha_inicio);

-- =====================================================================================
-- 2. NIVEL EXTERNO ANSI/SPARC (VISTAS SQL)
-- =====================================================================================

-- Vista principal con atributo derivado relacion_v_d (victorias/derrotas)
CREATE OR REPLACE VIEW vw_desempeno_jugador AS
SELECT
    u.id_usuario,
    u.nombre_usuario,
    CONCAT(u.nombre_pila, ' ', u.apellido_paterno, IFNULL(CONCAT(' ', u.apellido_materno), '')) AS nombre_completo,
    r.nombre_rango,
    e.partidas_jugadas,
    e.tiempo_total_seg,
    SEC_TO_TIME(e.tiempo_total_seg) AS tiempo_formateado,
    e.puntos_acumulados,
    e.victorias,
    e.derrotas,
    CASE
        WHEN e.derrotas = 0 THEN CAST(e.victorias AS DECIMAL(6,2))
        ELSE ROUND(e.victorias / e.derrotas, 2)
    END AS relacion_v_d,
    e.total_clics,
    e.total_comandos_teclado,
    e.total_interacciones_menu
FROM USUARIO u
JOIN RANGO r ON u.id_rango = r.id_rango
JOIN ESTADISTICA_JUGADOR e ON u.id_usuario = e.id_usuario;

-- Vista de historial detallado de partidas en Bomberman
CREATE OR REPLACE VIEW vw_historial_partidas_bomberman AS
SELECT
    p.id_partida,
    u.id_usuario,
    u.nombre_usuario,
    m.nombre_escenario,
    p.fecha_inicio,
    p.duracion_segundos,
    p.resultado,
    p.puntos_obtenidos,
    p.bombas_colocadas,
    p.muros_destruidos,
    p.bots_eliminados
FROM PARTIDA p
JOIN USUARIO u ON p.id_usuario = u.id_usuario
JOIN MAPA_ESCENARIO m ON p.id_mapa = m.id_mapa;

-- =====================================================================================
-- 3. CARGA DE DATOS REALISTAS DE PRUEBA (DML - INSERT)
-- =====================================================================================

-- 3.1 RANGO
INSERT INTO RANGO (id_rango, nombre_rango, nivel_numerico, puntos_minimos, multiplicador_puntaje) VALUES
(1, 'Novato Bombardero', 1, 0, 1.00),
(2, 'Artillero Táctico', 2, 1500, 1.25),
(3, 'Maestro Explosivo', 3, 4000, 1.50),
(4, 'Leyenda Bomberman', 4, 8000, 2.00);

-- 3.2 USUARIO (Equipo #13 + jugadores de prueba)
INSERT INTO USUARIO (id_usuario, nombre_usuario, correo, fecha_registro, nombre_pila, apellido_paterno, apellido_materno, id_rango, id_usuario_referente, fecha_invitacion) VALUES
(1, 'angel_munoz', 'al343234@edu.uaa.mx', '2026-10-01', 'Ángel Josué', 'Muñoz', 'Muñoz', 3, NULL, NULL),
(2, 'pedro_lopez', 'pedro.lopez@edu.uaa.mx', '2026-10-02', 'Pedro Fernando', 'López', 'Vázquez', 3, 1, '2026-10-02'),
(3, 'santiago_munoz', 'santiago.munoz@edu.uaa.mx', '2026-10-03', 'Santiago Andrey', 'Muñoz', 'Muñoz', 2, 1, '2026-10-03'),
(4, 'luis_escamilla', 'luis.escamilla@edu.uaa.mx', '2026-10-05', 'Luis Gerardo', 'Escamilla', 'López', 2, 2, '2026-10-05'),
(5, 'sofia_blast', 'sofia.blast@edu.uaa.mx', '2026-10-12', 'Sofía', 'Hernández', 'Ruiz', 1, 3, '2026-10-12');

-- 3.3 USUARIO_TELEFONO (4FN)
INSERT INTO USUARIO_TELEFONO (id_usuario, telefono) VALUES
(1, '449-123-4501'),
(1, '449-987-6501'),
(2, '449-234-5602'),
(3, '449-345-6703'),
(4, '449-456-7804'),
(5, '449-567-8905');

-- 3.4 USUARIO_PLATAFORMA (4FN)
INSERT INTO USUARIO_PLATAFORMA (id_usuario, plataforma) VALUES
(1, 'Windows 11 Desktop SDL2'),
(1, 'Navegador Web HTML5 Canvas'),
(2, 'Windows 11 Desktop SDL2'),
(3, 'Navegador Web HTML5 Canvas'),
(4, 'Windows 11 Desktop SDL2'),
(5, 'Tablet Touch Web');

-- 3.5 ESTADISTICA_JUGADOR
INSERT INTO ESTADISTICA_JUGADOR (id_estadistica, id_usuario, partidas_jugadas, tiempo_total_seg, puntos_acumulados, victorias, derrotas, total_clics, total_comandos_teclado, total_interacciones_menu) VALUES
(1, 1, 25, 3420, 6850, 20, 5, 412, 1890, 64),
(2, 2, 22, 2980, 5420, 15, 7, 365, 1640, 52),
(3, 3, 16, 2150, 3280, 10, 6, 280, 1120, 39),
(4, 4, 14, 1890, 2750, 8, 6, 245, 980, 33),
(5, 5, 5, 610, 450, 1, 4, 95, 310, 14);

-- 3.6 MAPA_ESCENARIO
INSERT INTO MAPA_ESCENARIO (id_mapa, nombre_escenario, filas_l_size, columnas_c_size, muros_destructibles_iniciales, cantidad_bots, puntaje_base_victoria) VALUES
(1, 'Arena Clásica SDL2 (20x20)', 20, 20, 150, 3, 500),
(2, 'Laberinto Explosivo Denso', 20, 20, 190, 3, 650),
(3, 'Coliseo Rápido Toroidal', 20, 20, 100, 3, 450),
(4, 'Fortaleza de Acero (24x24)', 24, 24, 220, 3, 800);

-- 3.7 POWER_UP (Los 5 tipos exactos de bonus.h / bonus.c)
INSERT INTO POWER_UP (id_powerup, codigo_tipo, nombre_item, probabilidad_aparicion_pct, efecto_estadistica, puntos_otorgados) VALUES
(1, 'MOREPOWER', 'Flama Extra (+1 Power)', 35.00, 'Incrementa bomb_power en +1 hasta (c_size/2)-1', 100),
(2, 'MOREBOMB', 'Bomba Adicional (+1 Bomb)', 30.00, 'Incrementa bomb_left en +1 para colocar más bombas simultáneas', 100),
(3, 'MORESPEED', 'Patines de Velocidad (+0.3 Speed)', 20.00, 'Incrementa speed en +0.3f hasta un máximo de 3.0f', 120),
(4, 'MALUS', 'Cráneo Ralentizador (Malus Speed=1.0)', 10.00, 'Reduce la velocidad del Bomberman a 1.0f temporalmente', 25),
(5, 'MAXPOWER', 'Flama Dorada Máxima (Max Power)', 5.00, 'Establece bomb_power al máximo permitido (c_size/2)-1', 250);

-- 3.8 MAPA_POWERUP (Interrelación N:M #4)
INSERT INTO MAPA_POWERUP (id_mapa, id_powerup, maximo_por_partida, probabilidad_mapa_pct, habilitado) VALUES
(1, 1, 8, 35.00, TRUE),
(1, 2, 6, 30.00, TRUE),
(1, 3, 5, 20.00, TRUE),
(1, 4, 3, 10.00, TRUE),
(1, 5, 2, 5.00, TRUE),
(2, 1, 10, 40.00, TRUE),
(2, 2, 8, 30.00, TRUE),
(2, 5, 3, 10.00, TRUE);

-- 3.9 COMANDO_TECLADO (Controles reales de input.c y menús)
INSERT INTO COMANDO_TECLADO (id_comando, tecla_sdl, nombre_accion, descripcion_funcion, categoria_comando) VALUES
(1, 'SDLK_UP', 'Mover Arriba', 'Desplaza a Bomberman hacia arriba (direction = 3, move_up = SDL_TRUE)', 'Movimiento'),
(2, 'SDLK_DOWN', 'Mover Abajo', 'Desplaza a Bomberman hacia abajo (direction = 0, move_down = SDL_TRUE)', 'Movimiento'),
(3, 'SDLK_LEFT', 'Mover Izquierda', 'Desplaza a Bomberman hacia la izquierda (direction = 1, move_left = SDL_TRUE)', 'Movimiento'),
(4, 'SDLK_RIGHT', 'Mover Derecha', 'Desplaza a Bomberman hacia la derecha (direction = 2, move_right = SDL_TRUE)', 'Movimiento'),
(5, 'SDLK_SPACE', 'Colocar Bomba', 'Invoca can_drop_bomb() y drop_bomb() en la celda actual del jugador', 'Combate'),
(6, 'SDLK_p', 'Pausar / Reanudar', 'Alterna el estado pause y ejecuta Mix_PauseMusic() / Mix_ResumeMusic()', 'Menu_Sistema'),
(7, 'SDLK_ESCAPE', 'Reiniciar Partida', 'Activa reset = SDL_TRUE para invocar reset_game(board, bomberman, assets)', 'Menu_Sistema'),
(8, 'SDLK_m', 'Abrir Panel Estadísticas', 'Muestra u oculta el menú de perfil, mapa y telemetría en vivo', 'Menu_Sistema');

-- 3.10 SESION_JUEGO
INSERT INTO SESION_JUEGO (id_sesion, id_usuario, fecha_inicio, fecha_fin, sistema_operativo, motor_ejecucion, clics_sesion, comandos_teclado_sesion, interacciones_menu_sesion) VALUES
(101, 1, '2026-11-15 17:00:00', '2026-11-15 17:45:00', 'Windows 11 x64', 'SDL2 + Web Telemetry Bridge', 84, 340, 14),
(102, 2, '2026-11-15 18:10:00', '2026-11-15 18:50:00', 'Windows 11 x64', 'SDL2 + Web Telemetry Bridge', 72, 295, 11),
(103, 3, '2026-11-16 16:20:00', '2026-11-16 16:55:00', 'Windows 11 x64', 'HTML5 Canvas + Node API', 65, 240, 9),
(104, 4, '2026-11-16 19:00:00', '2026-11-16 19:30:00', 'Windows 11 x64', 'SDL2 + Web Telemetry Bridge', 58, 210, 8),
(105, 5, '2026-11-17 12:00:00', '2026-11-17 12:15:00', 'Android 15 Touch', 'HTML5 Canvas + Node API', 42, 65, 6);

-- 3.11 PARTIDA
INSERT INTO PARTIDA (id_partida, id_usuario, id_sesion, id_mapa, fecha_inicio, duracion_segundos, resultado, puntos_obtenidos, bombas_colocadas, muros_destruidos, bots_eliminados) VALUES
(1001, 1, 101, 1, '2026-11-15 17:02:00', 135, 'Victoria', 1450, 18, 22, 3),
(1002, 1, 101, 2, '2026-11-15 17:10:00', 160, 'Victoria', 1625, 24, 29, 3),
(1003, 1, 101, 1, '2026-11-15 17:20:00', 92, 'Derrota', 350, 9, 10, 1),
(1004, 2, 102, 1, '2026-11-15 18:12:00', 142, 'Victoria', 1375, 19, 21, 3),
(1005, 2, 102, 3, '2026-11-15 18:25:00', 118, 'Victoria', 1250, 15, 16, 3),
(1006, 3, 103, 1, '2026-11-16 16:22:00', 148, 'Victoria', 1300, 17, 18, 3),
(1007, 4, 104, 2, '2026-11-16 19:05:00', 155, 'Victoria', 1400, 20, 24, 3),
(1008, 5, 105, 1, '2026-11-17 12:02:00', 88, 'Derrota', 225, 7, 5, 0);

-- 3.12 CELDA_MAPA (Entidad Débil #1: muestra de celdas clave de la partida 1001)
INSERT INTO CELDA_MAPA (id_partida, num_celda, pos_fila_y, pos_col_x, tipo_celda, tiene_portal_wrap, estado_final_celda) VALUES
(1001, 1, 0, 0, 'WALL', FALSE, 'Intacta'),
(1001, 10, 0, 10, 'GROUND', TRUE, 'Libre'),
(1001, 21, 1, 1, 'GROUND', FALSE, 'Libre'),
(1001, 45, 2, 5, 'WALL_BREAKABLE', FALSE, 'Destruida'),
(1001, 46, 2, 6, 'WALL_BREAKABLE', FALSE, 'Con_Bonus'),
(1001, 200, 10, 0, 'GROUND', TRUE, 'Libre');

-- 3.13 PARTIDA_POWERUP (Interrelación N:M #1)
INSERT INTO PARTIDA_POWERUP (id_partida, id_powerup, cantidad_recogida, segundo_aparicion, aplicado_a_jugador) VALUES
(1001, 1, 2, 18, TRUE),
(1001, 2, 2, 34, TRUE),
(1001, 3, 1, 52, TRUE),
(1002, 5, 1, 41, TRUE),
(1004, 1, 2, 22, TRUE),
(1006, 2, 1, 29, TRUE),
(1007, 1, 3, 19, TRUE);

-- 3.14 REGISTRO_INTERACCION (Entidad Débil #2: clics, pulsaciones, teclado y menús)
INSERT INTO REGISTRO_INTERACCION (id_sesion, num_secuencia, id_comando, categoria_evento, origen_elemento, detalle_valor, marca_tiempo) VALUES
(101, 1, NULL, 'Interaccion_Menu', 'select#selector-usuario', 'usuario=angel_munoz (id=1)', '2026-11-15 17:01:10'),
(101, 2, NULL, 'Interaccion_Menu', 'select#selector-mapa', 'mapa=Arena Clásica SDL2 (20x20)', '2026-11-15 17:01:45'),
(101, 3, NULL, 'Interaccion_Menu', 'button#btn-iniciar-partida', 'click_iniciar_partida', '2026-11-15 17:02:00'),
(101, 4, 4, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_RIGHT (move_right)', '2026-11-15 17:02:03'),
(101, 5, 2, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_DOWN (move_down)', '2026-11-15 17:02:05'),
(101, 6, 5, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_SPACE (drop_bomb en x=3,y=1)', '2026-11-15 17:02:07'),
(101, 7, NULL, 'Clic_Raton', 'canvas#bomberman-board', 'click_celda(x=5,y=2)', '2026-11-15 17:02:15'),
(101, 8, 6, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_p (toggle_pause)', '2026-11-15 17:03:00'),
(102, 1, NULL, 'Interaccion_Menu', 'button#btn-iniciar-partida', 'click_iniciar_partida', '2026-11-15 18:12:00'),
(102, 2, 5, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_SPACE (drop_bomb en x=2,y=3)', '2026-11-15 18:12:08'),
(102, 3, NULL, 'Clic_Raton', 'canvas#bomberman-board', 'click_celda(x=8,y=8)', '2026-11-15 18:12:20'),
(103, 1, NULL, 'Interaccion_Menu', 'button#btn-cambiar-skin', 'skin=Bomberman Negro', '2026-11-16 16:21:00'),
(103, 2, 1, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_UP (move_up)', '2026-11-16 16:22:04'),
(104, 1, 5, 'Comando_Teclado', 'SDL_Window/canvas', 'SDLK_SPACE (drop_bomb)', '2026-11-16 19:05:12'),
(105, 1, NULL, 'Pulsacion_Pantalla', 'button#touch-bomb', 'tap_colocar_bomba', '2026-11-17 12:02:15'),
(105, 2, NULL, 'Pulsacion_Pantalla', 'button#touch-right', 'tap_mover_derecha', '2026-11-17 12:02:18');

-- 3.15 LOGRO
INSERT INTO LOGRO (id_logro, nombre_logro, descripcion, puntos_recompensa, categoria_logro) VALUES
(1, 'Primer Estallido', 'Destruir al menos 15 muros destructibles en una misma partida.', 150, 'Progreso'),
(2, 'Exterminador de Bots', 'Eliminar a los 3 bots controlados por IA (Bomberdude AI) en una partida.', 300, 'Desempeno'),
(3, 'Reacción en Cadena', 'Provocar una explosión múltiple encadenando 2 o más bombas.', 250, 'Desempeno'),
(4, 'Maestro del Teclado SDL2', 'Ejecutar más de 1,000 comandos de teclado acumulados.', 200, 'Interaccion'),
(5, 'Coleccionista de Power-Ups', 'Recoger los 4 tipos de bonificaciones positivas (MOREPOWER, MOREBOMB, MORESPEED, MAXPOWER).', 350, 'Progreso');

-- 3.16 USUARIO_LOGRO (Interrelación N:M #2)
INSERT INTO USUARIO_LOGRO (id_usuario, id_logro, fecha_desbloqueo, progreso_pct, notificado) VALUES
(1, 1, '2026-11-10 18:00:00', 100.00, TRUE),
(1, 2, '2026-11-12 19:30:00', 100.00, TRUE),
(1, 3, '2026-11-14 20:15:00', 100.00, TRUE),
(1, 4, '2026-11-15 17:40:00', 100.00, TRUE),
(2, 1, '2026-11-11 17:20:00', 100.00, TRUE),
(2, 2, '2026-11-15 18:30:00', 100.00, TRUE),
(3, 1, '2026-11-16 16:30:00', 100.00, TRUE),
(4, 1, '2026-11-16 19:15:00', 100.00, TRUE);
-- Nota: El usuario 5 (sofia_blast) no tiene logros desbloqueados para comprobar la Consulta 3 (diferencia de conjuntos).

-- 3.17 SKIN_BOMBERMAN (Basadas en las 4 filas de personajes de rsc/spritesheet.png: y = 0, 24, 48, 72)
INSERT INTO SKIN_BOMBERMAN (id_skin, nombre_skin, color_traje, fila_spritesheet_y, costo_puntos) VALUES
(1, 'Bomberman Blanco Clásico', 'Blanco / Azul', 0, 0),
(2, 'Bomberman Negro Sombra', 'Negro / Rojo', 24, 500),
(3, 'Bomberman Azul Cobalto', 'Azul / Blanco', 48, 800),
(4, 'Bomberman Rojo Carmesí', 'Rojo / Dorado', 72, 1200);

-- 3.18 SKIN_ETIQUETA (4FN)
INSERT INTO SKIN_ETIQUETA (id_skin, etiqueta_estilo) VALUES
(1, 'Clásico'),
(1, 'Retro-SNES'),
(2, 'Sigilo'),
(2, 'Oscuro'),
(3, 'Cobalto'),
(4, 'Élite'),
(4, 'Fuego');

-- 3.19 USUARIO_SKIN (Interrelación N:M #3)
INSERT INTO USUARIO_SKIN (id_usuario, id_skin, fecha_adquisicion, puntos_pagados, skin_equipada) VALUES
(1, 1, '2026-10-01 12:00:00', 0, FALSE),
(1, 4, '2026-11-10 19:00:00', 1200, TRUE),
(2, 1, '2026-10-02 12:00:00', 0, FALSE),
(2, 2, '2026-11-12 18:00:00', 500, TRUE),
(3, 1, '2026-10-03 12:00:00', 0, FALSE),
(3, 3, '2026-11-14 17:00:00', 800, TRUE),
(4, 1, '2026-10-05 12:00:00', 0, TRUE),
(5, 1, '2026-10-12 12:00:00', 0, TRUE);

-- =====================================================================================
-- 4. LAS 5 CONSULTAS DEL ÁLGEBRA RELACIONAL CODIFICADAS EN SQL (SECCIÓN 1.12)
-- =====================================================================================

-- Consulta 1: Jugadores con al menos 10 victorias y más de 3,000 puntos acumulados
SELECT u.id_usuario, u.nombre_usuario, e.partidas_jugadas, e.victorias, e.puntos_acumulados
FROM USUARIO u
JOIN ESTADISTICA_JUGADOR e ON u.id_usuario = e.id_usuario
WHERE e.victorias >= 10 AND e.puntos_acumulados > 3000;

-- Consulta 2: Partidas ganadas eliminando a los 3 bots en mapas con al menos 150 muros destructibles
SELECT u.nombre_usuario, m.nombre_escenario, p.duracion_segundos, p.muros_destruidos, p.puntos_obtenidos
FROM USUARIO u
JOIN PARTIDA p ON u.id_usuario = p.id_usuario
JOIN MAPA_ESCENARIO m ON p.id_mapa = m.id_mapa
WHERE p.resultado = 'Victoria' AND p.bots_eliminados = 3 AND m.muros_destructibles_iniciales >= 150;

-- Consulta 3: Jugadores que aún no han desbloqueado ningún logro (operador diferencia)
SELECT u.id_usuario, u.nombre_usuario
FROM USUARIO u
WHERE u.id_usuario NOT IN (SELECT ul.id_usuario FROM USUARIO_LOGRO ul);

-- Consulta 4: Power-ups recogidos en partidas ganadas indicando jugador, ítem y cantidad
SELECT u.nombre_usuario, p.id_partida, pw.codigo_tipo, pw.nombre_item, pp.cantidad_recogida
FROM USUARIO u
JOIN PARTIDA p ON u.id_usuario = p.id_usuario
JOIN PARTIDA_POWERUP pp ON p.id_partida = pp.id_partida
JOIN POWER_UP pw ON pp.id_powerup = pw.id_powerup
WHERE p.resultado = 'Victoria' AND pp.aplicado_a_jugador = TRUE;

-- Consulta 5: Total de eventos de interacción agrupados por jugador y categoría de evento
SELECT u.id_usuario, u.nombre_usuario, r.categoria_evento, COUNT(r.num_secuencia) AS total_eventos
FROM USUARIO u
JOIN SESION_JUEGO s ON u.id_usuario = s.id_usuario
JOIN REGISTRO_INTERACCION r ON s.id_sesion = r.id_sesion
GROUP BY u.id_usuario, u.nombre_usuario, r.categoria_evento;
