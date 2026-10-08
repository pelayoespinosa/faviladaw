const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DIR = __dirname;
const SALIDA = path.join(DIR, 'documentos');
const LOGO = path.join(DIR, '..', 'client', 'public', 'logo.png');
const leer = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
const empleados = leer('empleados.json');
const usuarios = leer('usuarios.json');
const admin = usuarios.find((u) => u.rol === 'admin');

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(4242);
let n = 0;
const oid = (pre) => ({ $oid: pre + (++n).toString(16).padStart(24 - pre.length, '0') });
const F = (d) => ({ $date: new Date(d).toISOString() });

const DOCS = [
  {
    archivo: 'terminos-y-condiciones.pdf', titulo: 'Términos y condiciones de uso de Favila', carpeta: 'Legal',
    descripcion: 'Condiciones de uso de la aplicación para toda la plantilla. Hay que leerlas y confirmarlas.',
    destinatario: 'todos', confirmar: true, fecha: '2026-01-09T09:30:00Z', confirmados: 0.9,
    secciones: [
      ['1. Objeto', 'Estos términos regulan el uso de Favila, la aplicación de gestión de turnos, fichajes y documentos de la empresa. Al iniciar sesión con tu usuario y contraseña aceptas las condiciones que se describen a continuación.'],
      ['2. Cuenta personal', 'Cada persona dispone de un usuario y una contraseña personales e intransferibles. La contraseña temporal que se entrega al darte de alta debe cambiarse en el primer acceso. No compartas tus credenciales: cualquier fichaje hecho con tu cuenta se considerará hecho por ti. Si sospechas que alguien conoce tu contraseña, avisa a administración para que la restablezca.'],
      ['3. Fichajes', 'El fichaje de entrada y de salida es obligatorio en cada servicio. Para que el registro sea válido la aplicación necesita tu ubicación en el momento de fichar, por lo que debes tener activado el permiso de ubicación del móvil. Solo se guarda la posición puntual de la entrada y de la salida; no existe ningún seguimiento continuo de tu posición.'],
      ['4. Errores y olvidos', 'Si olvidas fichar o cometes un error, avisa a tu encargado. Los fichajes no se borran: administración puede corregirlos o anularlos indicando siempre un motivo, y la corrección queda registrada en el historial del fichaje.'],
      ['5. Conservación de los datos', 'Los registros de jornada se conservan durante cuatro años, a disposición de la persona trabajadora, de sus representantes y de la Inspección de Trabajo, conforme al artículo 34.9 del Estatuto de los Trabajadores.'],
      ['6. Uso correcto', 'La aplicación debe usarse únicamente para fines laborales. Está prohibido alterar o simular la ubicación del dispositivo, fichar por otra persona o intentar acceder a datos que no te correspondan. La empresa puede revisar los avisos de ubicación sospechosa y pedir explicaciones antes de adoptar cualquier medida.'],
      ['7. Documentos', 'Los documentos que la empresa publique en tu espacio (normas, calendarios, protocolos) deben marcarse como recibidos y, cuando se solicite, como conformes. La confirmación queda registrada con su fecha.'],
      ['8. Cambios', 'La empresa puede actualizar estos términos. Cuando haya una versión nueva se publicará en Documentos y se te pedirá que la confirmes de nuevo.'],
    ],
  },
  {
    archivo: 'proteccion-de-datos.pdf', titulo: 'Información sobre protección de datos y registro de jornada', carpeta: 'Legal',
    descripcion: 'Qué datos personales trata la empresa, para qué y durante cuánto tiempo.',
    destinatario: 'todos', confirmar: true, fecha: '2026-01-09T09:45:00Z', confirmados: 0.88,
    secciones: [
      ['Responsable del tratamiento', 'La empresa, con domicilio social en Asturias, es la responsable del tratamiento de tus datos. Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación y oposición escribiendo a administración.'],
      ['Datos que se tratan', 'Datos identificativos (nombre, DNI, teléfono, correo), datos laborales (jornada, turnos, contrato), horas de entrada y salida y la ubicación aproximada en el momento de fichar.'],
      ['Finalidad y base legal', 'Gestionar la relación laboral y cumplir con la obligación legal de llevar el registro de jornada (artículos 20.3 y 34.9 del Estatuto de los Trabajadores). El uso de dispositivos de geolocalización se limita al fichaje, de acuerdo con el artículo 90 de la Ley Orgánica 3/2018.'],
      ['Plazo de conservación', 'Los fichajes se conservan cuatro años. El resto de datos laborales, durante la relación laboral y los plazos legales posteriores.'],
      ['Destinatarios', 'La gestoría laboral y las administraciones públicas cuando exista obligación legal. No se ceden datos a terceros con otros fines.'],
    ],
  },
  {
    archivo: 'prevencion-riesgos-limpieza.pdf', titulo: 'Protocolo de prevención de riesgos en servicios de limpieza', carpeta: 'Prevención',
    descripcion: 'Normas básicas de seguridad: productos químicos, posturas, suelos mojados y trabajo en altura.',
    destinatario: 'todos', confirmar: true, fecha: '2026-03-02T08:00:00Z', confirmados: 0.82,
    secciones: [
      ['Productos químicos', 'No mezcles nunca productos de limpieza (en especial lejía con amoniaco o con desincrustantes). Usa guantes de nitrilo y ventila el local. Lee la etiqueta y no trasvases productos a envases sin identificar.'],
      ['Suelos mojados', 'Señaliza siempre la zona fregada con el cartel de suelo mojado y retíralo cuando esté seco. Calza zapatos cerrados y antideslizantes.'],
      ['Posturas y cargas', 'Dobla las rodillas al levantar peso, no gires el tronco con la carga en las manos y usa el carro de limpieza siempre que sea posible. Alterna tareas para no repetir el mismo movimiento durante horas.'],
      ['Cristales y alturas', 'Para limpiar ventanas en altura usa el material homologado (pértiga, escalera con apoyo). No te subas a sillas, mesas ni mobiliario.'],
      ['Máquinas', 'La limpieza mecanizada y el abrillantado solo los realiza el personal autorizado, con los cables recogidos y la zona acotada.'],
      ['Accidentes', 'Avisa de inmediato a tu encargado ante cualquier accidente o incidente, aunque parezca leve.'],
    ],
  },
  {
    archivo: 'normas-furgonetas.pdf', titulo: 'Normas de uso de las furgonetas de empresa', carpeta: 'Flota',
    descripcion: 'Uso, combustible, incidencias y entrega de llaves. Para conductores.',
    destinatario: 'grupo', grupo: 'conductor', confirmar: true, fecha: '2026-02-16T10:00:00Z', confirmados: 1,
    secciones: [
      ['Uso', 'Las furgonetas son de uso exclusivo laboral. Antes de salir revisa niveles, luces y neumáticos y anota cualquier daño que veas.'],
      ['Combustible', 'Se repostará con la tarjeta de combustible asignada a cada vehículo. Guarda siempre el justificante.'],
      ['Incidencias', 'Si hay una avería, multa o accidente, avisa a administración el mismo día y haz fotos de los daños.'],
    ],
  },
  {
    archivo: 'calendario-laboral-2026.pdf', titulo: 'Calendario laboral 2026', carpeta: 'General',
    descripcion: 'Festivos nacionales y de Asturias para 2026. Solo consulta.',
    destinatario: 'todos', confirmar: false, fecha: '2026-01-05T08:30:00Z',
    secciones: [
      ['Festivos nacionales y autonómicos', '1 de enero (jueves) · 6 de enero (martes) · 2 de abril, Jueves Santo (jueves) · 3 de abril, Viernes Santo (viernes) · 1 de mayo (viernes) · 15 de agosto (sábado) · 8 de septiembre, Día de Asturias (martes) · 12 de octubre (lunes) · 1 de noviembre (domingo) · 8 de diciembre (martes) · 25 de diciembre (viernes).'],
      ['Festivos locales', 'Cada trabajador dispone de dos festivos locales según su concejo de trabajo. Consulta el calendario del ayuntamiento y avisa a administración para que queden registrados.'],
    ],
  },
  {
    archivo: 'guia-para-fichar.pdf', titulo: 'Guía rápida para fichar desde el móvil', carpeta: 'General',
    descripcion: 'Cómo instalar la aplicación y fichar la entrada y la salida paso a paso.',
    destinatario: 'todos', confirmar: false, fecha: '2026-01-12T12:00:00Z',
    secciones: [
      ['Instalar', 'Abre la dirección de la aplicación en el navegador del móvil y elige «Añadir a pantalla de inicio». Así se abrirá como una aplicación más.'],
      ['Fichar la entrada', 'Al llegar al servicio, entra en Fichar, comprueba que el móvil ha encontrado tu ubicación y pulsa el botón grande. El botón cambia de color cuando tienes una jornada abierta.'],
      ['Fichar la salida', 'Al terminar, vuelve a pulsar el botón. No hace falta que fiches al cambiar de cliente si es el mismo turno.'],
      ['Si no funciona', 'Revisa que el permiso de ubicación esté en «Permitir» y que tengas cobertura. Si sigue sin funcionar, avisa a tu encargado: él puede añadir el fichaje a mano con un motivo.'],
    ],
  },
];

fs.mkdirSync(SALIDA, { recursive: true });

function escribirPDF(d) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 90, bottom: 60, left: 55, right: 55 } });
    const out = fs.createWriteStream(path.join(SALIDA, d.archivo));
    doc.pipe(out);
    const cabecera = () => {
      doc.save().rect(0, 0, doc.page.width, 64).fill('#0C3B28');
      doc.image(LOGO, 55, 10, { height: 44 });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('Favila', 95, 22, { lineBreak: false });
      doc.restore();
    };
    cabecera();
    doc.on('pageAdded', cabecera);
    doc.fillColor('#12241B').font('Helvetica-Bold').fontSize(18).text(d.titulo, 55, 90, { width: 485 });
    doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor('#6F8378')
      .text(`Versión de ${new Date(d.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, { width: 485 });
    doc.moveDown(1.2);
    for (const [titulo, texto] of d.secciones) {
      doc.fillColor('#125A37').font('Helvetica-Bold').fontSize(11.5).text(titulo, { width: 485 });
      doc.moveDown(0.25).fillColor('#1E2320').font('Helvetica').fontSize(10.5).text(texto, { width: 485, align: 'justify', lineGap: 2 });
      doc.moveDown(0.9);
    }
    doc.end();
    out.on('finish', resolve);
  });
}

(async () => {
  const activos = empleados.filter((e) => e.activo !== false);
  const documentos = [];
  for (const d of DOCS) {
    await escribirPDF(d);
    const destinatarios = d.destinatario === 'grupo' ? activos.filter((e) => e.rol === d.grupo) : activos;
    const creado = new Date(d.fecha);
    const confirmaciones = destinatarios.map((e) => {
      const c = { empleado: e._id };
      if (!d.confirmar) return c;
      if (rnd() < (d.confirmados ?? 0.85)) {
        const recibido = new Date(creado.getTime() + (1 + Math.floor(rnd() * 6)) * 86400000 + Math.floor(rnd() * 8) * 3600000);
        const conforme = new Date(recibido.getTime() + Math.floor(rnd() * 3) * 3600000 + 120000);
        Object.assign(c, { recibido: true, fecha_recibido: F(recibido), conforme: true, fecha_conforme: F(conforme) });
      } else if (rnd() < 0.4) {
        Object.assign(c, { recibido: true, fecha_recibido: F(new Date(creado.getTime() + 4 * 86400000)), conforme: false });
      }
      return c;
    });
    documentos.push({
      _id: oid('d2'), titulo: d.titulo, descripcion: d.descripcion, carpeta: d.carpeta,
      nombre_archivo_original: d.archivo, nombre_archivo_storage: 'demo-' + d.archivo,
      tipo_destinatario: d.destinatario, ...(d.grupo ? { grupo: d.grupo } : {}),
      requiere_confirmacion: d.confirmar, subido_por: admin._id, confirmaciones,
      createdAt: F(creado), updatedAt: F(creado), __v: 0,
    });
    fs.renameSync(path.join(SALIDA, d.archivo), path.join(SALIDA, 'demo-' + d.archivo));
  }
  const carpetas = [...new Set(DOCS.map((d) => d.carpeta))].map((nombre) => ({ _id: oid('d3'), nombre, createdAt: F('2026-01-05T08:00:00Z'), updatedAt: F('2026-01-05T08:00:00Z'), __v: 0 }));
  fs.writeFileSync(path.join(DIR, 'documentos.json'), JSON.stringify(documentos, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'carpetas.json'), JSON.stringify(carpetas, null, 2) + '\n');
  console.log(`documentos: ${documentos.length} (${DOCS.map((d) => d.titulo.split(' ').slice(0, 3).join(' ')).join(' | ')}) · carpetas: ${carpetas.map((c) => c.nombre).join(', ')}`);
  const t = documentos[0].confirmaciones;
  console.log(`términos y condiciones: ${t.filter((c) => c.conforme).length}/${t.length} conformes`);
})();
