# Asociaciones cristianas de EE.UU. — mercado y números

**Estado:** exploración de mercado. **No hay nada construido ni comprometido.**
**Fecha:** 2026-08-18.
**Origen:** el organizador preguntó dónde juegan los colegios de iglesias en
Michigan, y de ahí salió la idea de un producto aparte —en otro repo, en
inglés— para venderle a asociaciones deportivas escolares cristianas.

> ⚠️ **Los números de plata de la sección 5 y 6 son estimaciones mías, no
> datos.** Lo único verificado es lo que está en las secciones 2 y 3, que sale
> del sitio y del manual de la asociación. El número de escuelas de MACS **no
> está publicado** y es el primer dato que hay que confirmar, porque de ahí
> cuelga toda la aritmética.

---

## 1. La conclusión, arriba

Con **MACS sola**: el piloto son **$900**, el año 1 completo **$4,500**, y con
taquilla y publicidad el techo llega a **$5,750 – $7,000 al año**.

Eso no es un sueldo. Es un ingreso lateral.

El negocio de verdad no es MACS — es que MACS sea la puerta a las **otras 37
asociaciones estatales** que se conocen entre ellas. Ahí el techo teórico sube a
unos **$230,000 al año**, y un escenario bueno pero creíble a cinco años son
**$100,000 a $130,000**.

La pregunta correcta no es cuánto da MACS. Es si MACS abre la puerta.

---

## 2. Quién es el cliente

**MACS — Michigan Association of Christian Schools.** `macshome.org`

No es una empresa de deportes: es un gremio de escuelas cristianas. Hacen
acreditación, cabildeo en Lansing y Washington, festivales de bellas artes, y
**entre otras cosas** corren los torneos deportivos del estado.

Es la filial de Michigan de **AACS**, que agrupa **38 asociaciones estatales y
regionales** en todo el país.

### Quién manda

| Rol | Persona |
|---|---|
| Presidente | Dr. Douglas R. Jackson (pastor en Saginaw) |
| Director Ejecutivo | Dr. Tim Schmig |
| **Director Atlético** | **Mike Rierson** ← el interlocutor |

Mike Rierson fue coach y es exalumno de una escuela MACS. Conoce el problema
desde adentro, y es él quien hace a mano el trabajo que el producto
automatizaría.

**Contacto:** `macsathletics.mi@gmail.com` · (810) 513-3680

También tienen Facebook, Instagram (`@macs_athletics`) y un canal de YouTube.

### En qué compiten

Del manual de atletismo de abril de 2026:

| Temporada | Deportes | Divisiones |
|---|---|---|
| Otoño | Voleibol femenino | Div 1, Div 2 |
| Otoño | Fútbol masculino | 11 jugadores y 8 jugadores |
| Invierno | Básquet femenino | Div 1, Div 2 |
| Invierno | Básquet masculino | Div 1, Div 2 |
| Invierno | Lucha | invitacional |
| Primavera | Béisbol masculino | Div 1 |
| Primavera | Fútbol femenino | 11 jugadores |
| Primavera | Golf masculino y femenino | — |

Más torneos de secundaria menor (Jr. High) en fútbol, voleibol y básquet.

### Calendario verificado

| Cuándo | Qué |
|---|---|
| **15 de septiembre** | cierre de inscripciones (matasellos) y de rosters |
| 24 y 28 de octubre | cuartos y semis de fútbol masculino |
| 17–28 de octubre | cuartos y semis de voleibol |
| **1 de noviembre** | finales de otoño — voleibol en Davison HS, fútbol en Corunna HS |
| 5 de diciembre | torneo de pretemporada de básquet, The Cage, Swartz Creek |
| 19 y 23 de febrero | cuartos y semis de básquet |
| **27 de febrero** | finales de básquet, Mott Community College, Flint |
| 15–26 de mayo | repechaje, cuartos y semis de fútbol femenino |
| **30 de mayo** | final de fútbol femenino, Saginaw Valley State University |

Cobran entrada: adultos $6, estudiantes y personal $4, pase familiar $18,
menores de 5 gratis.

---

## 3. Cómo trabajan hoy — el dolor, verificado

**No tienen plataforma.** El sitio es un WordPress con una página por deporte.
Todo lo demás es remiendo:

| Qué | Con qué lo hacen hoy |
|---|---|
| Récords de temporada | **MaxPreps**, que es de terceros y gratis |
| Siembra de equipos | **Mike Rierson, a mano** |
| Inscripción al torneo | **correo postal**, matasellos 15 de septiembre |
| Rosters | correo electrónico al Director Atlético |
| Reglamento | un documento de Google |
| Directorio de directores atléticos | una hoja de Google publicada |
| Manual | un PDF |
| Reporte de partido de semifinal | **un PDF que se imprime, se llena a mano y se manda por correo con un cheque adentro** |
| Campeones históricos | la página está **caída** (error 410) |

Y del propio manual:

> "Cualquier escuela que no entregue la información requerida antes de la fecha
> límite incurrirá en una multa de $100 para ser elegible al torneo y perderá
> su voz en la siembra del torneo."

Es decir: el proceso manual les duele tanto que tuvieron que ponerle multa para
que la gente cumpla.

---

## 4. Qué sería el producto

**No es Torneos Pro con más roles.** El modelo de datos es al revés: aquí el
jugador y la temporada son permanentes, y el torneo es apenas un evento que los
alimenta. En Torneos Pro el torneo es el centro y cuando termina, se acabó.
Por eso va en otro repo.

### La jerarquía (corregida)

La idea original tenía condados y un comisionado nacional. **Ninguno de los dos
existe en la realidad:** las asociaciones no se organizan por condados sino por
divisiones según el tamaño de la escuela, y AACS no manda en deportes — MACS no
le rinde cuentas a nadie.

Lo que queda:

| Nivel | Quién es | Qué hace |
|---|---|---|
| Plataforma | **nosotros** | da de alta asociaciones, consolida y publica lo nacional |
| Asociación | MACS y las otras 37 | **el que paga**; da de alta escuelas, arma torneos y siembra |
| Escuela | cada colegio | activa cuentas de coaches y jugadores |
| Coach | | arma plantilla y alineación de cada juego, con suplentes |
| Árbitro | asignado por partido | llena la planilla, mejor al cerrar el juego |
| Jugador | | ve su expediente: todos sus torneos, todos sus años |

Cuatro niveles, no siete. Y el nivel nacional no es un cliente — somos nosotros.

### Lo público

Una landing donde cualquiera consulta tablas de posiciones por torneo, por
estado y por año, más las estadísticas.

### El corazón: el expediente del jugador

Que un chico acumule desde 9º grado un historial que en 12º un reclutador
universitario pueda mirar — y que ese historial sobreviva si cambia de escuela:
*estuvo en esta escuela, jugó estos torneos, con estos números; luego pasó a esta
otra*.

Ya hay semilla: el `player_id` de Torneos Pro (ver `flujo-b-reconciliacion.md`).

El problema difícil **no es técnico, es de proceso**: dos chicos con el mismo
nombre, y el chico que se cambia de escuela sin que nadie avise. Se resuelve con
un flujo de reclamo — la escuela nueva reclama al jugador, la vieja confirma.
Hay que diseñarlo desde el día uno, porque el expediente *es* el producto.

### Qué se reutiliza de Torneos Pro

**Sí se traslada (la mitad de abajo):** partidos, eventos y estadísticas,
planillero por token (`scorer_links` — es casi exactamente lo que se necesita
para los árbitros), brackets, tablas de posiciones, patrocinadores, pagos.

**Es nuevo (todo lo de arriba):** organizaciones, jerarquía, temporadas, roles y
permisos, expediente del jugador, y toda la interfaz en inglés.

### Lo que hay que dejar para después

Golf, lucha y atletismo **rompen** el modelo de equipo A contra equipo B:

- Golf: una tarjeta por jugador, se suman los mejores del equipo
- Lucha: brackets por categoría de peso, individuales
- Atletismo: pruebas y marcas, sin marcador

Cada uno es un subsistema aparte. No es "agregar un deporte más a la lista".

---

## 5. Cuánto cobrarle a MACS

> **Reescrita el 2026-08-18** partiendo del supuesto de **12 equipos por
> división**. Sigue siendo estimación, no dato: el número real de escuelas se
> confirma con Rierson, y es justo lo que pregunta el correo de la sección 11.

### El tamaño real

Con 12 equipos por división: básquet tiene D1 y D2, masculino y femenino, o sea
~24 escuelas con básquet. Voleibol igual, dos divisiones. Fútbol tiene 11 y 8
jugadores. No todas juegan todo.

**Total probable: 25 a 30 escuelas miembro**, y unos 90 partidos de
postemporada al año.

> Ese volumen es bajo, y hay que tenerlo claro: **no se le vende volumen, se le
> vende el tiempo de Rierson.** El argumento nunca es "manejamos muchos
> partidos". Es "dejas de sembrar a mano".

### A quién se le cobra: a la asociación, no a las escuelas

| Modelo | Cuenta | Problema |
|---|---|---|
| $1 al mes por jugador | 80 atletas × $1 × 10 meses ≈ **$800 al año por escuela** | caro para una escuela cristiana chica, y hay que negociar 28 veces |
| $20 al mes fijo por escuela | ~$200 al año × 28 escuelas ≈ **$5,600** | mejor, pero siguen siendo 28 negociaciones |
| **Cuota anual de la asociación** | un contrato, un cheque, un interlocutor | **es el recomendado** |

Es una negociación en vez de veintiocho, el que decide es Rierson que ya tiene
el dolor, y **la asociación sí tiene flujo**: cobra entradas a $6 y multas de
$100.

### Los precios

| Momento | Precio | Nota |
|---|---:|---|
| Piloto — básquet de feb 2027 | **$900** | **se acredita al año 1** |
| Año 1 completo | **$4,500** | paga $3,600 después del crédito |
| Año 2 | $4,725 | +5% |
| Año 3 | $4,960 | +5% |

**Todo incluido desde el año 1**: las tres temporadas, el histórico, el portal
público, Jr. High. No guardar funciones para cobrarlas después — eso le enseña
al cliente a esperar en vez de a usar.

### Por qué $900 en el piloto

Por debajo de $1,000 **Rierson lo aprueba solo**. Por encima, casi cualquier
organización sin ánimo de lucro lo manda a junta directiva y se va medio año.

Y $500 sería demasiado barato: lo que sale casi gratis no se usa, y un piloto
que no se usa no prueba nada.

**El piloto se acredita al año 1**, y esto no es opcional. Sin el crédito,
saltar de $900 a $4,500 parece que le viste la cara. Con el crédito no hay
salto: el año 1 cuesta $4,500 y $900 ya están pagos. Es la misma plata para
nosotros y desaparece la sensación de aumento.

Textual, en la propuesta:

```
Pilot: $900 for the February basketball tournament.
If you continue, that $900 is credited toward your first full year.
```

### Por qué $4,500 y no $5,000

1. **Aguanta tres años por debajo de $5,000** aun subiendo 5% al año. Muchas
   organizaciones sin ánimo de lucro tienen ahí su umbral de aprobación de
   junta; cruzarlo dispara comité y demoras.
2. **No es un número redondo.** $5,000 parece plantado por un vendedor; $4,500
   parece calculado.
3. Sale a **~$160 por escuela al año** — unos $13 al mes por escuela.
4. Es **$375 al mes**, que es como lo va a pensar él.

### Las renovaciones se mantienen aburridas

Subir 56% en la renovación es exactamente el momento en que una organización sin
ánimo de lucro se pone a cotizar con otro. **+5% al año y ya.**

El crecimiento no sale de exprimir a MACS. Sale de dos lados:

1. **Taquilla digital a comisión** — crece si a ellos les va bien, así que nunca
   se siente como un aumento.
2. **Las otras 37 asociaciones.**

### Cómo presentar el número

Nunca decir "$4,500 al año". Siempre en la moneda de ellos:

> **$160 por escuela al año. Menos de $15 al mes por escuela.**
>
> **Son 750 entradas de adulto.** Una jornada de finales en Mott lo paga.

Y el piloto: **$900 son nueve de las multas que ya cobran.**

### El rango, para calibrar

| Precio anual | Cómo se lee |
|---|---|
| menos de $2,500 | suena a hobby; genera dudas de si seguirás ahí el año entrante |
| **$4,000 – $5,500** | **serio y aprobable sin drama** |
| más de $10,000 | junta, comité, licitación — seis meses |

**Por debajo de $3,000 no bajar.** No por codicia: abajo de eso no alcanza para
dar soporte en serio, y un cliente mal atendido cuesta la recomendación ante las
otras 37.

### ¿Es caro para estándares gringos? No — es barato

El software de deportes escolares allá (FinalForms, rSchoolToday, Arbiter) cobra
del orden de **$1,000 a $3,000 por escuela y por año**. Cada escuela.

Aquí son $4,500 por **28 escuelas**: ~$160 cada una. Un orden de magnitud por
debajo del mercado.

**El precio nunca fue el problema; el presupuesto de MACS sí.** Son cosas
distintas y se atacan distinto.

### Ingresos extra

| Línea | Estimado anual | Nota |
|---|---:|---|
| Entradas digitales (comisión ~5%) | ~$1,250 | asume ~$25,000 brutos en taquilla al año |
| Publicidad en el portal público | por definir | el motor ya existe en Torneos Pro |

### El techo con MACS sola

**$5,750 a $7,000 brutos al año** — los $4,500 más taquilla y publicidad.

Bajó frente a la estimación anterior de $10,000 a $15,000, **y está bien que
haya bajado**: aquella cifra salía de subirle fuerte el precio en el año 2, que
es justo lo que haría que MACS se fuera a cotizar con otro. La plata está en las
otras 37, no en exprimir a la primera.

Y **brutos** quiere decir antes del costo real, que es el tiempo dando soporte.
La infraestructura es barata; el tiempo no.

---

## 6. Cuánto si les gusta y lo contratan más gente

Aquí sí está el negocio. **38 asociaciones estatales**, y —esto es lo
importante— **se conocen entre ellas**: se ven en las convenciones de AACS. Un
MACS contento no es un cliente, es una carta de presentación ante 37 más.

A ~$4,500 de cuota más taquilla, cada asociación vale del orden de **$6,000
brutos al año**:

| Año | Asociaciones | Bruto anual estimado |
|---|---:|---:|
| 1 | 1 (MACS) | $5,400 |
| 2 | 3 – 4 | $18,000 – $24,000 |
| 3 | 8 – 10 | $48,000 – $60,000 |
| 5 (escenario bueno) | ~20 | $100,000 – $130,000 |
| Techo teórico | las 38 | ~$230,000 |

### Y más allá

- **MCSAA** y otras asociaciones cristianas que no son de AACS
- **ACSI** — mucho más grande que AACS, miles de escuelas. **Sin verificar si
  hacen deportes; vale la pena revisarlo.**
- Cualquier liga escolar de EE.UU., no solo cristiana. Lo cristiano es la
  puerta de entrada, no el techo — pero ese mercado ya tiene competencia dura
  (SportsEngine, rSchoolToday, Arbiter, FinalForms).

---

## 7. Los riesgos, sin adornos

1. **Compites contra gratis.** MaxPreps no cobra y NCSAA tampoco. Peor: el
   manual de MACS ya **obliga** a usar MaxPreps. No se gana peleando ahí.
2. **La venta es lenta.** Es una junta directiva de una organización sin fines
   de lucro que decide una vez al año.
3. ~~**Estás lejos.**~~ **Corregido el 2026-08-18:** este riesgo era mucho menor
   de lo que estimé. El organizador habla inglés, y Colombia está a una hora de
   Michigan o a ninguna según la época del año. Queda solo que no lo conocen,
   que se arregla con una llamada.
4. **Nadie compra el nivel nacional.** No existe la autoridad a la que
   venderle esa capa.
5. **El mercado es chico.** Aunque te ganaras las 38 asociaciones, son ~$300,000
   al año. Buen negocio pequeño; no es escala.

### Dónde sí se gana

Ni MaxPreps ni NCSAA **producen** resultados: los reciben. Alguien tiene que
capturarlos a mano y subirlos. La herramienta los produce.

De ahí sale la función que más vale y menos cuesta: **que al cerrar un partido
el resultado salga solo hacia MaxPreps**. Eso convierte el producto de "otra
cosa más que llenar" en "lo que te ahorra llenar dos sitios".

Y NCSAA, con 550+ escuelas miembro, podría ser canal de distribución en vez de
rival. El riesgo obvio es que decidan construirlo ellos.

---

## 8. Qué hacer primero

**No construir la pirámide completa.** Construir lo mínimo que le quita el dolor
a Mike Rierson:

1. Inscripción en línea (hoy es correo postal)
2. Siembra automática a partir de los récords (hoy la hace él a mano)
3. Brackets
4. Captura de resultados por el árbitro
5. Tabla de posiciones y campeones históricos

Nada más. Vendérselo barato por una temporada.

Si dice que sí, se construye el resto con plata de él y con la certeza de que
sirve. Si dice que no, se ahorran seis meses.

### El calendario manda

La inscripción de MACS cierra el **15 de septiembre**, en cuatro semanas. **No
se alcanza a construir para el otoño** — pero sí se alcanza a *escribirle ahora*,
que es justo cuando está metido en el proceso manual y le duele.

**El piloto se apunta al básquet del 27 de febrero de 2027.** Eso da unos cinco
meses de construcción y una fecha real contra la cual vender.

---

## 9. Datos que faltan confirmar

- [ ] **Cuántas escuelas miembro tiene MACS.** No está publicado. De aquí cuelga
      toda la aritmética de la sección 5.
- [ ] Cuántos atletas mueve al año, y cuántos partidos por temporada.
- [ ] Si MACS tiene presupuesto propio para software y quién lo aprueba.
- [ ] Cuánto recaudan de verdad en taquilla.
- [ ] Si ACSI organiza deportes, y de qué tamaño.
- [ ] Si NCSAA estaría dispuesta a integrarse o si prefiere construirlo.

---

## 10. Cómo cobrar, y si hace falta una LLC

> ⚠️ **Nada de esta sección es consejo legal ni contable.** Hay que validarlo
> con un contador colombiano que sepa de rentas del exterior, y con un contador
> gringo para la parte del IRS.

### La conclusión

**Para proponer no hace falta nada.** Para cobrar tampoco, al principio.
**La LLC se abre cuando haya dos o tres asociaciones pagando**, o el día que
MACS diga expresamente que no le puede pagar a un proveedor extranjero.

Con un solo cliente de $5,000 al año, la LLC se come entre el **10% y el 20%**
de todo lo que se factura y **no ahorra un peso de impuesto colombiano**.

### Cómo cobrar sin LLC

| Qué | Cómo |
|---|---|
| Certificar que no eres contribuyente gringo | **W-8BEN** (persona natural) o **W-8BEN-E** (empresa). Se llena una vez. |
| Recibir el dinero | **Wise** o **Payoneer** dan datos de cuenta bancaria en EE.UU. (routing y account number). MACS transfiere por ACH como a cualquier proveedor local. |

Esto último importa porque **MACS paga con cheques por correo** — está en su
propio reglamento. Un cheque gringo a Colombia es impracticable.

La otra fricción es humana: el contador de una organización sin ánimo de lucro a
veces se resiste a pagarle a un extranjero porque es papeleo distinto. No es
prohibición, es pereza. Se maneja hablando.

### ⚠️ Cómo redactar el contrato — esto sí cuesta plata

**EE.UU. y Colombia no tienen tratado para evitar la doble tributación.** Sin
tratado, la redacción cambia el resultado:

| Si el contrato dice… | Consecuencia |
|---|---|
| "licencia de uso de la plataforma" | puede tratarse como **regalía de fuente estadounidense** → retención del **30%** |
| "servicios de administración de torneos y soporte, prestados de forma remota desde Colombia" | fuente extranjera → **en general sin retención** |

Misma plata, misma herramienta, distinta palabra. Redactarlo como **servicio**,
y que un contador lo revise antes de firmar.

### Qué implica abrir la LLC, cuando llegue el momento

**Dónde:** Wyoming o New Mexico — baratos y sin impuesto estatal de renta.
Delaware solo sirve si se van a buscar inversionistas.

| Paso | Costo | Nota |
|---|---:|---|
| Constitución | $50 – $150 | |
| Agente registrado | $50 – $150 al año | obligatorio |
| EIN ante el IRS (formulario SS-4) | gratis | **sin SSN toca por fax o correo: 4 a 8 semanas.** Es lo que más tarda. |
| Cuenta bancaria (Mercury o Relay) | $0 | aceptan dueños extranjeros, todo en línea |
| Reporte anual del estado | $0 – $60 | |
| **Formulario 5472 + 1120 en blanco** | $300 – $800 al año | contador gringo |

**Total:** $400 a $1,000 el primer año; $400 a $900 los siguientes.

> 🚨 **El 5472 es obligatorio todos los años y la multa por no presentarlo es de
> $25,000 dólares**, aunque no se haya facturado un peso. Es la trampa que hunde
> a la gente que abre la LLC y se olvida.

### ⚠️ Lo que NO funciona: dejar las utilidades afuera

Se planteó no repatriar y gastar la utilidad en maquinaria para no pagar renta.
**No funciona, por tres razones:**

1. **Colombia grava el ingreso mundial de sus residentes fiscales.** No importa
   dónde esté la plata. Si se facturan $5,000 y se quedan en un banco de EE.UU.,
   para la DIAN son gravables ese mismo año.
2. **Régimen ECE** (entidades controladas del exterior): si se controla una
   sociedad afuera, sus rentas se atribuyen directamente. Y por **sede efectiva
   de administración**, si la LLC se maneja desde Colombia —que es el caso— la
   DIAN puede tratar a la LLC misma como residente fiscal colombiana.
3. **Comprar maquinaria no es un gasto, es un activo** que se deprecia en varios
   años. Y para ser deducible tiene que estar relacionado con la actividad que
   genera el ingreso; maquinaria ajena a un negocio de software no deduce contra
   ingresos de software. Se pagaría el impuesto igual, pero sin plata líquida.

**La LLC no es una caja fuerte, es una fachada operativa.** Para el fisco
colombiano, sigue siendo él.

### Lo que sí baja el impuesto, y es legítimo

Los gastos reales del negocio, que en este caso existen y no son pocos:
servidores y Supabase, herramientas, contratistas que ayuden a construir,
**viajes a EE.UU. a visitar clientes**, contador y abogado, marketing y ventas,
y la constitución y mantenimiento de la LLC.

Con $5,000 de ingreso y los gastos reales, la utilidad gravable queda chica
sola. No hace falta inventar nada. Vale la pena preguntarle al contador si
conviene el **régimen simple de tributación** para esta actividad.

---

## 11. El correo para Mike Rierson

Enviar a `macsathletics.mi@gmail.com`. Falta ponerle el nombre y los datos de
contacto al final.

**Asunto:** `MACS tournament seeding — a question before your Sept 15 deadline`

```
Hi Mike,

I build tournament software — it currently runs amateur leagues in Latin
America — and I've been studying how state Christian school associations
handle their postseasons. MACS is the one I keep coming back to.

I read through your April 2026 athletics manual. If I have it right:
entries come in by mail before September 15, schools log their records in
MaxPreps, and then you pre-seed the brackets by hand across eight sports and
three seasons. I also noticed the past champions page on macshome.org is
down.

Two honest questions: how many member schools are you seeding, and how many
hours does that seeding actually take you?

If it's as much work as it looks from the outside, I'd like to build MACS a
system that handles entries, seeding, brackets, live scoring by your
officials, and standings — and pushes finals to MaxPreps automatically so
nobody enters a score twice. I'd want to prove it on the February basketball
tournament first, at a price low enough to be an easy yes.

Would you have 20 minutes in the next two weeks? I'm based in Colombia, so
Eastern time is easy for me.

Thanks for your time,
[nombre]
[teléfono] · [sitio]
```

### Por qué está escrito así

| Párrafo | Qué hace |
|---|---|
| 1 | Dice quién es y que ya tiene algo funcionando. No es un estudiante con una idea. |
| 2 | **Es el que decide todo.** Demuestra que leyó su manual. Nadie que quiera venderle algo se lee un PDF de reglamento. |
| 3 | Pregunta en vez de vender. Rierson puede contestar en dos líneas, y contestar ya es la conversación. |
| 4 | La propuesta, con un piloto acotado y una fecha real. |
| 5 | Pide 20 minutos, no una compra. Y desactiva de entrada la duda del horario. |

### Reglas al enviarlo

- **No adjuntar nada.** Ni presentación ni PDF. Un adjunto de un desconocido no
  se abre.
- **No mandar link a demo** en el primer correo. Que la demo sea la razón de la
  llamada.
- **No mencionar precio.** "Lo suficientemente barato para que sea un sí fácil"
  es todo lo que hace falta ahora.
- **Si no contesta en una semana**, un solo recordatorio de dos líneas. Uno, no
  tres.
- Mandarlo **entre semana, martes a jueves, en la mañana de Michigan.**

---

## Fuentes

- Manual de Atletismo MACS, abril 2026 —
  `https://www.macshome.org/wp-content/uploads/2026/04/MACS-Athletics-Manual-April-2026.pdf`
- Reglamento y directorio — `https://macshome.org/athletics/handbook`
- Páginas por deporte — `https://www.macshome.org/locations/`
- Reporte de partido (el PDF del cheque) —
  `https://www.macshome.org/wp-content/uploads/2023/10/TOURNAMENT-GAME-REPORT.pdf`
- AACS, asociaciones estatales —
  `https://www.aacs.org/about-us/membership/state-international-associations/`
- NCSAA, envío de resultados —
  `https://www.ncsaa.org/services/submit-your-scores-and-stats`
