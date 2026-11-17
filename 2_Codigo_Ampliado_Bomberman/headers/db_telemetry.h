/*
 * db_telemetry.h
 * Integración de persistencia y telemetría con MySQL/MariaDB (bomberman_db)
 * Proyecto Final de Bases de Datos - UAA - Equipo #13
 */

#ifndef DB_TELEMETRY_H_
#define DB_TELEMETRY_H_

#include <SDL2/SDL.h>
#include "board.h"
#include "bomberman.h"

typedef struct DB_CONTEXT {
    int id_usuario;
    char nombre_usuario[40];
    int id_sesion;
    int id_mapa;
    int id_partida_actual;
    Uint32 inicio_partida_ticks;
    int num_secuencia_evento;
    int puntos_partida;
    int bombas_colocadas;
    int muros_destruidos;
    int bots_eliminados;
    int clics_raton_sesion;
    int comandos_teclado_sesion;
    int interacciones_menu_sesion;
} DB_CONTEXT;

extern DB_CONTEXT g_db_ctx;

void db_init_session(int id_usuario, const char *nombre_usuario, int id_mapa);
void db_start_match(void);
void db_record_interaction(const char *categoria_evento, const char *origen_elemento,
                           const char *detalle_valor, int id_comando);
void db_record_powerup(int id_powerup, int puntos_bonus);
void db_end_match(const char *resultado, BOARD *board);
void db_close_session(void);

#endif /* DB_TELEMETRY_H_ */
