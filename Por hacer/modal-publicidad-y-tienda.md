# Plan: modal de publicidad configurable + tienda contextual (torneospro.co)

**Estado:** idea / planeación. No implementado todavía.
**Última actualización:** 2026-07-03

---

## ✅ MODELO VALIDADO (2026-07-03) — fuente de verdad actual

> Esta sección es la decisión vigente y afina/reemplaza las exploraciones de
> más abajo (que se conservan como contexto histórico). Hay DOS piezas de
> monetización publicitaria que funcionan por separado y NO se pisan: los
> 6 espacios de patrocinador del torneo, y el modal de publicidad al
> espectador.

### Pieza 1 — Los 6 espacios de patrocinador (se le venden al ORGANIZADOR)

Cada torneo tiene **6 espacios** para logos de patrocinador en la vista
pública. Lo que el organizador decide en el **modal de pago (checkout)** al
crear/pagar el torneo determina cuántos controla:

| En el checkout elige… | Espacios para SUS patrocinadores | El resto se llena con |
|---|---|---|
| **Pagar 100%** (torneo completo) | 6 | — |
| **Pagar 50%** | 3 | imagen de TorneosPro (3) |
| **Gratis** (no paga nada) | 0 | imagen de TorneosPro (6) |

**Regla base:** los espacios que el organizador no paga los ocupa el logo /
imagen de **TorneosPro** (nunca un tercero). Esto elimina el riesgo de meterle
al organizador la competencia directa de su patrocinador, y convierte cada
torneo gratis en marketing de la plataforma.

**Upsell posterior (comprar espacios que faltan):**
- Solo aplica si eligió 50% o gratis.
- Se compran **de 3 en 3** (mínimo un paquete de 3).
- Cuesta **ligeramente más caro** que haber pagado el torneo completo desde el
  inicio → premio por pagar full de una, recargo por decidirlo tarde.

**Por qué funciona:**
- Cero fricción con el organizador (sus espacios libres = tu marca, no un
  competidor de su sponsor).
- Marketing gratis: torneo gratis popular = más gente ve "hecho con
  TorneosPro".
- Pitch de pago obvio: "recuperas esos espacios para tus patrocinadores
  cuando pagas".

### Pieza 2 — El modal de publicidad (audiencia = espectadores)

Independiente del pago del torneo. Sale para **todos los espectadores** pague
o no el organizador (ellos consumen gratis → su atención es el activo a
monetizar).

- **Configurado manualmente por el admin (nosotros)**: subimos las imágenes,
  definimos la rotación y dónde aparece. No es automático ni licitado (por
  ahora).
- Aparece en la **primera carga** de la página.
- Se puede **cerrar después de 2 segundos**.
- **Rota entre varias imágenes** (varios anunciantes o varias piezas).
- **Nunca en el flujo crítico** (marcador en vivo, abrir un partido).
- **Conteo de impresiones y clics desde el día 1** (sin números no se le puede
  cobrar a ningún anunciante).
- Monetización: **mensual** al anunciante.

### Cómo se conectan

- **Espacios (Pieza 1):** ingreso del **organizador**, atado al torneo, según
  pague 100/50/0; lo no pagado trabaja como marketing de TorneosPro.
- **Modal (Pieza 2):** ingreso de **anunciantes externos**, mensual, sobre la
  audiencia total, medido con clics/impresiones, administrado a mano.

### Visión futura (NO ahora)

- Cuentas de empresa + **licitación** por espacios libres o por el modal de un
  torneo. Es el negocio grande, pero se construye solo cuando empresas reales
  pregunten "¿cómo entro a ese espacio?".
- La **tienda a pedido** (trofeos, medallas, carnets) sigue viva pero es otra
  fase.

### Puntos finos pendientes de decidir

- [ ] Precio de los paquetes (50% / full) y del modal mensual. ¿El precio del
      torneo depende del tamaño (# equipos) o es fijo?
- [ ] Cuánto más caro es comprar espacios después vs pagar full de entrada.
- [ ] Repetición del modal: ¿en cada refresh, o tope por sesión / cada X horas
      por dispositivo para no cansar a la audiencia?
- [ ] Rotación del modal: ¿aleatoria pura o ponderada por lo que paga cada
      anunciante?

---

## 🛠️ Cómo construir el modal — panel admin + targeting (borrador 2026-07-03)

> Borrador de lo que hay que construir para el modal de la Pieza 2. NO es
> `sponsors` (esos son los 6 espacios del organizador). El modal es un
> inventario 100% nuestro: anunciantes externos, facturación mensual,
> administrado a mano por el super admin. Los organizadores no ven nada de
> esto.

### Lo que YA existe y se reutiliza (no hay que crearlo)

- **`analytics_events`** ya está lista para contar: soporta `event_type` +
  `target_id` + `tournament_id` con inserción anónima y lectura restringida a
  dueño/admin. El modal emite `ad_impression` y `ad_click` (target_id =
  campaña). El contador es el BLOQUEANTE real: sin él no se le puede cobrar ni
  renovar a nadie.
- **`tournaments`** ya trae todo para segmentar: `sport` (enum, incluye
  `softball`), `status` (`in-progress` = activo), `scope` (nacional /
  departamental / municipal), `department`, `municipality`, `plan`.
- Rol `admin` (super admin) para el panel.

### Modelo de datos nuevo (a crear)

```
ad_campaigns
  id
  advertiser_name        -- "Ferretería El Tornillo"
  contact                -- WhatsApp / IG / web (para renovación)
  image_url              -- pieza del modal
  link_url               -- destino del clic
  is_active              -- prender/apagar sin borrar
  starts_at / ends_at    -- vigencia del mes pagado
  monthly_price          -- COP
  weight                 -- rotación ponderada (nivel o monto; ver abajo)
  target_mode            -- 'rule' | 'list'
  -- si mode='rule':
  target_sports          -- sport[]   (vacío = cualquier deporte)
  target_status          -- text[]    (default {in-progress})
  target_scopes          -- text[]    (nacional/departamental/municipal)
  target_departments     -- text[]    (vacío = cualquiera)
  target_municipalities  -- text[]    (vacío = cualquiera)

ad_campaign_tournaments  -- si mode='list': torneos elegidos a mano
  campaign_id
  tournament_id
```

### Targeting — dos modos (cubren los dos casos que quiero)

- **Por regla** (dinámico: torneos futuros que cumplan entran solos):
  deporte + estado + geografía. Ej: "softbol activo en Sucre".
- **Torneos específicos** (lista a mano, sin importar deporte): se eligen
  torneos puntuales.

**Filtro geográfico (jerárquico, de general a específico):**

| Criterio | Campo | Nota |
|---|---|---|
| Alcance | `scope` | nacional / departamental / municipal |
| Departamento | `department` | acota dentro del depto |
| Municipio | `municipality` | acota dentro del municipio |

Regla: **vacío = no filtra por eso**. Un anunciante nacional deja la geo
vacía; uno de barrio la aprieta hasta el municipio. Ojo: los torneos
**nacionales** normalmente no tienen depto/municipio → un filtro por "Sucre"
no debe traerlos (correcto: el negocio local no quiere pagar audiencia de
todo el país).

El mismo filtro geográfico sirve DOBLE: (1) define la regla, o (2) ayuda a
**encontrar** torneos en el buscador cuando armas la lista manual.

⚠️ Depende de que `department`/`municipality`/`scope` estén BIEN LLENOS en los
torneos. Si el crear-torneo los deja vacíos, no aparecen en el filtro
geográfico → conviene empujar (u obligar) la ubicación al crear el torneo.

### Rotación ponderada (share of voice)

La probabilidad de que una campaña salga = su peso sobre el total de pesos de
las campañas que aplican a ese torneo. Ej: 100k+50k+50k → 50% / 25% / 25%.

- Pendiente: peso = **monto directo** vs **niveles** (Bronce/Plata/Oro).
  Niveles es más limpio comercialmente (no expone el precio exacto).
- Considerar **piso mínimo** para que el que paga poco no "desaparezca" en
  torneos de baja audiencia.
- **Exclusividad** = escalón premium (un solo anunciante, 100% del modal en
  ese torneo, sin rotación). Vale más que un share parcial.

### Resolución al cargar un torneo T (pseudo)

Campañas activas y vigentes donde: `target_mode='list'` y T está en la lista,
**o** `target_mode='rule'` y T cumple deporte + estado + alcance + depto +
municipio (cada filtro vacío = comodín). El pool resultante entra a la
rotación ponderada; se elige una imagen y se registra `ad_impression`.

### Panel de super admin — sección "Publicidad"

1. **Anunciantes** — libreta de clientes (nombre, contacto, historial de
   campañas, quién debe renovar).
2. **Campañas** — crear/editar (imagen, link, targeting regla/lista, peso,
   vigencia, precio, pagado, activa/pausada) + lista con pulso en vivo
   (impresiones/clics del mes, aviso de "vence pronto").
3. **Inventario por torneo** — vista inversa: qué torneos tienen campañas, con
   qué ocupación (share de cada anunciante), dónde hay hueco para vender y
   dónde ofrecer exclusividad. Clave porque la audiencia está concentrada en
   1–2 torneos.
4. **Reportes** — por anunciante, mensual, idealmente imagen para WhatsApp:
   "apareció en X, N impresiones, M clics". Es lo que justifica renovar.

### Ciclo operativo (todo manual por ahora)

1. Cierras al emprendedor → lo agregas como **anunciante**.
2. Creas su **campaña** (imagen, target, peso, vigencia, marcas "pagado").
3. La campaña entra al **pool** de sus torneos; el modal la rota por peso.
4. Cada impresión/clic → `analytics_events`.
5. Revisas la lista para ver rendimiento y vencimientos.
6. Antes del vencimiento → mandas el **reporte** → renueva o se pausa al llegar
   la fecha.

### Mínimo para vender el primer anuncio (MVP)

Campañas + targeting (regla/lista + geo) + rotación por peso + **contador de
impresiones/clics**. Los reportes bonitos y la vista de inventario se pueden
hacer a mano después, sin bloquear la primera venta.

### Cómo cobrar (recordatorio de estrategia)

Tarifa **plana mensual por torneo/tier**, NUNCA CPM (a este volumen el CPM da
miseria). Precio anclado a lo que el emprendedor ya gasta en publicidad local.
Arrancar barato con el torneo estrella para fabricar un caso de éxito medible
(el reporte de clics es lo que sube el precio del siguiente).

---

## Contexto

Hoy poner patrocinadores es **gratis** dentro del producto. Cada torneo
tiene sus propios `Sponsor[]` (imagen + linkUrl) y se combinan con los de
la organización. Ya hay tracking de vistas de página (`page_views`), pero
NO hay métricas por patrocinador (clics/impresiones) ni imágenes
compartibles con el logo incrustado.

La idea nace de querer monetizar ese espacio y, más adelante, vender
productos deportivos.

## La idea (dos partes — distinta viabilidad)

### Parte 1 — Modal de publicidad controlado por admin (VIABLE ✅)

Un modal/banner tipo publicidad que **nosotros (admin)** configuramos:
- Elegir a discreción en qué torneos y/o perfiles de entrenador aparece.
- Imagen + redirección a un link (propio o de un comercio).
- Contar clics e impresiones (medir demanda real).

Usos:
- Promocionar nuestra propia tienda.
- Vender el espacio a un comercio local (monetización directa).
- **Validar demanda ANTES de invertir en inventario.**

Riesgo: UX. Usuarios usan plan gratis y hay competidores gratis. Que el
modal sea **ocasional, relevante y fácil de cerrar**. NUNCA en el flujo
crítico (cargar resultado, ver tabla).

### Parte 2 — Tienda de productos deportivos (torneospro.co)

Visión del usuario: tienda tipo MercadoLibre pero más barata, vendiendo
nosotros mismos.

**Veredicto honesto:** como "tienda genérica más barata que MercadoLibre
vendiendo nosotros" → casi inviable (~5-10%). No podemos ser más baratos
(ellos compran a volumen + logística subsidiada), el margen de retail es
5-15% vs 80%+ del software, y cargar inventario es otra empresa distinta.

**Versión afilada que SÍ tiene ventaja defendible:** vender lo que el
torneo necesita, en el momento exacto de necesidad — porque sabemos quién
organiza un torneo y cuándo:
- Trofeos, medallas, placas (al crear torneo / cerca de la final).
- Uniformes personalizados con número y nombre (al registrar equipos).
- Balones, petos, redes, conos (al armar el torneo).

MercadoLibre NO está optimizado para esto (personalización, lote por
torneo).

**Regla de oro: NO cargar inventario al principio.**
- Hecho a pedido (made-to-order): fabricar cuando ya compraron.
- O comisión/lead a proveedor local vía el modal.

## Secuencia para no quemar plata

1. Construir el modal configurable (admin: dónde aparece, link, conteo de
   clics/impresiones).
2. Apuntar a un Google Form / WhatsApp ("¿Necesitas medallas y trofeos?").
3. Medir clics e intención real. Si nadie hace clic → nos ahorramos la
   tienda.
4. Vender a pedido con un proveedor, sin inventario. Quedarnos el margen.
5. Solo cuando un producto se venda solo y repetido → considerar stock de
   ESE producto.

## Pendiente de construir (cuando se priorice)

- [ ] Modal/banner configurable desde admin (target: torneos y perfiles).
- [ ] Conteo de clics e impresiones por anuncio.
- [ ] Panel admin para crear/activar/desactivar campañas.
- [ ] (Después) flujo de cotización a pedido / proveedor.

## Qué productos venderle a organizadores de torneos

Filtro: lo necesita sí o sí para correr el torneo + se personaliza (no
compite con MercadoLibre) + se hace a pedido (sin inventario) + se repite
cada torneo. Ventaja real = momento + data (la app sabe nombre del torneo,
campeón, fechas, equipos, jugadores).

**Nivel 1 (empezar aquí):**
1. Premiación personalizada (trofeos, medallas, placas) — compra emocional,
   se personaliza con nombre/año/logo, a pedido. La app ya tiene nombre del
   torneo, campeón y hasta foto del campeón → ofrecer cerca de la final.
2. Carnets / escarapelas de jugadores (con foto + QR) — resuelve dolor real
   (refuerzos ilegales), la app ya tiene equipos/jugadores/fotos. Nadie de
   la competencia lo tiene. Bajo costo, alto valor percibido.
3. Pancartas / banners impresos para la cancha — print-on-demand, y es
   donde van los patrocinadores (se conecta con la monetización de ads).

**Nivel 2 (después):**
4. Uniformes personalizados — NO fabricar; ser canal/agregador con taller
   local, cobrar comisión/margen.
5. Implementos consumibles (bolas, bases, redes, conos) — softbol/béisbol
   en Sucre; el organizador los re-compra. Margen menor pero recurrente.

**NO vender:** hidratación/neveras/carpas/sillas (commodity, margen mínimo)
ni productos genéricos sin personalizar (se pierde contra MercadoLibre).

Arranque recomendado: trofeos/medallas + carnets de jugadores (mejor margen,
más atados a la data, validables con un solo formulario).

## Importar de China (cambia el margen, NO la secuencia)

Importar saca del modelo "a pedido, sin inventario" y mete en "comprar stock
por adelantado y aguantarlo" → capital congelado, lead time, aduana, riesgo
de stock sin vender. China gana en lo estándar/commodity; pierde en lo
personalizado.

**Jugada ganadora: importar el "blanco" barato de China + personalizar
local** (grabado/sticker/cinta/sublimado). China da el costo bajo; el taller
local da el margen + la ventaja que MercadoLibre no puede + venta "en el
momento".

**Qué SÍ importar:**
- Medallas — la #1: baratas, livianas (flete barato), no se vencen, demanda
  universal, markup enorme. Importar genérica + personalizar local.
- Insumos de credenciales (lanyards + porta-carnets) — centavos en China.
- Partes de trofeos (copas, figuras, bases) — ensamblar + placa local; ojo
  volumen = flete más caro.
- Consumibles (bolas, conos, silbatos, bases) — cuidado calidad.

**Qué NO importar:** uniformes (tallas/variantes = pesadilla de inventario),
nada perecedero o con variantes que deje stock muerto.

**Costos reales (Colombia):** MOQ 500–1.000 uds frecuente; lead time 30–60
días por barco (hay que pronosticar); aduana = IVA 19% + arancel ~5–15% +
agente + flete → un ítem de USD 1 aterriza en ~USD 2–2.5; capital congelado;
curva de aprendizaje de importar.

**Gatillo:** solo paga a volumen. Con 5 torneos, compra local. Con la app
agregando demanda de 50–100 torneos, importar medallas/lanyards rinde mucho.
El volumen de torneos habilita esto (misma regla que la tienda).

**Primer paso concreto:** importar UN solo SKU (medallas) para aprender todo
el pipeline con bajo riesgo (aunque sobren, no se vencen). Luego escalar.

## Monetizar a los espectadores de estadísticas

La audiencia que ve stats (jugadores, familias, amigos) es el activo más
valioso y hoy desaprovechado. Regla de oro: **casi nunca cobrarle al
espectador directo** (el amateur no paga por ver la tabla; hay competidores
gratis). Se monetiza su ATENCIÓN, no su bolsillo.

1. **Publicidad contextual (lo más viable):** el espectador es la audiencia
   que se le vende al patrocinador/comercio. Más vistas = más se cobra por
   el espacio. Conecta con el banner de sponsor + el modal de ads + la
   tienda (al papá que ve a su hijo en la tabla se le vende foto/credencial/
   trofeo). Métrica de venta: "estas stats las vieron X personas".
2. **Premium para el fan duro (secundario):** notificaciones, stats
   históricas del jugador, card descargable, quitar anuncios. Paga poco al
   inicio pero es el más fiel.
3. **El espectador como motor de crecimiento:** cada quien que comparte la
   tabla por WhatsApp trae organizadores nuevos. Cada pieza debe llevar
   marca + "Crea tu torneo gratis → torneospro.co". No es plata directa,
   pero vale más que cobrarle.

Orden: (1) medir → (2) vender la audiencia al patrocinador → (3) vender
productos al espectador en el momento → (4) premium/quitar ads (extra).
NUNCA poner las stats detrás de un muro de pago (mata audiencia + crecimiento).

## Modelo de cobro de sponsors + quién captura el valor

**Problema central:** hoy el sponsor se pone GRATIS. El organizador le cobra
~$300k a su comercio local y torneospro recibe $0. Le estamos dando gratis
la herramienta con la que él gana. Hay que capturar nuestra parte.

**Cómo capturar (3 caminos):**
1. Cobrarle al ORGANIZADOR por la herramienta (lo más realista): no por
   poner el logo, sino por lo que le ayuda a ganar/demostrar — métricas
   (clics/vistas del sponsor), reporte para el comercio, imagen con logo
   para WhatsApp, posición premium, más cupos. Va en el plan de pago.
   Pitch: "plan Pro vale $X; un solo sponsor te paga $300k, lo recuperas
   con el primero".
2. Comisión sobre el patrocinio — NO funciona hoy (el comercio paga en
   efectivo, por fuera de la plataforma; no se puede cobrar).
3. Tú vendes la publicidad directo (futuro, con volumen): a marcas
   regionales que quieren estar en 50–100 torneos a la vez. Solo lo puede
   vender la plataforma → se queda el dinero y le da tajada al organizador.
   Ahí está el negocio grande.

**Precio del sponsor: atarlo al TAMAÑO del torneo (# equipos), NO a las
vistas.** El # de equipos se sabe desde el inicio, es predecible, y ya se
cobran los planes por eso. Torneo grande = más equipos = más audiencia =
tier más alto = sponsor más caro → te beneficias de la popularidad sin
medir vistas ni pelear con el organizador. La parte de popularidad que el
fijo no captura, la capturas TÚ con el modal de ads + tienda (esos escalan
solos con las vistas).

**Referencia de precio (para el ORGANIZADOR, no para torneospro):** torneo
municipal con ~4.000 vistas → $200k–$400k por sponsor (mención simple
$150k; oficial $300k–$400k; exclusivo $500k+). No vender por vista (CPM puro
de 4.000 vistas ≈ $50k, miseria); vender como paquete usando las vistas como
argumento. El negocio del organizador son 3–4 sponsors por torneo →
$800k–$1.2M por torneo.

## Modal de ads sin molestar: gratis lo carga, pagar lo quita

Riesgos de meter un modal de publicidad propio:
1. Pisar el sponsor que el organizador ya vendió (mostrar competencia
   directa) → se enfurece. Riesgo #1.
2. Abaratar el torneo con un anuncio feo/irrelevante.
3. Que se vaya a un competidor gratis.

**Solución elegante (resuelve todo):**
- 🆓 Torneo GRATIS → lleva el modal de publicidad de torneospro (monetizamos
  la audiencia directo).
- 💳 Torneo de PAGO → SIN ads de torneospro; el organizador controla todo el
  espacio de sponsors.

Pagar es lo que quita los ads. Alinea incentivos (el que no paga carga
nuestros ads; el que paga recupera el espacio para sus sponsors), cero
molestia al que paga, y la popularidad nos beneficia (torneo gratis popular
= más impresiones en nuestro modal).

Reglas: modal en la VISTA PÚBLICA (espectadores), NO en el panel del
organizador; nunca mostrar la competencia directa del sponsor ya vendido;
relevante, local, fácil de cerrar.

## Relacionado

- Monetización de patrocinadores (click tracking + reporte + imagen
  compartible con logo para WhatsApp) — discutido junto con esta idea.
