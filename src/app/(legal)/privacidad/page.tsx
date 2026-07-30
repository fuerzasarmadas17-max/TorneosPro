import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad | TorneosPro",
  description:
    "Cómo TorneosPro recolecta, usa y protege tu información, en cumplimiento de la Ley 1581 de 2012.",
};

export default function PrivacidadPage() {
  return (
    <>
      <h1>Política de Privacidad</h1>
      <p className="!text-muted-foreground text-sm">Última actualización: 30 de julio de 2026</p>

      <p>
        Esta Política de Privacidad explica, en lenguaje claro, qué información
        recolecta TorneosPro (torneospro.co), cómo la usa y qué opciones tenés. Para
        el detalle legal del tratamiento de datos personales bajo la Ley 1581 de
        2012, consultá la{" "}
        <Link href="/tratamiento-de-datos">Política de Tratamiento de Datos Personales</Link>.
      </p>
      <p>
        Responsable: Joshua David Samur Rojas, persona natural, cédula No.
        1.102.873.861, Sincelejo, Sucre, Colombia. Contacto:{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>.
      </p>

      <h2>1. Qué información recolectamos</h2>

      <h3>1.1. Que nos das directamente (como organizador)</h3>
      <ul>
        <li>
          <strong>Cuenta:</strong> nombre, correo electrónico y contraseña (la
          contraseña se almacena cifrada; no la vemos).
        </li>
        <li>
          <strong>Perfil de organización:</strong> nombre de la organización,
          descripción, logo, ubicación, enlaces a redes y patrocinadores.
        </li>
        <li>
          <strong>Pagos:</strong> cuando comprás un plan, el pago se procesa a través
          de la pasarela externa <strong>Wompi</strong>. No almacenamos los datos de
          tu tarjeta; los maneja la pasarela.
        </li>
      </ul>

      <h3>1.2. Datos de jugadores que vos cargás</h3>
      <p>
        Como organizador, podés cargar datos de jugadores: <strong>nombre, número de
        documento, EPS y fecha de nacimiento/edad</strong>.
      </p>
      <p>
        Sobre estos datos, <strong>vos sos el Responsable</strong> y{" "}
        <strong>TorneosPro es solo el Encargado</strong>: los guardamos y mostramos
        por tu instrucción, para que tu torneo funcione. <strong>Vos sos responsable
        de haber obtenido la autorización</strong> de cada jugador (o de sus padres,
        si es menor) antes de cargarlos. Ver la sección 3 de la{" "}
        <Link href="/tratamiento-de-datos">Política de Tratamiento de Datos</Link>.
      </p>

      <h3>1.3. Que se recolecta automáticamente</h3>
      <ul>
        <li>
          <strong>Uso de la aplicación:</strong> eventos básicos de navegación y
          métricas anónimas (por ejemplo, visualizaciones de anuncios), que no
          identifican a la persona.
        </li>
        <li>
          <strong>Datos técnicos:</strong> los propios del funcionamiento web (tipo
          de dispositivo, navegador) manejados por nuestros proveedores de hosting.
        </li>
      </ul>

      <h2>2. Para qué la usamos</h2>
      <ul>
        <li>Crear y administrar tu cuenta y prestarte el servicio.</li>
        <li>Mostrar los torneos, resultados y estadísticas.</li>
        <li>Mostrar tu perfil público <strong>solo si lo configurás como público</strong>.</li>
        <li>Procesar pagos de planes.</li>
        <li>
          Enviarte comunicaciones sobre el servicio (por ejemplo, recuperación de
          contraseña o avisos operativos).
        </li>
        <li>Cumplir obligaciones legales y proteger la seguridad de la plataforma.</li>
      </ul>
      <p>
        <strong>No vendemos tus datos personales.</strong> La publicidad que
        mostramos a los espectadores se selecciona por características del torneo, no
        por perfiles personales de los visitantes.
      </p>

      <h2>3. Con quién la compartimos</h2>
      <p>
        Solo con proveedores que nos ayudan a operar, que actúan como Encargados y
        solo tratan los datos para prestarnos su servicio:
      </p>
      <ul>
        <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento.</li>
        <li><strong>Vercel</strong> — alojamiento de la aplicación.</li>
        <li><strong>Wompi</strong> — procesamiento de pagos.</li>
      </ul>
      <p>
        Algunos de estos proveedores operan servidores fuera de Colombia; ver la
        sección 9 de la{" "}
        <Link href="/tratamiento-de-datos">Política de Tratamiento de Datos</Link>.
      </p>

      <h2>4. Menores de edad</h2>
      <p>
        TorneosPro no está dirigida a que menores creen cuentas. Sin embargo, los
        organizadores pueden inscribir menores en sus torneos. En ese caso,{" "}
        <strong>el organizador debe contar con la autorización del representante
        legal</strong> del menor. Tratamos estos datos únicamente como Encargado y con
        medidas de seguridad reforzadas.
      </p>

      <h2>5. Datos sensibles (EPS)</h2>
      <p>
        El campo de EPS es <strong>opcional</strong>. Al tratarse de un dato de salud,
        se considera sensible: nadie está obligado a entregarlo, y el organizador que
        lo cargue es responsable de haber obtenido autorización explícita del jugador
        o su representante.
      </p>

      <h2>6. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger tu información: cifrado en
        tránsito, control de acceso y reglas de seguridad a nivel de base de datos.
        Ningún sistema es 100% infalible, pero trabajamos para reducir los riesgos.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés conocer, actualizar, rectificar o solicitar la supresión de tus datos,
        revocar tu autorización y presentar reclamos, escribiendo a{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>. El procedimiento
        y los plazos están en la sección 7 de la{" "}
        <Link href="/tratamiento-de-datos">Política de Tratamiento de Datos</Link>.
        También podés acudir a la Superintendencia de Industria y Comercio (SIC).
      </p>

      <h2>8. Cookies y almacenamiento local</h2>
      <p>
        Usamos almacenamiento local del navegador para mantener tu sesión iniciada y
        recordar preferencias. No usamos cookies de rastreo publicitario de terceros.
      </p>

      <h2>9. Cambios a esta Política</h2>
      <p>
        Podemos actualizar esta Política. Si el cambio es importante, te avisaremos
        por la aplicación o por correo antes de que entre en vigencia.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para cualquier duda sobre privacidad:{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>.
      </p>
    </>
  );
}
