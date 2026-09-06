# Torneo con varias copas — grupos y después Oro, Plata, Bronce…

**Estado:** idea evaluada, **pedida por el dueño el 2026-09-06.** Nada
construido. Esto es el plan para no volver a pensarlo desde cero.
**Origen:** hay ligas que corren un solo torneo donde *todos* siguen jugando
después de los grupos, repartidos en varias eliminaciones directas por nivel.
Hoy en la plataforma ese torneo no se puede armar.

---

## 1. La conclusión, arriba

**2 semanas la versión útil. 3 a 4 la completa.**

No hace falta un motor nuevo: **una copa es una llave con nombre**. El armador
de llaves, los byes, el avance automático del ganador y el reparto de cupos por
grupo ya existen y funcionan. Lo que hay que agregar es a qué copa pertenece
cada partido, y de qué puestos sale cada copa.

El trabajo grande no está en las llaves. Está en que **todo el sistema hoy
asume que hay un solo campeón** (sección 4).

---

## 2. Qué pidió, con el ejemplo grande

Un torneo, una fase de grupos, y después varias eliminaciones directas en
paralelo alimentadas por **bloques de puestos**:

| Puestos en su grupo | Copa |
|---|---|
| 1º y 2º de cada grupo | Copa Oro |
| 3º y 4º | Copa Plata |
| 5º y 6º | Copa Bronce |
| 7º y 8º | Copa Estaño |

Con 4 grupos de 8 equipos, eso son 4 copas de 8 equipos cada una, todas adentro
del mismo torneo. **Los nombres los pone el organizador** y cambian en cada
liga — "Oro / Plata / Bronce" es solo el ejemplo; puede ser "Copa Presidente",
"Copa Amistad", lo que sea.

La gracia del formato: nadie se va a su casa después de los grupos. El que salió
último de su grupo sigue jugando una copa que puede ganar.

---

## 3. Lo que ya está construido

| Pieza | Dónde | Qué hace |
|---|---|---|
| Grupos con varias fases | `tournament_groups.phase`, `PhaseConfig` en `src/types/index.ts` | Un torneo puede tener fase 1, fase 2… |
| Cuántos pasan por grupo | `20260602_per_group_advancement.sql`, `PlayoffConfig.perGroup` | Cupos por grupo, incluso desparejos (Grupo A → 2, Grupo B → 3) |
| Armador de llaves | `src/components/tournaments/bracket-matchup-builder.tsx` | El organizador arma los cruces a mano, y **ya resuelve los byes** cuando los clasificados no son potencia de dos |
| Estado del bracket | `20260606_playoff_bracket_state.sql`, `src/hooks/use-bracket.ts` | Rondas encadenadas con `next_match_id` |
| Avance automático | `src/lib/admin/auto-advance.ts` | El ganador sube solo a la ronda siguiente |
| Stats por tramo | `src/hooks/use-tournament-stats.ts` | Ya separa temporada regular de postemporada |

---

## 4. El obstáculo real: el sistema tiene UN campeón

`getFinalSeriesChampion` (`src/data/helpers.ts:14`) agarra **todos** los
partidos de playoff del torneo, busca la ronda más alta y dice "este ganó". Con
una sola llave está bien. Con cuatro copas hay cuatro finales al mismo tiempo y
esa cuenta deja de tener sentido.

Y de esa función cuelga más de lo que parece: el modal de "¡Tenemos campeón!",
la foto del campeón, **el MVP del torneo** (recién desplegado el 2026-09-06) y
la tarjeta del torneo. Hay **17 archivos** que mencionan `"playoff"`.

Por eso el recorte más importante de todos está en la sección 6.

---

## 5. Qué hay que construir

### 5.1 A qué copa pertenece cada partido
Tabla `tournament_cups` (torneo, nombre, orden, de qué puestos se alimenta) y
una columna `cup_id` en `matches`. Es la parte fácil y de la que cuelga todo lo
demás.

### 5.2 El reparto por puestos
Hoy la regla es "los N primeros de cada grupo pasan **a la llave**". Ahora es
"1º y 2º **a esta** copa, 3º y 4º **a esta otra**". Los puestos ya se calculan
—la tabla de posiciones existe y desempata—; lo que falta es el mapa
puesto → copa.

### 5.3 Generar N llaves en vez de una
Correr el generador que ya existe, una vez por copa. Cada copa arma sus cruces
con el armador actual, que ya sabe de byes.

### 5.4 Las pantallas
El bracket hoy es uno solo: hay que ponerle pestañas por copa. Y en el
calendario y los resultados, decir a qué copa pertenece cada partido — si no,
el espectador ve una final y no sabe de qué.

### 5.5 El campeón, por copa
Ver sección 4. Es donde está el trabajo de verdad.

---

## 6. Los cuatro recortes que lo hacen barato

1. **Solo la copa principal tiene ceremonia.** La Oro corona campeón, con su
   foto y su MVP, exactamente como hoy. Las demás muestran su llave y su
   ganador, pero **no tocan nada de lo ya construido**. Ahorra alrededor de una
   semana y evita meter mano en la pieza más nueva del sistema.
2. **Bloques de puestos seguidos** (1-2, 3-4, 5-6), como lo planteó el dueño. Sin
   pantalla de siembra libre, que es donde se va el tiempo.
3. **Primera versión con grupos parejos.** 4 grupos de 8 → 4 copas de 8. Los
   grupos desparejos meten huecos y byes en las copas de abajo; el armador los
   soporta, pero el reparto se complica y no vale la pena en la v1.
4. **Una copa es una llave con nombre.** No inventar un formato nuevo: reusar
   el motor de eliminación directa tal cual está.

---

## 7. Cuánto es

| Parte | Peso |
|---|---|
| Tabla de copas + `cup_id` en los partidos | 1 – 2 días |
| Reparto por bloques de puestos | 2 – 3 días |
| Generar una llave por copa | 2 días |
| Pestañas por copa en bracket, calendario y resultados | 3 – 4 días |
| **Subtotal — versión útil (solo la copa principal corona)** | **≈ 2 semanas** |
| Campeón, foto y MVP por copa (las cuatro) | 1 semana |
| Wizard de creación: nombres de copas y cupos, con su validación | 3 – 4 días |
| **Total completo** | **3 – 4 semanas** |

---

## 8. Decisiones a tomar antes de empezar

- **¿Cuántas copas como máximo?** Con 4 grupos de 8 salen 4. Un tope (¿6?) evita
  pantallas imposibles y llaves de dos equipos.
- **¿Qué pasa si un equipo se retira entre los grupos y su copa?** Hoy la
  descalificación ya existe para la llave única; hay que decidir si el lugar
  queda vacío o lo hereda el siguiente puesto.
- **¿Las copas cuentan como "postemporada" en las estadísticas?** El sistema ya
  separa regular de postemporada. Lo natural es que las cuatro copas sean
  postemporada, pero conviene decirlo antes de que salgan números raros.
- **¿Tercer puesto por copa?** Si una copa lo quiere, todas lo quieren.
- **¿El precio del torneo cambia?** Son más partidos y más equipos jugando más
  tiempo; hoy el precio sale de la cantidad de equipos, no de los partidos. No
  hay que cambiarlo, pero vale saber que un torneo así usa más plataforma que
  uno normal del mismo tamaño.

---

## 9. Por dónde empezar

Por acá y no por la planilla de vóley (`planilla-en-vivo-volley.md`): es menos
trabajo, no depende de nada que no controlemos —la planilla depende de si hay
señal en la cancha— y sobre todo, **hoy este torneo no se puede correr en la
plataforma**. El organizador que lo necesita se va a otro lado.
