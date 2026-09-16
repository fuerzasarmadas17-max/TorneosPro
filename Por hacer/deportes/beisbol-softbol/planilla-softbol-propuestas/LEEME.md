# Planilla digital de softbol bola lenta — propuesta de pantallas

Es lo que ve **la mesa** durante el juego. El documento con todas las
decisiones es `../planilla-en-vivo-softbol.md`. Modo oscuro nomás; cuando se
construya va en claro y oscuro como el resto de la plataforma. Los colores y
la letra son los mismos de la planilla de vóley.

Los datos son inventados y cuadran entre sí: es la baja de la 4.ª, Tigres
batea con dos outs, Díaz en 3.ª y Ruiz en 1.ª, y le toca a Andrés Pérez.

| Archivo | Qué muestra |
|---|---|
| `1-lineup.png` | **Antes del partido.** El orden al bate de un equipo con la posición de cada uno, el bateador extra (EH), el interruptor de short fielder, el banco y, abajo y chiquito, "Jugador nuevo". |
| `2-juego.png` | **La pantalla del juego.** Pizarra por entrada, entrada y outs, carreras de esta entrada, el diamante con los corredores, quién batea y quién sigue, los botones del turno y el historial de la entrada. |
| `3-fly.png` | Se tocó **Fly**: el campo con los fildeadores del otro equipo, se toca quién la atrapó. Muestra "F8" y avisa que es el 3.er out. |
| `4-rolling.png` | Se tocó **Rolling**: se tocan en orden el que fildeó y el que recibió. Arma "6-3" y dice a quién va la asistencia y a quién el out. |
| `5-corredores-error.png` | Después de un **sencillo con gente en base**: la app propone dónde quedó cada corredor. Ruiz llegó más lejos de lo normal, así que aparece "¿Por qué?" y se marca el error del 8. |
| `5-corredores-out-en-home.png` | **Fly al 8 y sacan en home al de 3.ª**: se marca Out y aparece "¿Quién lo sacó?", 8 y 2. La app dice que fue doble play y cierra la entrada. |
| `6-cambio.png` | **Cambio al momento de batear**: sale el que le tocaba, entra uno del banco. "Agregar jugador nuevo" va abajo, en letra chica. |

## Las ideas detrás

- **Una familia por fila y por color.** Hits en dorado, outs en rojo, lo demás
  en blanco. La mesa busca primero "¿fue hit o fue out?" y después cuál.
- **Se toca dónde, no se escribe un número.** En fly, línea, rolling y error
  aparece el campo con los nombres de los que están defendiendo. La notación
  ("F8", "6-3") la arma la app y se muestra para confirmar. Quien no sabe la
  notación igual la anota bien, porque toca al jugador.
- **La app propone, la mesa corrige.** Los corredores y las impulsadas vienen
  llenos con lo que pasa casi siempre. Si nadie toca, se acepta.
- **Todo lo del bateador está junto.** El botón de cambio está en su tarjeta,
  porque el cambio casi siempre se hace justo cuando le toca batear.
- **"Jugador nuevo" escondido a propósito.** Si estuviera a la vista, la mesa
  escribiría nombres que ya están en el banco y aparecerían repetidos.
- **Los outs y las carreras de la entrada, grandes.** Son lo que la mesa mira
  a cada rato para saber cuándo cambia el equipo al bate.

## Para cambiar algo

1. Abre el `.html` que corresponde y edita lo que quieras.
2. En la Terminal, parado en esta carpeta, corre `./render.sh`.
3. Los `.png` quedan actualizados.

Las pantallas 3 a 6 dibujan encima de `2-juego.html` (con `?outs=1` muestra un out en vez de dos): si cambias el juego,
cambia el fondo de todas. `comun.css` tiene los colores y lo que comparten.
