# Bomberman Ampliado con Persistencia en Base de Datos (MySQL / MariaDB)

**Universidad Autónoma de Aguascalientes (UAA)**  
**Centro de Ciencias Básicas — Departamento de Sistemas de Información**  
**Materia:** Bases de Datos (BD) | **Carrera:** I.C.I. | **Semestre:** 5°  
**Profesor:** Dr. Jaime Muñoz Arteaga  
**Equipo #13:**
- Pedro Fernando López Vázquez
- Santiago Andrey Muñoz Muñoz
- Ángel Josué Muñoz Muñoz
- Luis Gerardo Escamilla López

**Repositorio base original:** `https://github.com/jhoukem/Bomberman` (Autor: Jean-Hugo, C / SDL2)

---

## Arquitectura de la Ampliación

Esta versión ampliada integra el videojuego **Bomberman** con la base de datos relacional **`bomberman_db`** en **MySQL / MariaDB** siguiendo la arquitectura de tres niveles **ANSI/SPARC**:

1. **Módulos C / SDL2 ampliados (`src/` y `headers/`):**
   - `headers/db_telemetry.h` y `src/db_telemetry.c`: Cliente HTTP/REST nativo en C (`WinInet`) que transmite sesiones (`SESION_JUEGO`), partidas (`PARTIDA`), power-ups (`PARTIDA_POWERUP`) y eventos granulares (`REGISTRO_INTERACCION`) al servidor de base de datos.
   - `src/input.c`: Captura eventos de teclado (`SDL_KEYDOWN`: `SDLK_UP`, `SDLK_DOWN`, `SDLK_LEFT`, `SDLK_RIGHT`, `SDLK_SPACE`, `SDLK_p`, `SDLK_ESCAPE`, `SDLK_m`), clics del ratón (`SDL_MOUSEBUTTONDOWN`) e interacciones con menús.
   - `src/bomb.c` y `src/bonus.c`: Contabilizan muros destruidos (`+25 pts`), bots eliminados (`+300 pts`) y power-ups recogidos (`MOREPOWER`, `MOREBOMB`, `MORESPEED`, `MALUS`, `MAXPOWER`).
   - `src/main.c`: Registra el inicio y fin de partida (`Victoria` con `+500 pts` si sobrevive `bomberman[0]`, o `Derrota`).

2. **Servidor Backend y Motor Web HTML5 Canvas (`server.js` y `public/`):**
   - `server.js`: API REST en **Node.js + Express + mysql2** conectada mediante pool de conexiones a `bomberman_db`.
   - `public/index.html`, `public/style.css` y `public/bomberman_app.js`: Interfaz interactiva ejecutable en cualquier navegador que carga los recursos gráficos y sonoros originales (`rsc/spritesheet.png`, `rsc/bm.ttf`, `rsc/explosion.wav`, `rsc/power_up.wav`) junto con un panel en vivo de gestión de usuarios, selección de mapas/trajes, estadísticas de la vista `vw_desempeno_jugador` y bitácora de interacciones.

---

## Requisitos e Instrucciones de Ejecución

### Paso 1: Importar la Base de Datos en MySQL / MariaDB
Ejecuta el script SQL ubicado en `../database/bomberman_db.sql` (o `../3_Base_De_Datos/bomberman_db.sql`):

```bash
mysql -h 127.0.0.1 -P 3307 -u root < ../database/bomberman_db.sql
```
*(Si utilizas el puerto estándar 3306 o contraseña en `root`, ajusta el archivo `.env` en esta carpeta).*

### Paso 2: Instalar Dependencias e Iniciar el Juego Ampliado
```bash
cd codigo_ampliado
npm install
npm start
```
Abre en tu navegador: **`http://localhost:3000`**

### Paso 3: Ejecutar las Pruebas Funcionales Automatizadas
```bash
npm run test-db
```
