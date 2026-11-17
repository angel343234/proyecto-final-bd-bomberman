#include <stdio.h>
#include <SDL2/SDL.h>
#include "input.h"
#include "bomberman.h"
#include "bomb.h"
#include "board.h"
#include "db_telemetry.h"
#include <SDL2/SDL_mixer.h>

#define SIZE 20
#define WIDTH 480
#define HEIGHT 480

void handle_key(SDL_Event *event, SDL_bool *pause, SDL_bool *reset, SDL_bool game_over, BOARD *board,
		BOMBERMAN *bomberman, SDL_bool dflag)
{
	if(dflag){
		if(event->key.keysym.sym == SDLK_ESCAPE){
			*reset = SDL_TRUE;
			db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_ESCAPE (reset_game)", 7);
			db_record_interaction("Interaccion_Menu", "menu#reset-escape", "reiniciar_partida", 0);
		} else if(event->key.keysym.sym == SDLK_p) {
			*pause = !(*pause);
			db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_p (toggle_pause)", 6);
			db_record_interaction("Interaccion_Menu", "menu#pause-overlay", *pause ? "pausar" : "reanudar", 0);
			if(*pause){
				Mix_PauseMusic();
				Mix_Pause(-1);
			} else {
				Mix_ResumeMusic();
				Mix_Resume(-1);
			}
		} else if(event->key.keysym.sym == SDLK_m) {
			db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_m (panel_estadisticas)", 8);
			db_record_interaction("Interaccion_Menu", "menu#hud-estadisticas", "consultar_estadisticas", 0);
		}
	}

	if(!bomberman->is_dead && !game_over){
		switch(event->key.keysym.sym)
		{
		case SDLK_DOWN:
			if(dflag){
				bomberman->direction = 0;
				bomberman->move_down = SDL_TRUE;
				bomberman->move_up = SDL_FALSE;
				db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_DOWN (move_down)", 2);
			} else {
				bomberman->move_down = SDL_FALSE;
				bomberman->direction = bomberman->move_left ? 1 : bomberman->move_right ? 2 : bomberman->direction;
			}
			break;
		case SDLK_LEFT:
			if(dflag){
				bomberman->direction = 1;
				bomberman->move_left = SDL_TRUE;
				bomberman->move_right = SDL_FALSE;
				db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_LEFT (move_left)", 3);
			} else {
				bomberman->move_left = SDL_FALSE;
				bomberman->direction = bomberman->move_up ? 3 : bomberman->move_down ? 0 : bomberman->direction;
			}
			break;
		case SDLK_RIGHT:
			if(dflag){
				bomberman->direction = 2;
				bomberman->move_right = SDL_TRUE;
				bomberman->move_left = SDL_FALSE;
				db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_RIGHT (move_right)", 4);
			} else {
				bomberman->move_right = SDL_FALSE;
				bomberman->direction = bomberman->move_up ? 3 : bomberman->move_down ? 0 : bomberman->direction;
			}
			break;
		case SDLK_UP:
			if(dflag){
				bomberman->direction = 3;
				bomberman->move_up = SDL_TRUE;
				bomberman->move_down = SDL_FALSE;
				db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_UP (move_up)", 1);
			} else {
				bomberman->move_up = SDL_FALSE;
				bomberman->direction = bomberman->move_left ? 1 : bomberman->move_right ? 2 : bomberman->direction;
			}
			break;
		case SDLK_SPACE:
			if(dflag){
				if(can_drop_bomb(board, bomberman)){
					drop_bomb(board, bomberman);
					g_db_ctx.bombas_colocadas++;
					db_record_interaction("Comando_Teclado", "SDL_Window", "SDLK_SPACE (drop_bomb)", 5);
				}
			}
			break;
		}
	}
}

void handle_event(SDL_Event *event, SDL_bool *play, SDL_bool *pause, SDL_bool *reset,
		SDL_bool game_over, BOARD *board, BOMBERMAN *bomberman)
{
	char click_detail[64];

	while(SDL_PollEvent(event) != 0){
		switch(event->type){
		case SDL_QUIT:
			*play = 0;
			break;
		case SDL_KEYDOWN:
			if(event->key.repeat == 0){
				handle_key(event, pause, reset, game_over, board, bomberman, SDL_TRUE);
			}
			break;
		case SDL_KEYUP:
			handle_key(event, pause, reset, game_over, board, bomberman, SDL_FALSE);
			break;
		case SDL_MOUSEBUTTONDOWN:
			snprintf(click_detail, sizeof(click_detail), "click_celda(x=%d,y=%d)",
					event->button.x / (WIDTH / board->c_size),
					event->button.y / (HEIGHT / board->l_size));
			db_record_interaction("Clic_Raton", "SDL_Window#board", click_detail, 0);
			break;
		}
	}
}
