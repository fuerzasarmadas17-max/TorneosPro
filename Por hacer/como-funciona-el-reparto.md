# Cómo funciona el reparto de publicidad

Explicación en simple de cómo se calcula lo que le toca a cada organizador.
Para el detalle técnico y las decisiones, ver
`monetizacion-analitica-publicidad.md`.

**Última actualización:** 2026-07-30

---

## 1. La métrica: persona-día

**Un punto por cada combinación de (persona, día).**

Cuántas veces entró ese día **no importa**.

### Juan en una semana

| Día | Veces que entró | Personas-día |
|---|---:|---:|
| Sábado | 30 | **1** |
| Domingo | 2 | **1** |
| Lunes | 1 | **1** |
| | 33 visitas | **3** |

Juan entró 33 veces y aportó 3. Una por cada día distinto.

> **Volver otro día suma. Refrescar el mismo día no.**

### El techo

Una persona, en un mes de 31 días, puede aportar como máximo **31**. Ni uno más,
entre más entre.

---

## 2. Lo que persona-día NO es

| Métrica | Fórmula | Por qué se descartó |
|---|---|---|
| **Impresiones** | personas × veces que entró | Quien refresca 50 veces genera 50. Pagar por eso es invitar a inflarlo. |
| **Personas únicas** | personas distintas del mes | Se estanca. Un torneo tiene ~200 personas la primera fecha y las mismas 200 al final, aunque hayan vuelto 15 veces. |

### Por qué persona-día es mejor: el caso que importa

| Organizador | Personas | Días que vuelve cada una | Personas-día |
|---|---:|---:|---:|
| **Abel** — poca gente, muy fiel | 50 | 20 | **1.000** |
| **ESCARPI** — mucha gente, una sola vez | 500 | 1 | **500** |

Abel tiene 10 veces menos gente pero **el doble de personas-día**, así que cobra
el doble.

Con "personas únicas" habría pasado lo contrario: ESCARPI se llevaría 10 veces
más que Abel, aunque su audiencia entró una vez y se fue.

---

## 3. Se cuenta en tres dimensiones, por separado

Una persona vale **1 por día, por campaña y por organizador**.

Las tres se cuentan aparte en la base. **Nunca se suman entre niveles.**

### Los casos, Juan el mismo día

| Qué hizo Juan | Resultado |
|---|---|
| 2 torneos de Abel, **misma** campaña | Abel: **1** |
| 2 torneos de Abel, **campañas distintas** | Abel: 1 en cada campaña |
| 1 torneo de Abel y 1 de ESCARPI, misma campaña | Abel: 1 **y** ESCARPI: 1 |

**El primero** evita que los organizadores con varios torneos activos queden
inflados sin haber aportado más gente.

**El segundo** es correcto porque son dos bolsas distintas: Juan realmente le
entregó una exposición a cada anunciante.

**El tercero** es la razón de que la suma de aportes de una campaña sea mayor
que sus personas distintas. Ver el punto 5.

---

## 4. La cuenta, paso a paso

Campaña **"Ferretería"**, cobró **$400.000**:

### Paso 1 — La bolsa

```
$400.000 × 50% = $200.000
```

La mitad es de la plataforma, la mitad de los organizadores que pusieron la
audiencia. Cada campaña tiene su bolsa **separada**; no se juntan.

### Paso 2 — La tarifa

| Organizador | Personas-día que aportó |
|---|---:|
| Abel | 300 |
| ESCARPI | 200 |
| | **500** |

```
$200.000 ÷ 500 = $400 por persona-día
```

### Paso 3 — Lo que le toca a cada uno

| Organizador | Cuenta | Le toca |
|---|---|---:|
| Abel | 300 × $400 | $120.000 |
| ESCARPI | 200 × $400 | $80.000 |
| | | **$200.000** ✓ |

Cierra exacto con la bolsa. Esa es la comprobación de que está bien.

---

## 5. Cuidado con el denominador

En el paso 2, el **500** es la **suma de lo que aportó cada organizador**. No es
"las personas-día de la campaña".

No son el mismo número. Si 20 personas vieron la campaña el mismo día en un
torneo de Abel **y** en uno de ESCARPI, la campaña alcanzó **480** personas-día
distintas, pero la suma de aportes es **500** — esas 20 le cuentan a cada uno.

### Qué pasa con el número equivocado

```
$200.000 ÷ 480 = $416,67 por persona-día

Abel:     300 × 416,67 = $125.000
ESCARPI:  200 × 416,67 =  $83.333
                Total  = $208.333   ← $8.333 MÁS que la bolsa
```

Se repartiría plata que no existe. **Hay que usar la suma de aportes (500).**

| Número | Qué es | Para qué sirve |
|---|---|---|
| 480 | personas-día distintas de la campaña | la cifra que le decís al **anunciante** |
| 500 | suma de aportes por organizador | la base para **repartir** |

Los dos son correctos, para cosas distintas.

---

## 6. Cada campaña tiene su propia tarifa

Y eso es correcto, no un error.

| Campaña | Bolsa | Personas-día | Tarifa |
|---|---:|---:|---:|
| Nacional grande | $500.000 | 5.000 | $100 |
| Departamental chica | $150.000 | 300 | $500 |

La chica paga **5 veces más por persona** porque su bolsa se divide entre menos
audiencia. Refleja lo que el anunciante pagó por llegar a ese público.

---

## 7. Solo cuenta el torneo que la campaña alcanzó

Las campañas están **segmentadas**. Una de Córdoba solo se muestra en torneos de
Córdoba.

Abel tiene 5 torneos: 1 en Montería y 4 en Sincelejo.

| Campaña | Apunta a | Torneos de Abel que cuentan |
|---|---|---|
| Ferretería | Córdoba | solo el de **Montería** |
| Panadería | Sucre | solo los **4 de Sincelejo** |

Para Ferretería, los 4 de Sincelejo **no existen**: ni suman ni restan.

### Por qué no un fondo común

Con un fondo común repartido por audiencia total, una campaña de Córdoba le
pagaría al organizador más grande de la plataforma aunque **no le haya aportado
ni una persona a esa campaña**, mientras los de Montería que entregaron el 100%
reciben migajas.

### La consecuencia para el negocio

**Audiencia sin campaña que la cubra no genera un peso.**

Si Sucre concentra mucha audiencia y no hay campañas apuntando ahí, es inventario
que no se está vendiendo. Sirve para saber **dónde buscar anunciantes**.

---

## 8. Los que no clasifican

Su audiencia **sí cuenta** en el denominador, pero su plata **no se reparte**:
queda con la plataforma.

Es deliberado. Si el denominador fueran solo los que clasifican, ellos
absorberían esa parte y cobrarían **más que su aporte real**.

Motivos de no clasificar:

| Motivo | Estado |
|---|---|
| Cuenta excluida (pruebas, demo, socio) | activo |
| No llegó al umbral de monetización | **todavía no se evalúa** — espera la medición de agosto |

---

## 9. Por qué los montos cuadran al peso

Los montos **no** se calculan multiplicando por la tarifa y redondeando cada
fila: eso descuadra contra la bolsa por unos pesos.

Cada fila recibe su parte entera y los pesos sobrantes se reparten de a uno a
las fracciones más grandes. Así la suma da la bolsa exacta.

> Si multiplicás a mano y te da $1 o $2 de diferencia, **no es un error** — es el
> redondeo bien hecho.

Los empates se resuelven siempre igual, así que a quién le tocó el peso extra no
cambia si recargás la página.

---

## 10. De dónde sale la plata

**De los pagos aprobados**, no del precio de lista. Si el anunciante no pagó, no
hay nada que repartir.

Y **prorrateada**: lo cobrado se divide entre el tiempo que la campaña estuvo al
aire, y cada mes se lleva su parte.

### Campaña de $310.000, al aire del 15 de julio al 14 de agosto

| Mes | Días al aire | Le toca |
|---|---:|---:|
| Julio | 17 | ~$176.000 |
| Agosto | 14 | ~$134.000 |
| | 31 | **$310.000** |

Sin prorratear aparecería con $310.000 en julio **y otros** $310.000 en agosto:
se repartiría el 50% de $620.000 cuando solo entraron $310.000.

Si la campaña estuvo al aire **todo el mes**, se lleva el 100% y no pasa nada
raro. El prorrateo solo se nota en el mes en que la campaña arranca y en el que
termina.

---

## 11. Ejemplo completo

**Dos campañas cobradas:**

| Campaña | Apunta a | Cobrado | Bolsa (50%) |
|---|---|---:|---:|
| Ferretería | Córdoba | $400.000 | $200.000 |
| Panadería | Sucre | $300.000 | $150.000 |
| | | **$700.000** | **$350.000** |

**Ferretería** — tarifa $200.000 ÷ 500 = **$400/persona-día**

| Organizador | Personas-día | Le toca |
|---|---:|---:|
| Abel (su torneo de Montería) | 300 | $120.000 |
| Pedro | 200 | $80.000 |
| | **500** | **$200.000** |

**Panadería** — tarifa $150.000 ÷ 1.000 = **$150/persona-día**

| Organizador | Personas-día | Le toca | |
|---|---:|---:|---|
| Abel (sus 4 de Sincelejo) | 800 | $120.000 | |
| ESCARPI | 150 | $22.500 | |
| Torneos Pro | 50 | $7.500 | ← retenido, cuenta excluida |
| | **1.000** | **$150.000** | |

**Resultado del mes:**

| Organizador | Campañas | A transferir |
|---|---:|---:|
| Abel | 2 | **$240.000** |
| Pedro | 1 | $80.000 |
| ESCARPI | 1 | $22.500 |
| | | **$342.500** |

**Cómo cuadra:**

```
Cobrado a anunciantes        $700.000
  → bolsa organizadores       $350.000  (el 50%)
       a transferir            $342.500
       retenido                  $7.500  (Torneos Pro)
  → mitad de la plataforma    $350.000

Te quedas: $350.000 + $7.500 = $357.500
```

---

## 12. Las reglas que siempre se cumplen

Si alguna de estas no cuadra, es un bug:

| Regla | |
|---|---|
| `a transferir + retenido = la bolsa` | por campaña y en total |
| `bolsa = cobrado × 50%` | redondeado hacia abajo |
| La suma de los meses de una campaña **nunca excede lo cobrado** | por el prorrateo |
| Una persona aporta como máximo 1 por día, campaña y organizador | |
| Suma de aportes ≥ personas-día distintas de la campaña | nunca al revés |

---

## 13. Lo que todavía no está activo

- **El umbral de monetización.** Hoy solo se aplica la bandera de cuenta
  excluida. Los requisitos están definidos pero sus números esperan la medición
  de agosto.
- **La sección que ve el organizador.** Todo esto vive únicamente en el panel de
  admin; el organizador no ve nada todavía.
