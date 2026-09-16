# Proyección y estructura — el negocio de EE.UU. operado desde Colombia

**Estado:** proyección, no plan. **Nada de esto está comprometido.**
**Fecha:** 2026-08-18.
**Supuesto de partida:** los precios de la sección 5 de
`asociaciones-cristianas-eeuu.md` se mantienen — $4,500 al año por asociación,
más taquilla, ≈ **$6,000 brutos por asociación al año**.

> ⚠️ **Ni consejo legal ni contable.** Todo lo tributario y societario lo tiene
> que validar un contador colombiano que sepa de rentas del exterior y precios
> de transferencia, y un contador gringo para la parte del IRS. Los costos
> laborales colombianos son órdenes de magnitud, no cotizaciones.

---

## 1. Las tres respuestas, arriba

**¿Es viable una LLC operada desde Colombia?** Sí, y de hecho **es el modelo de
negocio**. Cobrar en dólares gringos con costos colombianos es lo único que hace
que esto tenga margen. Con un equipo en EE.UU., a estos precios, no cierra.

**¿Cuánto queda al final?** En régimen, alrededor del **50% antes de pagarte
sueldo**, y **20% a 25%** después de pagarte un sueldo digno. En plata: unos
**$40,000 de utilidad de empresa al año** cuando esté maduro, más tu sueldo.

**El límite duro:** hay unas **38 asociaciones AACS** y tal vez 15 o 20 más por
fuera. El universo entero son ~55 clientes. **El techo del negocio son unos
$200,000 a $230,000 al año**, y se llega alrededor del año 7. No es un negocio
que escale; es un negocio que se estaciona en un buen lugar.

Si quieres pasar de ahí, tiene que ser con otro producto o con el mercado
escolar gringo que no es cristiano — y ese ya tiene competencia dura.

---

## 2. La proyección a siete años

Crecimiento moderado, movido por recomendación: MACS abre la puerta, y en las
convenciones de AACS las asociaciones se conocen entre ellas.

| Año | Asociaciones | Ingreso | Costos | **Antes de tu sueldo** |
|---|---:|---:|---:|---:|
| 1 · 2027 | 1 | $5,000 | $3,800 – $5,300 | **$0 – $1,200** |
| 2 · 2028 | 4 | $24,000 | $12,000 | **$12,000** |
| 3 · 2029 | 9 | $54,000 | $24,000 | **$30,000** |
| 4 · 2030 | 15 | $90,000 | $45,000 | **$45,000** |
| 5 · 2031 | 21 | $126,000 | $61,000 | **$65,000** |
| 7 · 2033 | 32 | $192,000 | $92,000 | **$100,000** |

**El año 1 no es un negocio, es una prueba.** Con los seguros de la sección 4
puede quedar en cero. Hay que entrar sabiendo eso, o te vas a desanimar en
marzo.

**El año 3 es donde deja de ser un pasatiempo.** $30,000 ya justifica el
esfuerzo, aunque todavía no te paga un sueldo completo.

**El año 5 es el punto de equilibrio real:** $65,000 alcanza para pagarte bien y
que sobre algo.

---

## 3. La estructura, paso por paso

### Etapa 1 — 1 a 3 asociaciones · $5,000 a $25,000

**Equipo: tú solo.** Nada más.

| Quién | Qué hace | Costo al año |
|---|---|---:|
| Tú | construyes, vendes y das soporte | $0 (te lo debes) |
| Contador gringo | formulario 5472 + 1120 | $500 |
| Contador colombiano | renta y rentas del exterior | $600 |
| Infraestructura | Supabase, Vercel, dominio, correo | $1,000 |
| LLC | agente registrado + tarifa estatal | $200 |
| Seguros | ver la sección 4 — **cifra no confirmada** | $1,500 – $3,000 |
| | **Total fijo** | **$3,800 – $5,300** |

> Los seguros son el costo que todo el mundo olvida, y en la primera versión de
> este documento estaban subestimados en $700. **Ver la sección 4** — pueden
> comerse casi toda la utilidad del año 1.

**El cuello de botella eres tú**, y lo que te va a ahogar no es programar: es
contestar correos en inglés durante la temporada.

### Etapa 2 — 4 a 9 asociaciones · $25,000 a $55,000

**La primera contratación no es un programador. Es soporte.**

Suena contraintuitivo, pero el soporte es lo que protege la recomendación, y la
recomendación es el único motor de crecimiento que tienes. Un cliente mal
atendido no solo se va: te cierra la puerta con los otros 37.

| Quién | Costo cargado al año |
|---|---:|
| Soporte bilingüe, medio tiempo | $7,000 |
| Programador contratista, por ráfagas | $10,000 |
| Fijos de la etapa 1, escalados | $5,000 |

> **Ojo con el costo laboral colombiano:** un salario de $1,000 al mes te cuesta
> cerca de **$1,500** con prestaciones, seguridad social y parafiscales. Todos
> los números de aquí en adelante son cargados, no salario base.

**Aquí aparece la primera decisión societaria de verdad.** Para tener empleados
en Colombia necesitas una **SAS colombiana**. La estructura estándar es:

```
LLC gringa  →  factura a los clientes, recibe los dólares
     ↓ le paga un fee por servicios
SAS colombiana  →  emplea al equipo, paga nómina e impuestos en Colombia
```

⚠️ **Ese fee entre las dos empresas está sujeto a precios de transferencia.**
Colombia exige que las operaciones con vinculadas del exterior sean a precio de
mercado, y por encima de ciertos umbrales toca documentarlo. No es opcional y no
es barato de arreglar después. Pregúntale al contador **antes** de contratar al
primero.

**Y pregunta también por la exención de IVA en exportación de servicios.** Si se
estructura bien, los servicios prestados a clientes del exterior pueden quedar
exentos. Es plata que se pierde por no preguntar.

### Etapa 3 — 10 a 20 asociaciones · $55,000 a $125,000

Ya es un equipo.

| Quién | Costo cargado al año |
|---|---:|
| 1 programador de planta | $32,000 |
| 1 soporte de tiempo completo | $13,000 |
| Ventas y viajes a convenciones AACS (2 al año) | $8,000 |
| Fijos escalados, contadores, seguro | $8,000 |
| | **~$61,000** |

**Tú dejas de programar.** Pasas a producto y ventas, que es donde ya no te
puede reemplazar nadie.

**Sobre QA:** a este tamaño un QA dedicado es un lujo. Lo que sí funciona es
aprovechar que **el calendario de ellos tiene tres picos y tres valles** —
octubre, febrero y mayo son picos; diciembre, marzo y el verano son valles. La
misma persona hace soporte en temporada y pruebas fuera de temporada. Eso te
ahorra un sueldo entero.

### Etapa 4 — 20 a 35 asociaciones · $125,000 a $200,000

| Quién | Costo cargado al año |
|---|---:|
| 1.5 programadores | $48,000 |
| 1.5 soporte | $20,000 |
| Ventas y viajes | $12,000 |
| Fijos, contadores, seguro, legal | $12,000 |
| | **~$92,000** |

Aquí el negocio se estaciona. Ya no hay a quién más venderle.

---

## 4. Seguros y datos de menores

> ⚠️ **Importante, pero NO confirmado.** No sabemos qué exige MACS. Todo lo de
> esta sección es lo que *suelen* pedir las instituciones gringas y lo que
> *suele* costar. Los números son órdenes de magnitud de mercado, no
> cotizaciones. **Hay que preguntárselo a Rierson en la llamada** y cotizar con
> un corredor antes de meterlo en ningún presupuesto.

### Qué seguros existen y cuáles aplican

| Seguro | Qué cubre | ¿Aplica? | Al año |
|---|---|---|---:|
| **Tech E&O** (errores y omisiones) | que el software se equivoque y el cliente pierda plata | **sí** | empaquetado abajo |
| **Cyber** (ciberseguridad) | filtración o pérdida de datos | **sí — el más importante** | $1,000 – $2,500 los dos juntos |
| **Responsabilidad civil general** | daños físicos o materiales | solo como requisito de contrato, y si viajas allá | $400 – $800 |
| Directivos (D&O) | demandas contra la junta | no, a esta escala | — |
| *Workers comp* gringo | accidentes de empleados en EE.UU. | **no** — no vas a tener empleados allá | — |
| **ARL en Colombia** | riesgos laborales | **sí, obligatorio** al contratar | va en el costo cargado |

**Total realista: $1,500 a $3,000 al año.** Tech E&O y Cyber casi siempre se
venden juntos en un solo producto; es lo estándar para un vendedor de software.

### Qué es el E&O, en concreto

Responde cuando **tu software se equivoca y el cliente pierde plata por eso**.

El ejemplo real de este negocio: el sistema siembra mal el cuadro, un equipo
queda en la división equivocada y MACS tiene que repetir la jornada de finales.
El arriendo de Mott, los árbitros, los viajes de los equipos — todo eso lo
perdieron por un error tuyo.

**Lo que de verdad cubre no es la indemnización: son los abogados.** Defenderse
de una demanda en EE.UU. cuesta más que casi cualquier arreglo.

---

### El seguro de ciberseguridad, en detalle

Es el que más importa aquí, y vale la pena entenderlo bien porque **el perfil de
riesgo de este producto es peor que el de un software normal**: guarda datos de
menores de edad, con nombres, colegios y fotos.

#### Lo que cubre de tu lado (*first-party*)

| Cobertura | Qué es |
|---|---|
| Investigación forense | averiguar qué pasó y por dónde entraron. Es lo primero y no es barato |
| **Notificación** | la ley te obliga a avisarle a cada persona afectada. En EE.UU. se cobra por cabeza |
| Monitoreo de crédito | hay que pagárselo a los afectados, típicamente un año |
| Abogado de crisis | el *breach coach* que dirige la respuesta |
| Comunicaciones y prensa | contener el daño de reputación |
| Lucro cesante | si el sistema queda caído y dejas de facturar |
| Restauración de datos | reconstruir lo que se corrompió o se perdió |
| Extorsión / ransomware | negociación y, a veces, el pago |

#### Lo que cubre del lado de terceros (*third-party*)

| Cobertura | Qué es |
|---|---|
| Demandas de los afectados | incluidas las colectivas, que es el riesgo grande con menores |
| Multas e investigaciones | de los fiscales generales de cada estado |
| Responsabilidad contractual | cuando el cliente te cobra a ti sus propios costos |
| Multas PCI | **aplica** si manejas taquilla digital con tarjetas |

#### Lo que NO cubre — y es donde la gente se estrella

- **Incidentes anteriores** a la póliza, o que ya conocías al contratarla.
- **Haber mentido en el formulario.** Si declaras que tienes doble factor de
  autenticación y no lo tienes, te niegan el siniestro. Esta es la causa número
  uno de reclamos rechazados.
- Multas que la ley de ciertos estados declara no asegurables.
- La pérdida de valor de tu propia propiedad intelectual.

#### Dos detalles que casi nadie sabe y sí importan

**1. Son pólizas *claims-made*.** Cubren la reclamación que se presenta mientras
la póliza está viva, no el incidente que ocurrió mientras estaba viva. En
cristiano: **si dejas de pagarla, pierdes la cobertura de todo el trabajo
pasado.** Para no perderla hay que comprar una extensión (*tail coverage*) al
cerrar. Es un compromiso de años, no un gasto anual suelto.

**2. La fecha retroactiva.** La póliza solo cubre incidentes posteriores a esa
fecha. **Hay que contratarla antes de tocar el primer dato de ellos**, no
después del piloto.

#### El regalo escondido: el formulario es tu lista de tareas

Para cotizar te van a preguntar cosas muy concretas. Esas preguntas **son
gratis y son exactamente el checklist de seguridad que deberías cumplir**:

- Doble factor de autenticación en todos los accesos administrativos
- Copias de respaldo cifradas, y **restauraciones probadas** (no basta con
  tenerlas: hay que haber probado que se pueden devolver)
- Cifrado en tránsito y en reposo
- Accesos por mínimo privilegio
- Un plan escrito de respuesta a incidentes
- Control de proveedores — Supabase y Vercel son subprocesadores tuyos
- Capacitación del equipo
- Ritmo de actualizaciones y parches

Aunque no compres la póliza todavía, **pide el formulario y respóndelo.** Te
dice dónde estás débil sin costarte un peso.

---

### Lo que puede adelantar la decisión de la LLC

Lo que MACS pediría no es "el seguro", sino un **certificado de seguro (COI)**
que los nombre como asegurado adicional, típicamente con límites de $1 millón
por evento y $2 millones agregados. Es el pedido institucional estándar.

**El problema: la mayoría de aseguradoras gringas no le emiten póliza a una
empresa sin domicilio en EE.UU.**

Si eso se confirma, **el seguro —no los impuestos— sería lo que obliga a abrir
la LLC antes del piloto de febrero.** Contradice lo que dice la sección 10 de
`asociaciones-cristianas-eeuu.md` ("esperar a tener dos o tres clientes"), y si
se confirma, manda esta sección.

**Pregunta textual para la llamada con Rierson:**

```
Does MACS require vendors to carry insurance or provide a certificate
of insurance? If so, what limits?
```

Su respuesta define el calendario. Aseguradoras que escriben empresas de
tecnología chicas: Coalition, At-Bay, Corvus, Hiscox, Vouch, Embroker.

---

### Aparte: los datos de menores, que es más serio que el seguro

Los torneos **Jr. High** son de 6º a 8º grado — chicos de **11 a 14 años**.

En EE.UU. hay una ley, **COPPA**, que regula la recolección de datos en línea de
menores de 13 años. Y el modelo de roles de la sección 4 de
`asociaciones-cristianas-eeuu.md` tiene al **jugador como usuario con cuenta
propia**. Si un chico de 12 abre cuenta, COPPA exige consentimiento verificable
de los padres, entre otras cosas.

**No es insalvable, pero es una decisión de diseño y sale mucho más barata ahora
que rehecha después.** La salida más simple:

> Los menores de 13 no tienen cuenta. Sus datos existen solo bajo la cuenta del
> colegio, y el expediente del jugador se les habilita al cumplir 13.

Hay que mirar también si los colegios te van a imponer **FERPA** por contrato.
Las escuelas cristianas privadas normalmente no reciben fondos federales, así
que FERPA no les aplica por ley — pero lo pueden pedir igual en el contrato.

⚠️ **Nada de esto está verificado con un abogado gringo.** Es un riesgo
identificado, no un dictamen.

---

## 5. Cuánto queda de verdad

Tomando el año 7, con 32 asociaciones:

| Línea | |
|---|---:|
| Ingreso | $192,000 |
| Costos operativos | –$92,000 |
| **Antes de tu sueldo** | **$100,000** |
| Tu sueldo | –$60,000 |
| **Utilidad de la empresa** | **~$40,000** |

**Margen: ~52% antes de tu sueldo, ~21% después.**

Ese 21% es un margen sano para una empresa de software chica. No es el 70% que
promete la gente de SaaS, porque este producto tiene **soporte humano intensivo
en temporada** y eso no se automatiza del todo.

Y esos $40,000 son **antes de impuestos**. Como ya está en la sección 10 de
`asociaciones-cristianas-eeuu.md`: Colombia te grava el ingreso mundial, la LLC
no cambia eso, y si la administras desde Colombia la DIAN puede tratarla como
residente fiscal colombiana.

---

## 6. Los tres riesgos de la proyección

**1. El techo llega rápido.** Año 7 y se acabó el mercado. Cualquier plan que
asuma crecimiento después de eso es fantasía, salvo que entres a otro mercado.

**2. La estacionalidad se te apila.** Todas las asociaciones gringas siguen el
mismo calendario escolar, así que sus picos coinciden. Vas a tener a todo el
equipo ahogado en octubre y ocioso en enero.

> **La mitigación es buena y ya la tienes:** las ligas amateur colombianas de
> Torneos Pro corren todo el año. El mismo equipo llena los valles gringos con
> trabajo colombiano. Los dos negocios se emparejan solos — es una razón real
> para no separarlos del todo.

**3. Dependes de una sola recomendación.** Todo el modelo asume que MACS queda
contento y habla bien de ti. Si el piloto de febrero sale mal, no pierdes un
cliente: pierdes el canal entero.

---

## 7. La conclusión honesta

Es un **buen negocio pequeño**, no una empresa que escale.

A siete años te deja un sueldo digno más unos $40,000 al año de utilidad, con un
equipo de tres o cuatro personas en Colombia. Eso es un resultado real y
respetable, y el arbitraje de costos —ingresos gringos, nómina colombiana— es lo
que lo hace posible.

Lo que **no** es: un negocio que puedas vender caro, ni uno que crezca solo, ni
uno que justifique levantar inversión.

**La decisión no es si los números cierran. Cierran.** La decisión es si quieres
pasar los próximos siete años construyendo un negocio con ese techo, o si ese
esfuerzo rinde más en otro lado.

---

## 8. Qué confirmar antes de creerle a este documento

- [ ] Cuántas escuelas tiene MACS de verdad (lo pregunta el correo de Rierson)
- [ ] Si las otras asociaciones estatales corren torneos como MACS o son solo
      gremios de acreditación — **si la mitad no hace deportes, el techo se
      parte por la mitad**
- [ ] Cuánto cobra realmente un contador gringo por el 5472
- [ ] **Si MACS exige certificado de seguro y con qué límites** — es lo que
      define si la LLC tiene que existir antes de febrero (sección 4)
- [ ] Cotizar Tech E&O + Cyber con un corredor, y pedir el formulario aunque no
      se compre todavía
- [ ] Si una aseguradora gringa te escribe póliza sin domicilio en EE.UU.
- [ ] **Consultar COPPA con un abogado gringo** antes de diseñar las cuentas de
      jugador, y si los colegios imponen FERPA por contrato
- [ ] Umbrales de precios de transferencia en Colombia y qué documentación
      disparan
- [ ] Si aplica la exención de IVA por exportación de servicios
- [ ] Si ACSI hace deportes y de qué tamaño — es la única vía para romper el
      techo de las 38
