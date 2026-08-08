/**
 * Términos del programa de monetización con organizadores.
 *
 * ⚠️ BORRADOR. Redactado el 2026-08-08 a partir de cómo funciona el reparto de
 * verdad, pero NO revisado por un abogado. Hay plata y datos personales de por
 * medio: antes de desplegarlo tiene que leerlo el dueño y, para el punto de
 * impuestos y retenciones, un contador.
 *
 * Dos números están puestos como propuesta y hay que confirmarlos (buscar
 * "DECIDIR" más abajo): el mínimo para transferir y el plazo de pago.
 *
 * ---------------------------------------------------------------------------
 * SI SE CAMBIA EL TEXTO, HAY QUE SUBIR LA VERSIÓN.
 *
 * `MONETIZAR_TERMS_VERSION` es lo que se guarda en
 * `organizer_payout_info.terms_version`. La app compara lo guardado contra esta
 * constante: si no coinciden, le vuelve a pedir que acepte. Cambiar el texto sin
 * subir la versión deja a todos aceptando unas condiciones que ya no existen, y
 * sin manera de saber quién vio cuáles.
 *
 * Un cambio de redacción que no altere ninguna regla puede quedarse en la misma
 * versión. Cualquier cambio a lo que se paga, cuándo se paga o qué se exige, no.
 */
export const MONETIZAR_TERMS_VERSION = "2026-08-v2";

export interface TermsSection {
  title: string;
  body: string[];
}

export const MONETIZAR_TERMS: TermsSection[] = [
  {
    title: "Qué es este programa",
    body: [
      "Torneos Pro vende espacios de publicidad a negocios que se muestran a la gente que consulta los torneos. Cuando esos avisos aparecen en tus torneos, vos ganás una parte de lo que pagó el anunciante.",
      "No tenés que hacer nada especial ni vender nada: la audiencia se cuenta sola cuando la gente entra a ver tus torneos.",
    ],
  },
  {
    title: "Cómo se calcula lo que ganás",
    body: [
      "La mitad de lo que paga cada campaña se reparte entre TODOS los organizadores en cuyos torneos se mostró, en proporción a la audiencia que puso cada uno. La otra mitad es de Torneos Pro.",
      "Para que quede claro: no es que la mitad sea para vos. Es la mitad repartida entre todos los que aportaron público a esa campaña, y tu parte depende de cuánto pusiste vos.",
      "El reparto se hace por audiencia, contada en personas por día: si la misma persona ve el aviso tres veces el mismo día, cuenta una sola vez. Así, lo que se premia es traer gente, no traer recargas de página.",
      "Cada campaña reparte solo su propia plata, y solo entre quienes le aportaron audiencia a ella. Una campaña que solo se muestra en torneos de Montería no le paga a un organizador de otra ciudad.",
      "En tu pantalla vas a ver cuánto paga cada campaña por persona y cuántas personas pusiste vos. Multiplicá y te da lo tuyo.",
    ],
  },
  {
    title: "Campañas que no pagan",
    body: [
      "A veces mostramos campañas sin ánimo de lucro: causas sociales, campañas de salud, avisos de la comunidad o de la misma plataforma. Esas no las cobramos, así que no generan pago para nadie.",
      "No te quitan nada de lo que ganás con las campañas que sí pagan. Cada campaña reparte únicamente su propia plata entre quienes le aportaron audiencia a ella, así que una campaña sin cobro no entra en la cuenta de las otras.",
      "En tu pantalla vas a ver estas campañas marcadas, para que sepas por qué aparecen con cero y no las confundas con un anunciante que todavía no ha pagado.",
    ],
  },
  {
    title: "Durante el mes ves audiencia, no plata",
    body: [
      "Mientras el mes corre te mostramos cuánta gente vio cada aviso en tus torneos, no un monto.",
      "No es por reservarnos nada: es que el monto todavía no existe. Lo que paga cada campaña se reparte entre todos los organizadores donde se mostró, así que hasta que el mes no termine, cualquier cifra cambiaría sola — si otro organizador suma audiencia a la misma campaña, la parte de cada uno baja.",
      "Cuando el mes termina se calcula, se congela y te lo mostramos en Histórico. Ese número ya no cambia más, y es el que se te paga.",
    ],
  },
  {
    title: "Tenemos que aprobar tus datos antes de pagarte",
    body: [
      "Cuando te inscribís, tus datos de pago quedan en revisión. Hasta que no los aprobemos no te podemos consignar.",
      "Mientras tanto tu audiencia se sigue contando normalmente: no perdés nada de lo que generes en ese tiempo.",
      "Si hay algo que corregir te decimos qué es. Y si más adelante cambiás tu cuenta bancaria, esos datos nuevos vuelven a revisión — lo que aprobamos fue esa cuenta, no cualquier cuenta futura.",
    ],
  },
  {
    title: "Qué tenés que cumplir",
    body: [
      "Para que un mes se te liquide tenés que cumplir unos mínimos de actividad y audiencia, que vas a ver en tu pantalla con tu progreso.",
      "Se miden mes a mes y arrancan de cero cada mes. Cumplir en agosto no te asegura septiembre.",
      "Los mínimos pueden ajustarse. Si cambian, te avisamos antes de que empiece el mes en el que aplican, nunca a mitad de camino.",
      "Si un mes no clasificás, la parte que le habría correspondido a tu audiencia queda con Torneos Pro. No se reparte entre los demás organizadores.",
    ],
  },
  {
    title: "Cuándo y cómo se te paga",
    body: [
      // DECIDIR: plazo. 15 días da margen para revisar los cortes sin que el
      // organizador sienta que se le dilata.
      "Después de que termina el mes se cierra el corte y se te transfiere dentro de los primeros 15 días del mes siguiente, a la cuenta que registraste.",
      // DECIDIR: mínimo. Sin mínimo, una transferencia puede costar más que el
      // monto transferido.
      "Si tu corte del mes es menor a $50.000, no se transfiere ese mes: se acumula y se paga junto con el siguiente que sí llegue al mínimo.",
      "La plata se transfiere únicamente a la cuenta bancaria que vos registrás, y tiene que estar a tu nombre o al de tu organización. No se hacen pagos a cuentas de terceros.",
      "Mantené tus datos al día. Si la transferencia se devuelve porque la cuenta está mal o cerrada, el monto queda pendiente hasta que corrijas los datos.",
    ],
  },
  {
    title: "Tus datos",
    body: [
      "Para poder pagarte necesitamos tu nombre completo, tu documento y tu cuenta bancaria. Los usamos únicamente para hacerte la transferencia y para cumplir las obligaciones contables y tributarias que nos correspondan.",
      "No los compartimos con los anunciantes ni con otros organizadores.",
      "Podés consultarlos, corregirlos o pedir que los eliminemos cuando quieras. Si los eliminás, no podemos seguir pagándote hasta que los cargues de nuevo.",
    ],
  },
  {
    title: "Impuestos",
    body: [
      "Lo que recibís es un ingreso tuyo y sos vos quien responde por los impuestos que le correspondan según tu situación.",
      "Si por ley tenemos que practicar alguna retención sobre el pago, la aplicamos y te la informamos junto con el corte.",
    ],
  },
  {
    title: "Qué puede dejarte por fuera",
    body: [
      "Inflar la audiencia de forma artificial: recargar tus propios torneos, pedirle a gente que entre solo para sumar, usar programas automáticos, o cualquier otra maniobra para aparentar más público del real.",
      "Cargar torneos, equipos o resultados falsos.",
      "Si detectamos algo así, se anula el corte del mes y podemos sacarte del programa. La cuenta de torneos sigue funcionando normal: lo que se pierde es la monetización.",
      "Antes de anular nada te escribimos y te damos la oportunidad de explicar.",
    ],
  },
  {
    title: "Cambios y cierre del programa",
    body: [
      "Este programa es nuevo y puede cambiar. Si cambian las condiciones te vamos a pedir que aceptes la versión nueva antes de seguir.",
      "Si en algún momento cerramos el programa, te pagamos lo que hayas ganado hasta ese momento.",
      "Podés salirte cuando quieras. Los avisos dejan de repartirte y tus torneos siguen funcionando igual.",
    ],
  },
];
