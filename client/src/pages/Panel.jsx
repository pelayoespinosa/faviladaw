import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { calcHSemProrr, TAREAS_LABEL, TAREAS_MEC } from '../constants/tareas';
import { DESACTIVADOS } from '../constants/navegacion';

const CONTRATACIONES = !DESACTIVADOS.has('/contrataciones');

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIA_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const pad = n => String(n).padStart(2, '0');
const clave = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hhmm = d => new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtNum = (n, dec = 0) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const minutos = s => {
  if (!s || typeof s !== 'string' || !s.includes(':')) return null;
  const [h, m] = s.split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
};

function horasDiaTurno(t) {
  const tr = (t.tramos || []).reduce((acc, x) => {
    const a = minutos(x.hora_llegada), b = minutos(x.hora_salida);
    return a != null && b != null && b > a ? acc + (b - a) / 60 : acc;
  }, 0);
  if (tr > 0) return tr;
  const n = (t.dias_semana || []).length;
  return n ? (t.horas_semana || 0) / n : 0;
}

function turnoEsHoy(t, hoy) {
  if (!(t.dias_semana || []).includes(DIAS[hoy.getDay()])) return false;
  if ((t.frecuencia || 'semanal') === 'semanal') return true;
  return t.proxima_fecha && clave(new Date(t.proxima_fecha)) === clave(hoy);
}

function pedir(promesa) { return promesa.then(r => r.data).catch(() => null); }

function GraficoHoras({ dias }) {
  const W = 640, H = 220, L = 36, R = 8, T = 14, B = 26;
  const max = Math.max(50, ...dias.map(d => Math.max(d.real, d.plan))) * 1.1;
  const paso = (W - L - R) / dias.length, bw = Math.min(24, paso - 10);
  const y = v => T + (H - T - B) - (v / max) * (H - T - B);
  const tick = max > 400 ? 200 : max > 200 ? 100 : max > 80 ? 50 : 20;
  const ticks = []; for (let v = 0; v <= max; v += tick) ticks.push(v);
  const pts = dias.map((d, i) => `${L + paso * i + paso / 2},${y(d.plan)}`).join(' ');
  return (
    <svg className="chart-h" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horas fichadas por día frente a horas previstas en los turnos semanales">
      {ticks.map(t => (
        <g key={t}><line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 6} y={y(t) + 3.5} textAnchor="end">{t}</text></g>
      ))}
      {dias.map((d, i) => {
        const cx = L + paso * i + paso / 2, top = y(d.real), alto = T + (H - T - B) - top, r = Math.min(4, alto / 2);
        return (
          <g key={d.k}>
            {alto > 0.5 && (
              <path className={`b${d.hoy ? ' today' : ''}`} d={`M${cx - bw / 2},${top + alto} V${top + r} q0,-${r} ${r},-${r} H${cx + bw / 2 - r} q${r},0 ${r},${r} V${top + alto} Z`}>
                <title>{`${d.etiqueta}: ${fmtNum(d.real, 1)} h fichadas de ${fmtNum(d.plan, 1)} h previstas`}</title>
              </path>
            )}
            <text x={cx} y={H - 8} textAnchor="middle">{d.etiqueta}</text>
          </g>
        );
      })}
      <polyline className="planned" points={pts} />
      {dias.length > 0 && (
        <text x={L + paso * (dias.length - 1) + paso / 2} y={y(dias[dias.length - 1].real) - 6} textAnchor="middle" style={{ fill: 'var(--text)', fontWeight: 600 }}>
          {fmtNum(dias[dias.length - 1].real)} h
        </text>
      )}
    </svg>
  );
}

export default function Panel() {
  const { rol, esAdmin, esEncargado, esGestoria, empleadoId } = useAuth();
  const [d, setD] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => { const id = setInterval(() => setAhora(new Date()), 60_000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const hoy = new Date();
    const desde14 = clave(sumarDias(hoy, -13));
    const inicioMes = clave(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const hoyK = clave(hoy);
    const emp = esAdmin ? {} : { empleado: 'todos' };
    const veTurnos = esAdmin || esEncargado;
    Promise.all([
      pedir(api.get('/fichajes', { params: { desde: esGestoria ? inicioMes : (inicioMes < desde14 ? inicioMes : desde14), hasta: hoyK, empleado: 'todos' } })),
      veTurnos ? pedir(api.get('/turnos')) : null,
      veTurnos ? pedir(api.get('/calendario/ausencias', { params: { desde: hoyK, hasta: clave(sumarDias(hoy, 7)), empleado: 'todos' } })) : null,
      veTurnos ? pedir(api.get('/calendario/coberturas', { params: { ...emp, desde: hoyK, hasta: clave(sumarDias(hoy, 7)) } })) : null,
      veTurnos ? pedir(api.get('/solicitudes')) : null,
      pedir(api.get('/documentos')),
      esAdmin || esEncargado ? pedir(api.get('/clientes')) : null,
      esAdmin ? pedir(api.get('/flota')) : null,
      pedir(api.get('/empleados')),
      esAdmin || esGestoria ? pedir(api.get('/cuadro-laboral/meses')) : null,
      empleadoId ? pedir(api.get('/fichajes/estado')) : null,
    ]).then(([fichajes, turnos, ausencias, coberturas, solicitudes, documentos, clientes, flota, empleados, cuadros, miEstado]) =>
      setD({ fichajes: fichajes || [], turnos: turnos || [], ausencias: ausencias || [], coberturas: coberturas || [], solicitudes: solicitudes || [],
        documentos: documentos || [], clientes: clientes || [], flota: flota || [], empleados: empleados || [], cuadros: cuadros || [], miEstado,
        cargado: { turnos: !!turnos, clientes: !!clientes, flota: !!flota } }));
  }, [esAdmin, esEncargado, esGestoria, empleadoId]);

  const c = useMemo(() => {
    if (!d) return null;
    const hoy = ahora, hoyK = clave(hoy), minAhora = hoy.getHours() * 60 + hoy.getMinutes();
    const fich = d.fichajes;
    const abiertos = fich.filter(f => f.estado === 'abierto');
    const sinSalida = abiertos.filter(f => clave(new Date(f.entrada.fecha_hora)) < hoyK);
    const enServicio = abiertos.filter(f => clave(new Date(f.entrada.fecha_hora)) === hoyK);
    const fichHoyPorEmp = {};
    fich.filter(f => clave(new Date(f.entrada.fecha_hora)) === hoyK).forEach(f => {
      const id = f.empleado?._id; if (!id) return;
      if (!fichHoyPorEmp[id] || new Date(f.entrada.fecha_hora) < new Date(fichHoyPorEmp[id].entrada.fecha_hora)) fichHoyPorEmp[id] = f;
    });

    const ausHoy = d.ausencias.filter(a => a.fecha_inicio.slice(0, 10) <= hoyK && (!a.fecha_fin || a.fecha_fin.slice(0, 10) >= hoyK));
    const ausentesHoy = new Set(ausHoy.map(a => a.empleado?._id));
    const vac = ausHoy.filter(a => a.tipo === 'vacaciones').length, bajas = ausHoy.filter(a => a.tipo === 'baja').length;

    const hoyTurnos = d.turnos.filter(t => t.empleado && turnoEsHoy(t, hoy)).map(t => {
      const id = t.empleado._id, f = fichHoyPorEmp[id];
      const llegTxt = t.tramos?.[0]?.hora_llegada;
      const lleg = minutos(llegTxt);
      let estado;
      if (ausentesHoy.has(id)) estado = { k: 'aus', txt: 'Ausente', cls: 'lima', ord: 3 };
      else if (f?.estado === 'abierto') estado = { k: 'srv', txt: 'En servicio', cls: 'ok', ord: 2 };
      else if (f) estado = { k: 'fin', txt: 'Terminado', cls: 'mute', ord: 4 };
      else if (lleg != null && minAhora > lleg + 10) estado = { k: 'sin', txt: `Sin fichar · ${llegTxt}`, cls: 'crit', ord: 0 };
      else estado = { k: 'pen', txt: lleg != null ? `Entra a las ${llegTxt}` : 'Pendiente', cls: 'mute', ord: 1 };
      return { t, f, estado, lleg: lleg ?? 9999 };
    }).sort((a, b) => a.estado.ord - b.estado.ord || a.lleg - b.lleg);
    const previstosHoy = new Set(hoyTurnos.filter(x => x.estado.k !== 'aus').map(x => x.t.empleado._id)).size;
    const sinFichar = hoyTurnos.filter(x => x.estado.k === 'sin');
    const proximasEntradas = hoyTurnos.filter(x => x.estado.k === 'pen' && x.lleg !== 9999 && x.lleg <= 12 * 60).length;

    const turnosPorCliente = {};
    d.turnos.forEach(t => { const id = t.cliente?._id; if (id) (turnosPorCliente[id] = turnosPorCliente[id] || []).push(t); });
    let cont = 0, falta = 0; const zonas = {}; const huecos = [];
    d.clientes.forEach(cl => {
      const asig = {};
      (turnosPorCliente[cl._id] || []).forEach(t => { const k = t.tipo_tarea || 'otros'; asig[k] = (asig[k] || 0) + calcHSemProrr(t); });
      let cCont = 0, cFalta = 0;
      (cl.horas_contratadas || []).forEach(e => {
        const h = calcHSemProrr({ horas_semana: e.horas, frecuencia: e.frecuencia, tipo_tarea: e.tipo_tarea });
        const g = Math.max(0, h - (asig[e.tipo_tarea] || 0));
        cCont += h; cFalta += g > 0.01 ? g : 0;
        if (g > 0.01) huecos.push({ cl, tipo: e.tipo_tarea, g });
      });
      cont += cCont; falta += cFalta;
      if (cCont > 0) { const z = cl.zona || 'Sin zona'; zonas[z] = zonas[z] || { cont: 0, falta: 0 }; zonas[z].cont += cCont; zonas[z].falta += cFalta; }
    });
    huecos.sort((a, b) => b.g - a.g);
    const cobertura = cont > 0 ? Math.round(((cont - falta) / cont) * 100) : null;
    const zonasArr = Object.entries(zonas).map(([z, v]) => ({ z, pct: Math.round(((v.cont - v.falta) / v.cont) * 100) })).sort((a, b) => b.pct - a.pct).slice(0, 7);

    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const dia = sumarDias(hoy, -i), k = clave(dia), nombre = DIAS[dia.getDay()];
      const real = fich.filter(f => clave(new Date(f.entrada.fecha_hora)) === k).reduce((acc, f) => {
        if (f.duracion_horas != null) return acc + f.duracion_horas;
        if (f.estado === 'abierto' && k === hoyK) return acc + Math.max(0, (hoy - new Date(f.entrada.fecha_hora)) / 3600000);
        return acc;
      }, 0);
      const plan = d.turnos.filter(t => (t.frecuencia || 'semanal') === 'semanal' && (t.dias_semana || []).includes(nombre)).reduce((acc, t) => acc + horasDiaTurno(t), 0);
      dias.push({ k, etiqueta: `${DIA_CORTO[dia.getDay()]} ${dia.getDate()}`, real, plan, hoy: i === 0 });
    }

    const solPend = d.solicitudes.filter(s => s.estado === 'pendiente');
    const solTotal = solPend.reduce((acc, s) => acc + (s.productos || []).reduce((a, p) => a + (p.precio != null ? p.precio * p.cantidad : 0), 0), 0);
    const docsPend = d.documentos.filter(x => x.requiere_confirmacion !== false).map(x => ({ x, n: (x.confirmaciones || []).filter(cf => !cf.conforme).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    const notasFlota = [];
    d.flota.forEach(f => (f.notas || []).forEach(n => {
      if (!n.fecha) return;
      const dd = Math.round((new Date(n.fecha) - new Date(hoyK)) / 86400000);
      if (dd >= -7 && dd <= 15) notasFlota.push({ f, n, dd });
    }));
    notasFlota.sort((a, b) => a.dd - b.dd);

    const proximos = [];
    d.ausencias.forEach(a => { const k = a.fecha_inicio.slice(0, 10); if (k > hoyK) proximos.push({ k, tipo: a.tipo === 'baja' ? ['crit', 'Baja'] : ['lima', 'Vacaciones'], txt: a.empleado?.nombre_display || '—' }); });
    d.turnos.forEach(t => {
      if ((t.frecuencia || 'semanal') === 'semanal' || !t.proxima_fecha) return;
      const k = clave(new Date(t.proxima_fecha));
      if (k >= hoyK && k <= clave(sumarDias(hoy, 7))) proximos.push({ k, tipo: ['info', t.frecuencia[0].toUpperCase() + t.frecuencia.slice(1)], txt: `${t.cliente?.nombre || (t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : '—')} · ${TAREAS_LABEL[t.tipo_tarea] || t.tipo_tarea}` });
    });
    const vistosCob = new Set();
    d.coberturas.forEach(cb => {
      const k = cb.fecha.slice(0, 10), id = `${cb.empleado_ausente?._id}-${cb.empleado_cubre?._id}`;
      if (k < hoyK || vistosCob.has(id)) return; vistosCob.add(id);
      proximos.push({ k, tipo: ['warn', 'Cobertura'], txt: `${cb.empleado_cubre?.nombre_display || '—'} cubre a ${cb.empleado_ausente?.nombre_display || '—'}` });
    });
    proximos.sort((a, b) => a.k.localeCompare(b.k));

    const mecanizados = d.turnos
      .filter(t => TAREAS_MEC.has(t.tipo_tarea) && t.proxima_fecha)
      .map(t => ({ t, k: clave(new Date(t.proxima_fecha)), dd: Math.round((new Date(clave(new Date(t.proxima_fecha))) - new Date(hoyK)) / 86400000) }))
      .filter(x => x.dd >= -14 && x.dd <= 60)
      .sort((a, b) => a.dd - b.dd);

    const horasTurnos = {};
    d.turnos.forEach(t => { const id = t.empleado?._id; if (id) horasTurnos[id] = (horasTurnos[id] || 0) + calcHSemProrr(t); });
    const sobreContrato = d.empleados
      .filter(e => e.activo !== false && e.horas_semanales_contrato > 0)
      .map(e => ({ e, exceso: (horasTurnos[e._id] || 0) - e.horas_semanales_contrato }))
      .filter(x => x.exceso > 1)
      .sort((a, b) => b.exceso - a.exceso);

    const mesK = hoyK.slice(0, 7);
    const horasMes = fich.filter(f => clave(new Date(f.entrada.fecha_hora)).startsWith(mesK)).reduce((a, f) => a + (f.duracion_horas || 0), 0);
    const cuadroMes = d.cuadros.find(x => x.anio === hoy.getFullYear() && x.mes === hoy.getMonth() + 1);
    const activos = d.empleados.filter(e => e.activo !== false).length;

    return { sinSalida, enServicio, previstosHoy, vac, bajas, ausHoy, hoyTurnos, sinFichar, proximasEntradas, cobertura, cont, falta, huecos, zonasArr, dias, solPend, solTotal, docsPend, notasFlota, sobreContrato, proximos: proximos.slice(0, 8), mecanizados, horasMes, cuadroMes, activos };
  }, [d, ahora]);

  const saludo = ahora.getHours() < 14 ? 'Buenos días' : ahora.getHours() < 21 ? 'Buenas tardes' : 'Buenas noches';
  const fecha = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (!c) {
    return (
      <div className="dash">
        <div className="dash-head"><div><div className="sub">{fecha}</div><h2>{saludo}</h2></div></div>
        <div className="kpis">{[0, 1, 2, 3].map(i => <div className="kpi" key={i}><div className="skel" style={{ width: '60%' }} /><div className="skel" style={{ height: 28, width: '40%' }} /></div>)}</div>
      </div>
    );
  }

  const atencion = [];
  if (c.sinSalida.length) atencion.push({ ic: 'crit', s: '!', t: `${c.sinSalida.length} ${c.sinSalida.length === 1 ? 'fichaje' : 'fichajes'} sin salida`, sub: c.sinSalida.slice(0, 3).map(f => f.empleado?.nombre_display?.split(',')[0]).join(', '), to: '/fichajes', go: 'Corregir' });
  if (c.sinFichar.length) atencion.push({ ic: 'crit', s: '⏱', t: `${c.sinFichar.length} ${c.sinFichar.length === 1 ? 'persona' : 'personas'} sin fichar hoy`, sub: c.sinFichar.slice(0, 3).map(x => x.t.empleado?.nombre_display?.split(',')[0]).join(', '), to: '/fichajes', go: 'Ver' });
  if (esAdmin && CONTRATACIONES && c.huecos.length) atencion.push({ ic: 'warn', s: 'h', t: `${c.huecos[0].cl.alias || c.huecos[0].cl.nombre}: ${fmtNum(c.huecos[0].g, 1)} h/sem sin asignar`, sub: `${TAREAS_LABEL[c.huecos[0].tipo] || c.huecos[0].tipo}${c.huecos.length > 1 ? ` · y ${c.huecos.length - 1} huecos más` : ''}`, to: '/asignacion-automatica', go: 'Asignar' });
  if (c.docsPend.length) atencion.push({ ic: 'info', s: '✎', t: `${c.docsPend.reduce((a, x) => a + x.n, 0)} confirmaciones de documentos pendientes`, sub: c.docsPend[0].x.titulo, to: '/documentos', go: 'Ver' });
  if (c.solPend.length) atencion.push({ ic: 'vio', s: '▢', t: `${c.solPend.length} ${c.solPend.length === 1 ? 'solicitud' : 'solicitudes'} de material pendientes`, sub: `Sin reparto asignado${c.solTotal ? ` · ${fmtNum(c.solTotal, 2)} €` : ''}`, to: '/solicitudes', go: 'Asignar' });
  const vencidos = c.mecanizados.filter(x => x.dd < 0);
  if (vencidos.length) atencion.push({ ic: 'crit', s: '✦', t: `${vencidos.length} ${vencidos.length === 1 ? 'servicio vencido' : 'servicios vencidos'} sin hacer`, sub: `${vencidos[0].t.cliente ? (vencidos[0].t.cliente.alias || vencidos[0].t.cliente.nombre) : 'Furgoneta'} · ${TAREAS_LABEL[vencidos[0].t.tipo_tarea] || vencidos[0].t.tipo_tarea} · hace ${-vencidos[0].dd} días`, to: '/turnos', go: 'Ver' });
  if (esAdmin && c.sobreContrato.length) atencion.push({ ic: 'warn', s: 'h', t: `${c.sobreContrato.length} ${c.sobreContrato.length === 1 ? 'empleado se pasa' : 'empleados se pasan'} de su jornada de contrato`, sub: c.sobreContrato.slice(0, 2).map(x => `${x.e.nombre_display.split(',')[0]} (+${fmtNum(x.exceso, 1)} h/sem)`).join(', ') + (c.sobreContrato.length > 2 ? ` y ${c.sobreContrato.length - 2} más` : ''), to: '/empleados', go: 'Ver' });
  c.notasFlota.slice(0, 2).forEach(x => atencion.push({ ic: x.dd < 0 ? 'crit' : 'warn', s: '⛟', t: `Furgoneta ${x.f.numero}: ${x.n.texto}`, sub: `${new Date(x.n.fecha).toLocaleDateString('es-ES')} · ${x.f.matricula}`, to: '/flota', go: 'Ver' }));

  if (esGestoria) {
    return (
      <div className="dash">
        <div className="dash-head"><div><div className="sub">{fecha}</div><h2>{saludo}</h2></div></div>
        <div className="kpis">
          <Link to="/fichajes" className="kpi"><span className="l">Horas fichadas este mes</span><span className="v">{fmtNum(c.horasMes)} <small>h</small></span></Link>
          <Link to="/fichajes" className={`kpi${c.sinSalida.length ? ' crit' : ''}`}><span className="l">Fichajes sin salida</span><span className="v">{c.sinSalida.length}</span></Link>
          <Link to="/cuadro-laboral" className="kpi"><span className="l">Cuadro laboral del mes</span><span className="v" style={{ fontSize: 22 }}>{c.cuadroMes ? 'Generado' : 'Sin generar'}</span></Link>
          <Link to="/empleados" className="kpi"><span className="l">Empleados activos</span><span className="v">{c.activos}</span></Link>
        </div>
        <div className="dcard">
          <h3>Exportaciones del mes</h3>
          <div className="dash-actions">
            <Link className="btn-sec" to="/fichajes">Fichajes · PDF y XLSX</Link>
            <Link className="btn-sec" to="/cuadro-laboral">Cuadro laboral · PDF y XLSX</Link>
            <Link className="btn-sec" to="/empleados">Empleados · Excel</Link>
            <Link className="btn-sec" to="/documentos">Documentos</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-head">
        <div><div className="sub">{fecha}</div><h2>{saludo}</h2></div>
        <div className="dash-actions">
          {esEncargado && <Link className="btn-sec pri" to="/fichar">{d.miEstado ? `Fichar salida · dentro desde ${hhmm(d.miEstado.entrada.fecha_hora)}` : 'Fichar entrada'}</Link>}
          {esAdmin && <><Link className="btn-sec" to="/fichajes">Fichajes del mes</Link><Link className="btn-sec" to="/turnos">+ Turno</Link><Link className="btn-sec pri" to="/gestion-empleados">+ Nuevo empleado</Link></>}
        </div>
      </div>

      <div className="kpis">
        <Link to="/fichajes" className="kpi">
          <span className="l">En servicio ahora</span>
          <span className="v">{c.enServicio.length} <small>de {c.previstosHoy} previstos hoy</small></span>
          <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${c.previstosHoy ? Math.min(100, (c.enServicio.length / c.previstosHoy) * 100) : 0}%` }} /></div>
          <span className="s">{c.proximasEntradas ? `${c.proximasEntradas} entran antes de las 12:00` : 'Según los turnos de hoy'}</span>
        </Link>
        <Link to="/fichajes" className={`kpi${c.sinSalida.length + c.sinFichar.length ? ' crit' : ''}`}>
          <span className="l">Incidencias de fichaje</span>
          <span className="v">{c.sinSalida.length + c.sinFichar.length}</span>
          <span className="s">{c.sinSalida.length} sin salida · {c.sinFichar.length} sin fichar hoy</span>
        </Link>
        <Link to="/vacaciones-bajas" className="kpi">
          <span className="l">Ausentes hoy</span>
          <span className="v">{c.ausHoy.length}</span>
          <span className="s"><span className="chip lima">{c.vac} vacaciones</span><span className="chip crit">{c.bajas} {c.bajas === 1 ? 'baja' : 'bajas'}</span></span>
        </Link>
        {esAdmin && CONTRATACIONES ? (
          <Link to="/contrataciones" className={`kpi${c.cobertura != null && c.cobertura < 100 ? ' warn' : ''}`}>
            <span className="l">Cobertura de contratos</span>
            <span className="v">{c.cobertura != null ? `${c.cobertura} %` : '—'}</span>
            <span className="s"><span className="num">{fmtNum(c.cont - c.falta)}</span> de <span className="num">{fmtNum(c.cont)}</span> h/sem · {fmtNum(c.falta)} h sin cubrir</span>
          </Link>
        ) : (
          <Link to="/solicitudes" className={`kpi${c.solPend.length ? ' warn' : ''}`}>
            <span className="l">Solicitudes pendientes</span>
            <span className="v">{c.solPend.length}</span>
            <span className="s">Sin reparto asignado</span>
          </Link>
        )}
      </div>

      <div className="dash-grid">
        <div className="dcard">
          <h3>Horas fichadas · últimos 14 días <span className="sp" /><span className="legend"><span><i />Fichadas</span><span><i className="l" />Hoy (en curso)</span><span><i className="p" />Previstas en turnos semanales</span></span></h3>
          <GraficoHoras dias={c.dias} />
        </div>
        <div className="dcard">
          <h3>Requiere tu atención {atencion.length > 0 && <span className="chip crit nod">{atencion.length}</span>}</h3>
          {atencion.length === 0 ? <div className="dash-empty">Todo al día: no hay nada pendiente.</div> : (
            <div className="att">
              {atencion.map((a, i) => (
                <Link key={i} to={a.to}><span className={`ic ${a.ic}`}>{a.s}</span><div style={{ minWidth: 0 }}><b>{a.t}</b>{a.sub && <small>{a.sub}</small>}</div><span className="go">{a.go}</span></Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <div className="dcard">
          <h3>Ahora mismo <span className="chip ok">turnos de hoy</span><span className="sp" />{esAdmin && <Link to="/mapa">Abrir mapa</Link>}</h3>
          {c.hoyTurnos.length === 0 ? <div className="dash-empty">Hoy no hay turnos semanales.</div> : (
            <div className="table-wrap" style={{ boxShadow: 'none' }}>
              <table className="data-table">
                <thead><tr><th>Empleado</th><th>Cliente</th><th>Horario</th><th>Entrada</th><th>Estado</th></tr></thead>
                <tbody>
                  {c.hoyTurnos.slice(0, 8).map(({ t, f, estado }) => (
                    <tr key={t._id} className="row-parent" style={{ cursor: 'default' }}>
                      <td><b>{t.empleado?.nombre_display}</b></td>
                      <td>{t.cliente ? (t.cliente.alias || t.cliente.nombre) + (t.cliente.sucursal ? ` · ${t.cliente.sucursal}` : '') : t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : '—'}</td>
                      <td className="num" style={{ fontSize: 12.5 }}>{(t.tramos || []).map(x => `${x.hora_llegada}–${x.hora_salida}`).join(' · ') || '—'}</td>
                      <td className="num" style={{ fontSize: 12.5 }}>{f ? hhmm(f.entrada.fecha_hora) : '—'}</td>
                      <td><span className={`chip ${estado.cls}`}>{estado.txt}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {c.hoyTurnos.length > 8 && <div style={{ marginTop: 10, fontSize: 12.5 }}><Link to="/fichajes" style={{ color: 'var(--accent-ink)' }}>Ver los {c.hoyTurnos.length} turnos de hoy en Fichajes</Link></div>}
        </div>
        <div className="dash-col">
          <div className="dcard">
            <h3>Próximos abrillantados y L. mecanizadas {c.mecanizados.length > 0 && <span className="chip info nod">{c.mecanizados.length}</span>}<span className="sp" />{esAdmin && <Link to="/turnos">Turnos</Link>}</h3>
            {c.mecanizados.length === 0 ? <div className="dash-empty">No hay abrillantados ni limpiezas mecanizadas en los próximos 60 días.</div> : (
              <div className="ev-list">
                {c.mecanizados.slice(0, 10).map(({ t, k, dd }) => (
                  <div key={t._id} className="ev-row">
                    <span className="num ev-fecha">{new Date(`${k}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                    <span className={`chip ${dd < 0 ? 'crit' : dd <= 7 ? 'warn' : 'ok'}`}>{dd < 0 ? `Vencido ${-dd}d` : dd === 0 ? 'Hoy' : dd === 1 ? 'Mañana' : `En ${dd}d`}</span>
                    <span className="ev-txt">
                      <b style={{ fontWeight: 600 }}>{t.cliente ? (t.cliente.alias || t.cliente.nombre) + (t.cliente.sucursal ? ` · ${t.cliente.sucursal}` : '') : t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : '—'}</b>
                      <span style={{ color: 'var(--text-2)' }}> · {TAREAS_LABEL[t.tipo_tarea] || t.tipo_tarea}{t.empleado ? ` · ${t.empleado.nombre_display?.split(',')[0]}` : ''}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {c.mecanizados.length > 10 && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-3)' }}>Y {c.mecanizados.length - 10} más</div>}
          </div>
          {esAdmin && CONTRATACIONES && (
            <div className="dcard">
              <h3>Cobertura por zona <span className="sp" /><Link to="/contrataciones">Contrataciones</Link></h3>
              {c.zonasArr.length === 0 ? <div className="dash-empty">Sin horas contratadas registradas.</div> : (
                <div className="hbar">
                  {c.zonasArr.map(z => [
                    <span key={`${z.z}-l`}>{z.z}</span>,
                    <div key={`${z.z}-b`} className={`bar${z.pct < 90 ? ' warn' : ''}`}><i style={{ width: `${z.pct}%` }} /></div>,
                    <span key={`${z.z}-v`} className="num">{z.pct} %</span>,
                  ])}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="dcard">
        <h3>Próximos 7 días <span className="sp" /><Link to="/vacaciones-bajas">Vacaciones y bajas</Link></h3>
        {c.proximos.length === 0 ? <div className="dash-empty">Nada previsto esta semana.</div> : (
          <div className="ev-list ev-wide">
            {c.proximos.map((p, i) => (
              <div key={i} className="ev-row">
                <span className="num ev-fecha">{new Date(`${p.k}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                <span className={`chip ${p.tipo[0]}`}>{p.tipo[1]}</span>
                <span className="ev-txt">{p.txt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Rol: {rol === 'admin' ? 'administración' : 'encargado/a'} · datos actualizados {hhmm(ahora)}</div>
    </div>
  );
}
