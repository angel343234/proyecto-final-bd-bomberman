/*
 * db_telemetry.c
 * Cliente HTTP/REST en C (WinInet) hacia el backend Node.js + MySQL (bomberman_db)
 * Proyecto Final de Bases de Datos - UAA - Equipo #13
 */

#include <windows.h>
#include <wininet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "db_telemetry.h"

DB_CONTEXT g_db_ctx = {1, "angel_munoz", 101, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

static void db_post_json(const char *endpoint, const char *json_payload)
{
    HINTERNET hSession = InternetOpenA("BombermanSDL2_Client/1.0", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hSession) return;

    HINTERNET hConnect = InternetConnectA(hSession, "127.0.0.1", 3000, NULL, NULL, INTERNET_SERVICE_HTTP, 0, 0);
    if (hConnect) {
        const char *headers = "Content-Type: application/json\r\n";
        HINTERNET hRequest = HttpOpenRequestA(hConnect, "POST", endpoint, NULL, NULL, NULL, 0, 0);
        if (hRequest) {
            HttpSendRequestA(hRequest, headers, (DWORD)strlen(headers),
                             (LPVOID)json_payload, (DWORD)strlen(json_payload));
            InternetCloseHandle(hRequest);
        }
        InternetCloseHandle(hConnect);
    }
    InternetCloseHandle(hSession);
}

void db_init_session(int id_usuario, const char *nombre_usuario, int id_mapa)
{
    char payload[512];
    g_db_ctx.id_usuario = id_usuario;
    strncpy(g_db_ctx.nombre_usuario, nombre_usuario, sizeof(g_db_ctx.nombre_usuario) - 1);
    g_db_ctx.id_mapa = id_mapa;
    g_db_ctx.num_secuencia_evento = 0;
    g_db_ctx.clics_raton_sesion = 0;
    g_db_ctx.comandos_teclado_sesion = 0;
    g_db_ctx.interacciones_menu_sesion = 0;

    snprintf(payload, sizeof(payload),
             "{\"id_usuario\":%d,\"sistema_operativo\":\"Windows 11 x64\",\"motor_ejecucion\":\"C SDL2 Native Client\"}",
             g_db_ctx.id_usuario);
    db_post_json("/api/sesiones", payload);
}

void db_start_match(void)
{
    g_db_ctx.inicio_partida_ticks = SDL_GetTicks();
    g_db_ctx.puntos_partida = 0;
    g_db_ctx.bombas_colocadas = 0;
    g_db_ctx.muros_destruidos = 0;
    g_db_ctx.bots_eliminados = 0;
}

void db_record_interaction(const char *categoria_evento, const char *origen_elemento,
                           const char *detalle_valor, int id_comando)
{
    char payload[512];
    g_db_ctx.num_secuencia_evento++;

    if (strcmp(categoria_evento, "Clic_Raton") == 0 || strcmp(categoria_evento, "Pulsacion_Pantalla") == 0) {
        g_db_ctx.clics_raton_sesion++;
    } else if (strcmp(categoria_evento, "Comando_Teclado") == 0) {
        g_db_ctx.comandos_teclado_sesion++;
    } else if (strcmp(categoria_evento, "Interaccion_Menu") == 0) {
        g_db_ctx.interacciones_menu_sesion++;
    }

    if (id_comando > 0) {
        snprintf(payload, sizeof(payload),
                 "{\"id_usuario\":%d,\"id_sesion\":%d,\"num_secuencia\":%d,\"id_comando\":%d,"
                 "\"categoria_evento\":\"%s\",\"origen_elemento\":\"%s\",\"detalle_valor\":\"%s\"}",
                 g_db_ctx.id_usuario, g_db_ctx.id_sesion, g_db_ctx.num_secuencia_evento,
                 id_comando, categoria_evento, origen_elemento, detalle_valor);
    } else {
        snprintf(payload, sizeof(payload),
                 "{\"id_usuario\":%d,\"id_sesion\":%d,\"num_secuencia\":%d,\"id_comando\":null,"
                 "\"categoria_evento\":\"%s\",\"origen_elemento\":\"%s\",\"detalle_valor\":\"%s\"}",
                 g_db_ctx.id_usuario, g_db_ctx.id_sesion, g_db_ctx.num_secuencia_evento,
                 categoria_evento, origen_elemento, detalle_valor);
    }
    db_post_json("/api/interacciones", payload);
}

void db_record_powerup(int id_powerup, int puntos_bonus)
{
    char payload[256];
    int seg = (int)((SDL_GetTicks() - g_db_ctx.inicio_partida_ticks) / 1000);
    g_db_ctx.puntos_partida += puntos_bonus;

    snprintf(payload, sizeof(payload),
             "{\"id_partida\":%d,\"id_powerup\":%d,\"segundo_aparicion\":%d}",
             g_db_ctx.id_partida_actual, id_powerup, seg);
    db_post_json("/api/partidas/powerup", payload);
}

void db_end_match(const char *resultado, BOARD *board)
{
    char payload[512];
    int duracion_seg = (int)((SDL_GetTicks() - g_db_ctx.inicio_partida_ticks) / 1000);
    if (duracion_seg < 1) duracion_seg = 1;

    if (strcmp(resultado, "Victoria") == 0) {
        g_db_ctx.puntos_partida += 500;
    }

    snprintf(payload, sizeof(payload),
             "{\"id_usuario\":%d,\"id_sesion\":%d,\"id_mapa\":%d,\"duracion_segundos\":%d,"
             "\"resultado\":\"%s\",\"puntos_obtenidos\":%d,\"bombas_colocadas\":%d,"
             "\"muros_destruidos\":%d,\"bots_eliminados\":%d}",
             g_db_ctx.id_usuario, g_db_ctx.id_sesion, g_db_ctx.id_mapa, duracion_seg,
             resultado, g_db_ctx.puntos_partida, g_db_ctx.bombas_colocadas,
             g_db_ctx.muros_destruidos, g_db_ctx.bots_eliminados);
    db_post_json("/api/partidas", payload);
}

void db_close_session(void)
{
    char payload[256];
    snprintf(payload, sizeof(payload), "{\"id_sesion\":%d}", g_db_ctx.id_sesion);
    db_post_json("/api/sesiones/cerrar", payload);
}
