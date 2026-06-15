# UX confuso: "H" en scoresheet de béisbol es sencillos, no total

**Estado:** identificado, no implementado.
**Fecha:** 2026-06-14.

## Síntoma

En el scoresheet de béisbol (`baseball-scoresheet.tsx`) la columna **H** sugiere
"total de hits" (header "H", tooltip "Hits"). Pero internamente solo cuenta
**sencillos (singles)**. Los dobles, triples y HR se cargan en columnas
separadas (2B / 3B / HR).

## Por qué confunde

La convención **tradicional de planilla de béisbol** dice "H = total de hits
incluyendo 2B/3B/HR". O sea, si el bateador hizo 1 sencillo y 1 doble, una
planilla normal lleva H=2, 2B=1.

La app usa la convención **opuesta**: H solo cuenta sencillos, el total se
calcula sumando H + 2B + 3B + HR.

## Caso concreto reportado

Organizador cargó: AB=33, H=2, 2B=1, BB=2 pensando "2 hits totales, 1 de
ellos doble".

La app calcula:
- Total hits = 2 + 1 = 3 → AVG = 3/33 = .091
- El AVG real que el organizador esperaba = 2/33 = .061

Diferencia significativa.

## Implementación interna (referencia)

`use-tournament-stats.ts:216-219`:

```ts
case "hit":      entry.singles++; entry.h++; break;
case "double":   entry.doubles++; entry.h++; break;
case "triple":   entry.triples++; entry.h++; break;
case "home_run": entry.hr++;      entry.h++; break;
```

`entry.h` es el TOTAL — bien calculado, no se toca. Lo que confunde es
**el campo de input "H" en la UI**, que en realidad representa singles
solamente.

## Opciones de fix (pendientes de decisión)

### A — Renombrar la columna a "1B"
- En `baseball-scoresheet.tsx:148`: `hit: "H"` → `hit: "1B"`.
- En el tooltip / pluralLabel del catálogo: "Sencillos" en lugar de "Hits".
- Beneficio: cero cambio de datos, claridad inmediata.
- Costo: en planillas físicas normalmente se ve "H", no "1B".

### B — Agregar columna "H total" computada
- Mantener H/2B/3B/HR como inputs (semánticamente igual que hoy).
- Sumar una columna read-only `H = singles + 2B + 3B + HR` al lado de las inputs.
- Beneficio: el organizador ve el total al cargar, evita inconsistencias.
- Costo: una columna más en una tabla ya ancha.

### C — Invertir la convención: "H" es total, restar para sacar singles
- En la UI: campo H = total de hits (lo que el organizador espera).
- Internamente: `singles = H - 2B - 3B - HR`.
- Validación: si singles < 0, error "los hits especiales no pueden superar el total".
- Beneficio: alineado con planilla tradicional.
- Costo: refactor del scoresheet y del computer, riesgo de regresión en datos ya cargados.

**Recomendación:** A es la quick win. C es lo correcto a largo plazo pero
con más riesgo y trabajo. B es el camino medio.

## Cuándo retomarlo

Cuando aparezca el primer torneo serio de béisbol cuyo organizador cargue
stats con regularidad. Hasta entonces no es bloqueante.
