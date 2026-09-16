# Reporte PDF de campaña para el anunciante

**Estado:** especificado, **no implementado**.
**Fecha:** 2026-08-17.
**Origen:** el panel de `/admin/publicidad` está bien para nosotros, pero no
hay nada que mandarle al negocio que pagó. Se necesita un PDF presentable, por
campaña, para enviar por WhatsApp o correo.

---

## La idea de fondo

> Un dueño de negocio no piensa en impresiones ni en CTR. Piensa en
> **"¿cuánta gente de mi pueblo vio mi nombre?"**.

Todo el documento se ordena alrededor de eso. El panel interno mide para
decidir; este PDF **cuenta una historia para que renueven**.

Por eso el titular no es *887 impresiones* sino:

> **343 personas de la región vieron tu marca**
> Cada una la vio 2,6 veces en promedio

---

## Los datos que ya tenemos

Todo sale de `get_ad_analytics(p_from, p_to)`, que ya devuelve `by_campaign`
con impresiones, clics y personas únicas. **No hace falta ninguna migración.**

Números reales de GuauHotDog al 2026-08-17 (7 días de campaña de 28), que
sirven de referencia para maquetar:

| Métrica | Valor |
|---|---|
| Impresiones | 887 |
| Personas distintas | 343 |
| Clics | 9 |
| CTR | 1,01% |
| Torneos donde apareció | 18 |
| Días activos | 7 |
| Precio del mes | $85.000 |

**Derivados que hay que calcular** (no vienen de la función):
- Veces por persona = impresiones ÷ personas → `2,6`
- Costo por persona = precio ÷ personas → `$248`

---

## ⚠️ Sobre el CTR: no está mal, y NO hay que esconderlo

El organizador temía que un CTR bajo se viera feo. Con los números en la mano,
**1,01% es un número decente para publicidad de display** — los banners en
internet suelen andar muy por debajo, del orden de una décima de punto.

Tiene explicación: el aviso no le sale a un desconocido en medio de una
noticia, le sale a alguien de Sincelejo mirando el torneo de su hijo. Es
público local y en contexto — que es justo la ventaja que hay que vender.

**Decisión: el CTR se muestra siempre.** Esconder un número que el cliente
puede preguntar deja peor parado que explicarlo. Cuando sea bajo de verdad, se
acompaña con la recomendación (ver abajo) — el problema no será el número sino
la imagen que subieron.

---

## Contenido del PDF

### 1. Portada / resumen
- Logo de Torneos Pro + nombre del negocio
- Período cubierto
- La frase grande: *"343 personas de la región vieron tu marca este mes"*

### 2. Los cuatro números

Con el nombre en lenguaje de cliente, no de analítica:

| Se muestra como | Es |
|---|---|
| **Personas alcanzadas** | personas únicas |
| **Veces que la vieron** | impresiones, o "2,6 veces cada persona" |
| **Interesados** | clics |
| **Presencia** | en cuántos torneos apareció |

> "9 clics" suena a poco. **"9 personas quisieron saber más de ti"** suena a
> algo. Es el mismo dato.

El de "veces por persona" es el que hoy no se está usando y más vale: en
publicidad una sola vista no construye nada, lo que deja recordación es la
repetición. Un volante en la calle no puede prometer eso.

### 3. Una gráfica sencilla

Vistas por día. **Nada más.** Sirve para señalar los picos y conectarlos con
algo que ellos entiendan: *"el sábado 15, día de la final, te vieron 120
personas"*.

### 4. Costo por persona

$85.000 ÷ 343 = **$248 por persona alcanzada**.

Es el argumento más fuerte para renovar: se compara solo contra un volante o
una cuña de radio.

### 5. Recomendación — la sección que más importa

Un consejo corto, tipo asesor, que cambia según los números:

| Condición | Texto |
|---|---|
| Muchas vistas, pocos clics | *"Tu marca se está viendo bien. Para que además te escriban, probá una imagen con un llamado claro: un precio, una promoción, o 'Escribinos al WhatsApp'."* |
| Clics buenos | *"Tu imagen está funcionando. Te sugerimos mantenerla y ampliar el alcance el próximo mes."* |
| Pocas vistas (campaña parcial) | *"Tu campaña arrancó a mitad de mes. Un mes completo te daría cerca del doble de alcance."* |

Esto posiciona a Torneos Pro como alguien que piensa en el resultado del
cliente, no como quien cobra y manda un Excel. **Es lo que hace que renueven.**

### 6. Frase de contexto

Al pie, una línea que vende la ventaja real frente a Facebook:

> *"Tu aviso se mostró junto a torneos de fútbol, voleibol, béisbol y softbol
> en Sucre, a personas que siguen a sus equipos varias veces por semana."*

---

## Qué NO va en el PDF

| Fuera | Por qué |
|---|---|
| La lista de torneos | Al dueño del restaurante no le importan los nombres. El número "18 torneos" sí; la lista no. |
| El reparto con organizadores | Es el negocio interno. Si ve que la mitad se va a otro lado, empieza a negociar el precio. |
| Personas-día y su matemática | Es nuestra, no de él. |
| Comparaciones con otros anunciantes | Nunca. |

---

## Cuándo se manda

**Al cerrar el mes de campaña, no antes.**

GuauHotDog lleva 7 días de 28: mandarlo hoy muestra números flacos y quema el
efecto. El cierre de mes es además el momento natural para hablar de renovar.

---

## Notas de implementación

- **Ya existe la plomería de PDF**: `downloadStatsPdf` usa `jspdf` con import
  dinámico (ver `src/components/standings/tournament-stats.tsx`). El mismo
  patrón sirve acá, no hay que meter una librería nueva.
- Botón **"Descargar reporte"** por campaña dentro de `/admin/publicidad`.
- El período debería poder elegirse; por defecto, el mes de la campaña.

## Pendiente de decidir

- ¿El PDF lleva la imagen del aviso? Ayuda a que el cliente se reconozca, pero
  hay que ver cómo queda en la maqueta.
- ¿Comparación contra el mes anterior? Todavía no hay historia suficiente
  (GuauHotDog es el primer anunciante que paga). Vale la pena dejar el espacio
  previsto para cuando la haya.
