/*
 * bonus.c (Ampliado con persistencia en bomberman_db)
 *
 *  Created on: 19 mars 2017
 *      Author: Jean-Hugo / Ampliado por Equipo #13 (UAA)
 */

#include <stdlib.h>
#include <stdio.h>
#include "board.h"
#include "bonus.h"
#include "bomberman.h"
#include "assets.h"
#include "db_telemetry.h"

void apply_bonus_on_bomberman(BOARD *board, int y, int x, BOMBERMAN *bomberman)
{
	int id_powerup = 1;
	int puntos_bonus = 100;

	// Remove the malus if there is any.
	if(bomberman->speed == 1.0f){
		bomberman->speed = 1.5f;
	}

	switch(board->grid[y][x].bonus->type){
	case MOREBOMB:
		bomberman->bomb_left++;
		id_powerup = 2;
		puntos_bonus = 100;
		break;
	case MOREPOWER:
		if(bomberman->bomb_power < (board->c_size/2) - 1){
			bomberman->bomb_power++;
		}
		id_powerup = 1;
		puntos_bonus = 100;
		break;
	case MORESPEED:
		if(bomberman->speed + 0.3f <= 3.0f){
			bomberman->speed += 0.3f;
		}
		id_powerup = 3;
		puntos_bonus = 120;
		break;
	case MALUS:
		bomberman->speed = 1.0f;
		id_powerup = 4;
		puntos_bonus = 25;
		break;
	case MAXPOWER:
		bomberman->bomb_power = (board->c_size/2) - 1;
		id_powerup = 5;
		puntos_bonus = 250;
		break;
	}

	// Si el jugador humano (id == 0) recoge el power-up, se registra en PARTIDA_POWERUP y suma puntos
	if(bomberman->id == 0){
		db_record_powerup(id_powerup, puntos_bonus);
	}

	// Remove the bonus from the map.
	free(board->grid[y][x].bonus);
	board->grid[y][x].bonus = NULL;
}

void spawn_bonus(BOARD *board, ASSETS *assets, int y, int x){

	int alea;
	BONUS *bonus = malloc(sizeof(*bonus));

	alea = rand()%100;
	if(alea < 10){
		bonus->type = MALUS;
		bonus->sprite = assets->malus;
	} else if(alea < 30){
		bonus->type = MORESPEED;
		bonus->sprite = assets->bonus_speed;
	} else if(alea < 60){
		bonus->type = MOREBOMB;
		bonus->sprite = assets->bonus_bomb;
	} else if(alea < 95){
		bonus->type = MOREPOWER;
		bonus->sprite = assets->bonus_power;
	} else {
		bonus->type = MAXPOWER;
		bonus->sprite = assets->bonus_max_power;
	}

	board->grid[y][x].bonus = bonus;
}
