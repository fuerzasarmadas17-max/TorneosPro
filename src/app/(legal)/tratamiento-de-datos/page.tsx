import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Tratamiento de Datos | TorneosPro",
  description:
    "Política de Tratamiento de Datos Personales de TorneosPro conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015.",
};

export default function TratamientoDatosPage() {
  return (
    <>
      <h1>Política de Tratamiento de Datos Personales</h1>
      <p className="text-sm">
        Fecha de entrada en vigencia: 18 de julio de 2026 · Última actualización: 18
        de julio de 2026
      </p>

      <p>
        <strong>Responsable del Tratamiento:</strong> Joshua David Samur Rojas,
        persona natural, identificado con cédula de ciudadanía No. 1.102.873.861 (en
        adelante, «TorneosPro», «la Plataforma» o «el Responsable»).
        <br />
        <strong>Domicilio:</strong> Sincelejo, Sucre, Colombia.
        <br />
        <strong>Correo electrónico de contacto:</strong>{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>
        <br />
        <strong>Teléfono:</strong> 300 663 2322
        <br />
        <strong>Sitio y aplicación:</strong> torneospro.co
      </p>

      <h2>1. Objeto y marco legal</h2>
      <p>
        Esta Política regula la recolección, almacenamiento, uso, circulación y
        supresión de datos personales que realiza TorneosPro, en cumplimiento de la
        Ley 1581 de 2012, el Decreto 1074 de 2015 (que compiló el Decreto 1377 de
        2013) y demás normas concordantes sobre protección de datos personales
        (habeas data) en Colombia.
      </p>

      <h2>2. Definiciones</h2>
      <ul>
        <li>
          <strong>Titular:</strong> persona natural cuyos datos personales son objeto
          de tratamiento (organizadores, jugadores, visitantes).
        </li>
        <li>
          <strong>Dato personal:</strong> cualquier información vinculada o que pueda
          asociarse a una persona natural determinada o determinable.
        </li>
        <li>
          <strong>Dato sensible:</strong> el que afecta la intimidad del Titular o
          cuyo uso indebido puede generar discriminación (p. ej., datos de salud como
          la afiliación a EPS).
        </li>
        <li>
          <strong>Responsable del Tratamiento:</strong> quien decide sobre la base de
          datos y las finalidades del tratamiento.
        </li>
        <li>
          <strong>Encargado del Tratamiento:</strong> quien trata los datos por cuenta
          del Responsable.
        </li>
        <li>
          <strong>Autorización:</strong> consentimiento previo, expreso e informado
          del Titular para tratar sus datos.
        </li>
      </ul>

      <h2>3. Doble rol de TorneosPro</h2>
      <p>En esta plataforma existen dos tipos de datos con roles distintos:</p>

      <h3>3.1. Datos de los que TorneosPro es Responsable</h3>
      <p>
        Son los datos de los <strong>organizadores</strong> (titulares de cuenta) y de
        los visitantes: datos de registro, perfil de organización, datos de contacto,
        datos de pago e información de uso. Sobre estos, TorneosPro decide las
        finalidades y responde como Responsable conforme a esta Política.
      </p>

      <h3>3.2. Datos de los que TorneosPro es solo Encargado</h3>
      <p>
        Son los <strong>datos de los jugadores</strong> que el organizador carga en la
        plataforma (nombre, número de documento, EPS, fecha de nacimiento/edad, lugar
        de residencia). Respecto de estos datos:
      </p>
      <ul>
        <li>
          <strong>El organizador es el Responsable del Tratamiento.</strong> Es quien
          los recolecta, decide su finalidad (gestionar su torneo) y responde por su
          legalidad.
        </li>
        <li>
          <strong>TorneosPro actúa únicamente como Encargado</strong>, almacenándolos
          y mostrándolos por instrucción del organizador y con el único fin de que el
          torneo funcione.
        </li>
        <li>
          Al cargar datos de jugadores, <strong>el organizador declara y garantiza</strong> que:
          <ol>
            <li>
              Obtuvo la autorización previa, expresa e informada de cada Titular (o de
              su representante legal, si es menor de edad) para tratar sus datos y para
              transmitirlos a TorneosPro como Encargado.
            </li>
            <li>
              Cuando el dato es sensible (p. ej., EPS), obtuvo autorización explícita e
              informó al Titular que no está obligado a autorizar datos sensibles.
            </li>
            <li>Cumplió con su deber de informar la finalidad y esta Política.</li>
          </ol>
        </li>
        <li>
          <strong>TorneosPro no decide</strong> sobre estos datos ni los usa para
          fines propios distintos de la prestación del servicio, y los suprime cuando
          el organizador lo solicite o cuando cese la relación, salvo obligación legal
          de conservación.
        </li>
      </ul>
      <blockquote>
        Este esquema no exime a TorneosPro de sus deberes como Encargado (seguridad,
        confidencialidad, atención de reclamos junto con el Responsable), pero la
        responsabilidad por la legalidad de la recolección de los datos de jugadores
        recae en el organizador.
      </blockquote>

      <h2>4. Tratamiento y finalidades</h2>
      <h3>4.1. Datos de organizadores y visitantes (TorneosPro Responsable)</h3>
      <ul>
        <li>Crear, autenticar y administrar la cuenta del organizador.</li>
        <li>Prestar el servicio: creación y gestión de torneos, perfil público, estadísticas.</li>
        <li>Procesar pagos de planes a través de la pasarela de pagos.</li>
        <li>Enviar comunicaciones operativas y de soporte relacionadas con el servicio.</li>
        <li>Cumplir obligaciones legales, contables y de seguridad.</li>
        <li>Mostrar públicamente el perfil del organizador solo si este lo configura como público.</li>
      </ul>
      <h3>4.2. Datos de jugadores (TorneosPro Encargado)</h3>
      <ul>
        <li>
          Almacenar y mostrar la información de inscripción, planillas, resultados y
          estadísticas del torneo, por instrucción del organizador.
        </li>
        <li>Ninguna finalidad publicitaria ni comercial propia de TorneosPro sobre estos datos.</li>
      </ul>

      <h2>5. Datos sensibles y de menores de edad</h2>
      <ul>
        <li>
          <strong>Datos sensibles (EPS / salud):</strong> su entrega es facultativa.
          Ningún Titular está obligado a autorizar el tratamiento de datos sensibles.
          El organizador que cargue este dato es responsable de haber obtenido
          autorización explícita.
        </li>
        <li>
          <strong>Menores de edad:</strong> el tratamiento de datos de niños, niñas y
          adolescentes es de naturaleza restringida y solo procede cuando responde a su
          interés superior y se cuenta con la autorización del representante legal
          (padre, madre o tutor). El organizador que inscriba menores declara que
          cuenta con dicha autorización y es responsable ante sus titulares. TorneosPro
          trata estos datos únicamente como Encargado y con medidas de seguridad
          reforzadas.
        </li>
      </ul>

      <h2>6. Derechos de los Titulares</h2>
      <p>Conforme al artículo 8 de la Ley 1581 de 2012, el Titular puede:</p>
      <ul>
        <li>Conocer, actualizar y rectificar sus datos.</li>
        <li>Solicitar prueba de la autorización otorgada.</li>
        <li>Ser informado sobre el uso que se da a sus datos.</li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por
          infracciones a la ley.
        </li>
        <li>
          Revocar la autorización y/o solicitar la supresión del dato cuando no exista
          un deber legal o contractual de conservarlo.
        </li>
        <li>Acceder de forma gratuita a sus datos.</li>
      </ul>
      <blockquote>
        Si el dato corresponde a un jugador cargado por un organizador, TorneosPro
        canalizará la solicitud y, cuando corresponda, la trasladará al organizador
        (Responsable) para su atención conjunta.
      </blockquote>

      <h2>7. Procedimiento para ejercer los derechos (consultas y reclamos)</h2>
      <p>
        Los Titulares pueden ejercer sus derechos escribiendo a{" "}
        <a href="mailto:legal@torneospro.co">legal@torneospro.co</a>, indicando su
        nombre, identificación, la solicitud concreta y datos de contacto.
      </p>
      <ul>
        <li>
          <strong>Consultas:</strong> se atenderán en un término máximo de diez (10)
          días hábiles. Si no fuere posible, se informará al interesado y se atenderá
          dentro de los cinco (5) días hábiles siguientes al vencimiento del primer
          plazo.
        </li>
        <li>
          <strong>Reclamos:</strong> se atenderán en un término máximo de quince (15)
          días hábiles contados desde el día siguiente a su recibo. Si no fuere
          posible, se informarán los motivos y la fecha de atención, que no superará
          los ocho (8) días hábiles siguientes.
        </li>
      </ul>

      <h2>8. Encargados y terceros (proveedores)</h2>
      <p>
        Para operar, TorneosPro se apoya en proveedores que actúan como Encargados
        bajo acuerdos de tratamiento y confidencialidad, entre ellos:
      </p>
      <ul>
        <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.</li>
        <li><strong>Vercel</strong> — alojamiento (hosting) de la aplicación.</li>
        <li><strong>Wompi</strong> — procesamiento de pagos.</li>
      </ul>
      <p>Estos proveedores tratan los datos únicamente para prestar su servicio a TorneosPro.</p>

      <h2>9. Transferencia y transmisión internacional</h2>
      <p>
        Algunos proveedores (p. ej. Supabase y Vercel) pueden almacenar o procesar
        datos en servidores ubicados fuera de Colombia. Dichas operaciones se realizan
        bajo contratos de transmisión de datos que obligan al Encargado a cumplir
        estándares de seguridad y confidencialidad equivalentes a los exigidos por la
        ley colombiana. Al aceptar esta Política, el Titular autoriza esta transmisión.
      </p>

      <h2>10. Medidas de seguridad</h2>
      <p>
        TorneosPro adopta medidas técnicas, humanas y administrativas razonables para
        proteger los datos contra pérdida, acceso no autorizado, alteración o
        divulgación, incluyendo cifrado en tránsito, control de acceso y reglas de
        seguridad a nivel de base de datos.
      </p>

      <h2>11. Vigencia de la Política y de las bases de datos</h2>
      <p>
        Esta Política rige a partir de la fecha de entrada en vigencia indicada arriba.
        Las bases de datos se conservarán mientras exista la relación con el Titular o
        el organizador y por el tiempo adicional que exijan obligaciones legales;
        cumplido ese término, los datos se suprimirán o anonimizarán.
      </p>

      <h2>12. Cambios</h2>
      <p>
        Cualquier cambio sustancial en esta Política se comunicará a través de la
        aplicación o por correo electrónico antes de su entrada en vigencia.
      </p>

      <p className="text-sm">
        Ver también la{" "}
        <Link href="/privacidad">Política de Privacidad</Link>.
      </p>
    </>
  );
}
