# Planilla digital de vóley — 3 propuestas de pantalla

Tres formas distintas de la misma pantalla, para elegir una. Están en **modo
oscuro** nomás; cuando elijas, se construye en claro y oscuro como todo el resto
de la plataforma. Los colores son los mismos del tema oscuro de Torneos Pro.

Es la pantalla que ve **la mesa** en el celular, con el set en juego. Todas
muestran lo mismo: el marcador, quién saca, los seis en cancha, y los botones
para sumar punto, deshacer, hacer un cambio y cerrar el set.

| Archivo | Propuesta | Para qué sirve mejor |
|---|---|---|
| `1-marcador-grande.png` | **Marcador grande** | El marcador manda y los dos botones de punto son enormes. La más fácil de usar parado, con una mano, sin mirar mucho. La rotación queda de apoyo, abajo. |
| `2-cancha.png` | **Cancha** | Dibuja la cancha con los seis de cada equipo en su posición real. La que más se parece a lo que la mesa ve enfrente. La mejor para tablet. |
| `3-planilla.png` | **Planilla clásica** | Se lee como la planilla de papel: los sets arriba, las dos filas de equipos con su botón, y el historial de los últimos puntos abajo. La que más información muestra. |

## Lo que hay que mirar para elegir

- **¿Con qué mano y en qué postura anota la mesa?** Si es de pie con el celular
  en una mano, la 1. Si tiene una tablet sobre una mesa, la 2.
- **¿Quiere ver el historial?** Solo la 3 lo muestra completo; la 1 muestra los
  últimos cinco puntos.
- **¿La rotación es lo importante o el marcador?** La 2 le da a la rotación el
  lugar principal; la 1 y la 3 la ponen de apoyo.

Se pueden mezclar: por ejemplo la cancha de la 2 con los botones grandes de la 1.

## Para cambiar algo

1. Abrí el `.html` que corresponde y editá lo que quieras (los nombres de los
   equipos, los números, el marcador).
2. En la Terminal, parado en esta carpeta, corré `./render.sh`.
3. El `.png` queda actualizado.

`comun.css` tiene los colores y lo que comparten las tres.
