import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import CalendarioMensual from '../components/CalendarioMensual';
import { claveDia, generarCeldas } from '../utils/calendarioGrid';
import SearchSelect from '../components/SearchSelect';
import HorarioTramos from '../components/HorarioTramos';
import { TAREAS_LABEL } from '../constants/tareas';

const DIAS_L = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };
const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIA_DE_FECHA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function SelectorDias({ value, onChange, originales }) {
  const toggle = d => onChange(value.includes(d) ? value.filter(x => x !== d) : DIAS_ORDEN.filter(x => x === d || value.includes(x)));
  return (
    <div className="filter-group" style={{ minWidth: 0 }}>
      <span className="filter-label">Días que va <span style={{ color: 'var(--coral)' }}>*</span></span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {DIAS_ORDEN.map(d => {
          const on = value.includes(d);
          return (
            <button key={d} type="button" className="pill-toggle" aria-pressed={on} onClick={() => toggle(d)} style={{
              background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--on-accent)' : 'var(--text-2)',
              borderColor: on ? 'var(--accent)' : 'var(--border-2)', fontWeight: on ? 700 : 400,
            }}>{DIAS_L[d]}</button>
          );
        })}
      </div>
      {originales?.length > 0 && (
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          En el turno original: {originales.map(d => DIAS_L[d]).join(', ')}.{' '}
          <button type="button" onClick={() => onChange([...originales])} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent-ink)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>Usar los mismos</button>
        </span>
      )}
    </div>
  );
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPO_LABEL = { vacaciones: 'Vacaciones', baja: 'Baja' };
const TIPO_AUSENCIA_ITEMS = Object.entries(TIPO_LABEL).map(([_id, nombre]) => ({ _id, nombre }));
const TIPO_COLOR = {
  vacaciones: { bg: 'var(--amber-lt)', color: 'var(--amber)' },
  baja:       { bg: 'color-mix(in srgb,var(--coral) 12%,transparent)', color: 'var(--coral)' },
};

const emptyForm = { empleado: '', tipo: 'vacaciones', fecha_inicio: '', fecha_fin: '', observaciones: '' };

const pad = n => String(n).padStart(2, '0');
const claveDesde = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const cubreFecha = (a, k) => k >= a.fecha_inicio.slice(0, 10) && (!a.fecha_fin || k <= a.fecha_fin.slice(0, 10));

const pillTipo = kind => ({
  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
  background: kind === 'baja' ? 'color-mix(in srgb,var(--coral) 12%,transparent)' : 'var(--amber-lt)',
  color: kind === 'baja' ? 'var(--coral)' : 'var(--amber)',
});
const pillToggle = activo => ({
  background: activo ? 'var(--accent)' : 'transparent',
  color: activo ? 'var(--on-accent)' : 'var(--text-2)',
  borderColor: activo ? 'var(--accent)' : 'var(--border-2)',
});

function CoberturaBadge({ cobertura }) {
  if (!cobertura) return null;
  if (cobertura.estado === 'sin_turnos') return <span className="chip nod" title="No tiene turnos semanales en estas fechas">Sin turnos</span>;
  const detalle = `${cobertura.turnos_cubiertos} de ${cobertura.turnos} ${cobertura.turnos === 1 ? 'turno cubierto' : 'turnos cubiertos'} por completo`;
  if (cobertura.estado === 'cubierta') return <span className="chip ok" title={detalle}>Cubierta</span>;
  if (cobertura.estado === 'parcial') return <span className="chip warn" title={detalle}>{cobertura.pct} % cubierto</span>;
  return <span className="chip crit" title={detalle}>Sin cubrir</span>;
}

function TipoBadge({ tipo }) {
  const c = TIPO_COLOR[tipo] || { bg: 'var(--surface-2)', color: 'var(--text-2)' };
  return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>{TIPO_LABEL[tipo] || tipo}</span>;
}

export default function VacacionesBajas() {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const anio = mesActual.getFullYear();
  const [vista, setVista] = useState(() => {
    try { return localStorage.getItem('vacBajasVista') || 'anio'; } catch { return 'anio'; }
  });
  useEffect(() => {
    try { localStorage.setItem('vacBajasVista', vista); } catch {  }
  }, [vista]);
  const [empleados, setEmpleados] = useState([]);
  const [empleadoFiltro, setEmpleadoFiltro] = useState('');
  const [ausencias, setAusencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [formDia, setFormDia] = useState(emptyForm);
  const [errorDia, setErrorDia] = useState('');

  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState(emptyForm);
  const [errorEdit, setErrorEdit] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const [cubriendo, setCubriendo] = useState(null);
  const [turnosCubrir, setTurnosCubrir] = useState([]);
  const [coberturasCubrir, setCoberturasCubrir] = useState([]);
  const [cargandoCubrir, setCargandoCubrir] = useState(false);
  const [asignacion, setAsignacion] = useState({});
  const [errorCubrir, setErrorCubrir] = useState('');
  const [okCubrir, setOkCubrir] = useState('');
  const [modoCubrir, setModoCubrir] = useState('uno');
  const [global, setGlobal] = useState({ empleado_cubre: '', desde: '', hasta: '', observaciones: '' });
  const [guardandoCubrir, setGuardandoCubrir] = useState(false);

  const pedirAusencias = () => api.get('/calendario/ausencias', { params: {
    desde: claveDesde(new Date(mesActual.getFullYear(), 0, 1)),
    hasta: claveDesde(new Date(mesActual.getFullYear(), 11, 31)),
    empleado: 'todos', cobertura: '1',
  } });

  const cargarAnio = () => {
    setLoading(true);
    Promise.all([api.get('/empleados'), pedirAusencias()]).then(([e, a]) => {
      setEmpleados(e.data);
      setAusencias(a.data);
    }).finally(() => setLoading(false));
  };

  const refrescarCobertura = () => pedirAusencias().then(a => {
    setAusencias(a.data);
    setCubriendo(c => (c && a.data.find(x => x._id === c._id)) || c);
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarAnio(); }, [anio]);

  const cambiarMes = delta => setMesActual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const cambiarAnio = delta => setMesActual(m => new Date(m.getFullYear() + delta, m.getMonth(), 1));
  const abrirMes = m => { setMesActual(new Date(anio, m, 1)); setVista('mes'); };

  const contadoresPorFecha = useMemo(() => {
    const map = {};
    const celdas = generarCeldas(mesActual.getFullYear(), mesActual.getMonth());
    celdas.forEach(d => {
      const k = claveDia(d);
      const delDia = ausencias.filter(a => cubreFecha(a, k));
      if (delDia.length) {
        map[k] = { total: delDia.length, nBaja: delDia.filter(a => a.tipo === 'baja').length };
      }
    });
    return map;
  }, [ausencias, mesActual]);

  const resumenAnual = useMemo(() => {
    const y = mesActual.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const mesIni = `${y}-${pad(m + 1)}-01`;
      const mesFin = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
      const solapan = ausencias.filter(a =>
        a.fecha_inicio.slice(0, 10) <= mesFin && (!a.fecha_fin || a.fecha_fin.slice(0, 10) >= mesIni));

      const vac = new Set(), baj = new Set();
      solapan.forEach(a => {
        const id = a.empleado?._id || a.empleado;
        (a.tipo === 'baja' ? baj : vac).add(id);
      });

      let diasVac = 0, diasBaja = 0;
      if (empleadoFiltro) {
        solapan.filter(a => (a.empleado?._id || a.empleado) === empleadoFiltro).forEach(a => {
          const ini = a.fecha_inicio.slice(0, 10) < mesIni ? mesIni : a.fecha_inicio.slice(0, 10);
          const finRaw = a.fecha_fin ? a.fecha_fin.slice(0, 10) : mesFin;
          const fin = finRaw > mesFin ? mesFin : finRaw;
          const n = Math.round((new Date(fin) - new Date(ini)) / 86400000) + 1;
          if (a.tipo === 'baja') diasBaja += n; else diasVac += n;
        });
      }
      return { mes: m, vacaciones: vac.size, bajas: baj.size, diasVac, diasBaja };
    });
  }, [ausencias, mesActual, empleadoFiltro]);

  const totalesAnio = useMemo(() => {
    const vac = new Set(), baj = new Set();
    ausencias.forEach(a => {
      const id = a.empleado?._id || a.empleado;
      (a.tipo === 'baja' ? baj : vac).add(id);
    });
    return { vac: vac.size, baj: baj.size };
  }, [ausencias]);

  const ausenciaEmpleadoPorFecha = (k) => empleadoFiltro
    ? ausencias.find(a => a.empleado?._id === empleadoFiltro && cubreFecha(a, k))
    : null;

  const abrirDia = d => {
    setDiaSeleccionado(d);
    const k = claveDia(d);
    setFormDia({ ...emptyForm, empleado: empleadoFiltro || '', fecha_inicio: k, fecha_fin: k });
    setErrorDia('');
  };

  const diaClave = diaSeleccionado ? claveDia(diaSeleccionado) : null;
  const ausenciasDelDia = diaClave
    ? ausencias.filter(a => cubreFecha(a, diaClave) && (!empleadoFiltro || a.empleado?._id === empleadoFiltro))
    : [];

  const ausenciasLista = useMemo(() => {
    return ausencias
      .filter(a => !empleadoFiltro || a.empleado?._id === empleadoFiltro)
      .slice()
      .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  }, [ausencias, empleadoFiltro]);

  const guardar = async () => {
    if (!form.empleado) return setError('Selecciona un empleado');
    if (form.tipo === 'vacaciones' && !form.fecha_fin) return setError('Indica la fecha de fin');
    setGuardando(true);
    try {
      await api.post('/calendario/ausencias', form);
      setError(''); cargarAnio();
      setForm(f => ({ ...emptyForm, tipo: f.tipo }));
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const guardarDia = async () => {
    if (!formDia.empleado) return setErrorDia('Selecciona un empleado');
    if (formDia.tipo === 'vacaciones' && !formDia.fecha_fin) return setErrorDia('Indica la fecha de fin');
    try {
      await api.post('/calendario/ausencias', formDia);
      setErrorDia(''); cargarAnio();
      setFormDia(f => ({ ...f, empleado: '' }));
    } catch (e) { setErrorDia(e.response?.data?.error || 'Error al guardar'); }
  };

  const eliminar = async id => {
    if (!window.confirm('¿Eliminar este período?')) return;
    await api.delete(`/calendario/ausencias/${id}`);
    cargarAnio();
  };

  const abrirEditar = a => {
    setEditando(a);
    setFormEdit({
      empleado: a.empleado?._id || a.empleado,
      tipo: a.tipo,
      fecha_inicio: a.fecha_inicio.slice(0, 10),
      fecha_fin: a.fecha_fin ? a.fecha_fin.slice(0, 10) : '',
      observaciones: a.observaciones || '',
    });
    setErrorEdit('');
  };

  const guardarEdicion = async () => {
    if (!formEdit.empleado) return setErrorEdit('Selecciona un empleado');
    if (formEdit.tipo === 'vacaciones' && !formEdit.fecha_fin) return setErrorEdit('Indica la fecha de fin');
    setGuardandoEdit(true);
    try {
      await api.put(`/calendario/ausencias/${editando._id}`, formEdit);
      setEditando(null); cargarAnio();
    } catch (e) {
      setErrorEdit(e.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardandoEdit(false);
    }
  };

  const rangoPeriodo = a => ({
    empleado: a.empleado?._id || a.empleado,
    desde: a.fecha_inicio.slice(0, 10),
    ...(a.fecha_fin ? { hasta: a.fecha_fin.slice(0, 10) } : {}),
  });

  const abrirCubrir = a => {
    setCubriendo(a);
    setErrorCubrir('');
    setOkCubrir('');
    setModoCubrir('uno');
    setGlobal({ empleado_cubre: '', desde: a.fecha_inicio.slice(0, 10), hasta: a.fecha_fin ? a.fecha_fin.slice(0, 10) : '', observaciones: '' });
    setCargandoCubrir(true);
    const empleadoId = a.empleado?._id || a.empleado;
    const desde = a.fecha_inicio.slice(0, 10);
    const hastaDefault = a.fecha_fin ? a.fecha_fin.slice(0, 10) : '';
    Promise.all([
      api.get('/turnos', { params: { empleado: empleadoId } }),
      api.get('/calendario/coberturas', { params: rangoPeriodo(a) }),
    ]).then(([t, c]) => {
      const semanales = t.data.filter(x => x.frecuencia === 'semanal' && (x.dias_semana || []).length);
      setTurnosCubrir(semanales);
      setCoberturasCubrir(c.data.filter(x => (x.empleado_ausente?._id || x.empleado_ausente) === empleadoId));
      const init = {};
      semanales.forEach(t => { init[t._id] = { empleado_cubre: '', desde, hasta: hastaDefault, observaciones: '', dias_semana: [] }; });
      setAsignacion(init);
    }).finally(() => setCargandoCubrir(false));
  };

  const recargarCubrir = () => {
    if (!cubriendo) return;
    const empleadoId = cubriendo.empleado?._id || cubriendo.empleado;
    api.get('/calendario/coberturas', { params: rangoPeriodo(cubriendo) })
      .then(c => setCoberturasCubrir(c.data.filter(x => (x.empleado_ausente?._id || x.empleado_ausente) === empleadoId)));
    refrescarCobertura();
  };

  const nombreTurno = t => (t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : (t.cliente?.alias || t.cliente?.nombre || 'Turno'));

  const asignarTurno = async turnoId => {
    const a = asignacion[turnoId];
    const t = turnosCubrir.find(x => x._id === turnoId);
    setOkCubrir('');
    if (!a?.empleado_cubre) return setErrorCubrir(`${nombreTurno(t)}: selecciona quién lo cubre`);
    if (!a.desde || !a.hasta) return setErrorCubrir(`${nombreTurno(t)}: indica el rango de fechas a cubrir`);
    if (!a.dias_semana?.length) return setErrorCubrir(`${nombreTurno(t)}: marca los días de la semana en los que va la persona que cubre`);
    setGuardandoCubrir(true);
    try {
      const r = await api.post('/calendario/coberturas/asignar-turno', {
        turno: turnoId, empleado_cubre: a.empleado_cubre, desde: a.desde, hasta: a.hasta, dias_semana: a.dias_semana, observaciones: a.observaciones,
      });
      setErrorCubrir('');
      setOkCubrir(`${nombreTurno(t)}: cobertura guardada (${r.data.dias} días).`);
      recargarCubrir();
    } catch (e) { setErrorCubrir(e.response?.data?.error || 'Error al asignar'); }
    finally { setGuardandoCubrir(false); }
  };

  const asignarTodos = async () => {
    setOkCubrir('');
    if (!global.empleado_cubre) return setErrorCubrir('Selecciona quién cubre todos los turnos');
    if (!global.desde || !global.hasta) return setErrorCubrir('Indica el rango de fechas a cubrir');
    const sinDias = turnosCubrir.filter(t => !(asignacion[t._id]?.dias_semana || []).length);
    if (sinDias.length) return setErrorCubrir(`Marca los días que va en: ${sinDias.map(nombreTurno).join(', ')}`);
    setGuardandoCubrir(true);
    try {
      const r = await api.post('/calendario/coberturas/asignar-turnos', {
        asignaciones: turnosCubrir.map(t => ({
          turno: t._id, empleado_cubre: global.empleado_cubre, desde: global.desde, hasta: global.hasta,
          dias_semana: asignacion[t._id].dias_semana, observaciones: global.observaciones,
        })),
      });
      setErrorCubrir('');
      setOkCubrir(`Cobertura guardada en ${turnosCubrir.length} ${turnosCubrir.length === 1 ? 'sitio' : 'sitios'} (${r.data.dias} días).`);
      recargarCubrir();
    } catch (e) { setErrorCubrir(e.response?.data?.error || 'Error al asignar'); }
    finally { setGuardandoCubrir(false); }
  };

  const setDiasTurno = (turnoId, dias) => setAsignacion(s => ({ ...s, [turnoId]: { ...s[turnoId], dias_semana: dias } }));

  const quitarCobertura = async (turnoId, desde, hasta) => {
    if (!window.confirm('¿Quitar esta cobertura?')) return;
    await api.delete(`/calendario/coberturas/turno/${turnoId}`, { params: { desde, hasta } });
    recargarCubrir();
  };

  const segmentosCobertura = turnoId => {
    const regs = coberturasCubrir
      .filter(c => (c.turno?._id || c.turno) === turnoId)
      .slice().sort((x, y) => x.fecha.localeCompare(y.fecha));
    const segmentos = [];
    regs.forEach(c => {
      const idCubre = c.empleado_cubre?._id || c.empleado_cubre;
      const fecha = c.fecha.slice(0, 10);
      const ultimo = segmentos[segmentos.length - 1];
      const dia = DIA_DE_FECHA[new Date(`${fecha}T00:00:00Z`).getUTCDay()];
      if (ultimo && ultimo.idCubre === idCubre) { ultimo.hasta = fecha; ultimo.dias.add(dia); }
      else segmentos.push({ idCubre, nombre: c.empleado_cubre?.nombre_display || '—', desde: fecha, hasta: fecha, dias: new Set([dia]) });
    });
    return segmentos.map(sg => ({ ...sg, dias: DIAS_ORDEN.filter(d => sg.dias.has(d)) }));
  };

  return (
    <>
      <div className="filters-bar">
        <SearchSelect label="Empleado" items={empleados} value={empleadoFiltro}
          onChange={setEmpleadoFiltro} placeholder="Todos (buscar empleado…)" />
        <div className="filter-group">
          <div className="filter-label">Vista</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="pill-toggle" style={pillToggle(vista === 'anio')} onClick={() => setVista('anio')}>Año</button>
            <button className="pill-toggle" style={pillToggle(vista === 'mes')} onClick={() => setVista('mes')}>Mes</button>
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">{vista === 'anio' ? 'Año' : 'Mes'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-cancel" onClick={() => (vista === 'anio' ? cambiarAnio(-1) : cambiarMes(-1))}>‹</button>
            <div style={{ fontSize: 13.5, fontWeight: 500, minWidth: vista === 'anio' ? 56 : 130, textAlign: 'center' }}>
              {vista === 'anio' ? anio : `${MESES[mesActual.getMonth()]} ${mesActual.getFullYear()}`}
            </div>
            <button className="btn-cancel" onClick={() => (vista === 'anio' ? cambiarAnio(1) : cambiarMes(1))}>›</button>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignSelf: 'center', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--amber)', display: 'inline-block' }} /> Vacaciones
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--coral)', display: 'inline-block' }} /> Baja
          </span>
        </div>
      </div>

      <div className="panel">
        {loading && <div className="empty-state"><div className="spinner" /></div>}

        {!loading && vista === 'mes' && (
          <CalendarioMensual
            year={mesActual.getFullYear()} month={mesActual.getMonth()} hoy={hoy}
            onSelectDia={abrirDia}
            renderCelda={d => {
              const k = claveDia(d);
              if (empleadoFiltro) {
                const a = ausenciaEmpleadoPorFecha(k);
                if (!a) return null;
                return <TipoBadge tipo={a.tipo} />;
              }
              const cont = contadoresPorFecha[k];
              if (!cont) return null;
              const color = cont.nBaja > 0 ? 'var(--coral)' : 'var(--amber)';
              const bg = cont.nBaja > 0 ? 'color-mix(in srgb,var(--coral) 12%,transparent)' : 'var(--amber-lt)';
              return <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: bg, color }}>{cont.total}</span>;
            }}
          />
        )}

        {!loading && vista === 'anio' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <div className="panel-title" style={{ margin: 0 }}>Resumen {anio}</div>
              {empleadoFiltro ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--amber)' }}>{resumenAnual.reduce((s, r) => s + r.diasVac, 0)}</strong> días de vacaciones
                  {resumenAnual.some(r => r.diasBaja > 0) && <> · <strong style={{ color: 'var(--coral)' }}>{resumenAnual.reduce((s, r) => s + r.diasBaja, 0)}</strong> de baja</>}
                  {' '}en el año
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  <strong style={{ color: 'var(--amber)' }}>{totalesAnio.vac}</strong> {totalesAnio.vac === 1 ? 'persona' : 'personas'} con vacaciones
                  {totalesAnio.baj > 0 && <> · <strong style={{ color: 'var(--coral)' }}>{totalesAnio.baj}</strong> con baja</>}
                  {' '}en el año
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 10 }}>
              {resumenAnual.map(r => {
                const esMesEnCurso = r.mes === hoy.getMonth() && anio === hoy.getFullYear();
                return (
                  <button key={r.mes} onClick={() => abrirMes(r.mes)} title={`Ver ${MESES[r.mes]} en detalle`}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8, padding: '13px 14px 15px', minHeight: 96,
                      borderRadius: 12, border: `1px solid ${esMesEnCurso ? 'var(--accent)' : 'var(--border)'}`,
                      background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--f-ui)',
                    }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {MESES[r.mes]}
                    </span>

                    {empleadoFiltro ? (
                      (r.diasVac + r.diasBaja) === 0
                        ? <span style={{ fontSize: 13, color: 'var(--text-3)' }}>—</span>
                        : <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {r.diasVac > 0 && <span style={pillTipo('vacaciones')}>{r.diasVac} {r.diasVac === 1 ? 'día' : 'días'} vac.</span>}
                            {r.diasBaja > 0 && <span style={pillTipo('baja')}>{r.diasBaja} {r.diasBaja === 1 ? 'día' : 'días'} baja</span>}
                          </span>
                    ) : (
                      <>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: r.vacaciones ? 'var(--amber)' : 'var(--text-3)' }}>
                            {r.vacaciones}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{r.vacaciones === 1 ? 'persona' : 'personas'}</span>
                        </span>
                        {r.bajas > 0 && (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--coral)' }}>
                            {r.bajas} {r.bajas === 1 ? 'baja' : 'bajas'}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12 }}>
              {empleadoFiltro
                ? 'Días de ausencia del empleado en cada mes. Pulsa un mes para ver el detalle diario.'
                : 'Personas distintas de vacaciones que solapan cada mes. Pulsa un mes para ver el detalle diario.'}
            </div>
          </>
        )}
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-title">Asignar vacaciones o baja</div>
        <div className="form-row-fields" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <SearchSelect label="Empleado" items={empleados} value={form.empleado}
            onChange={v => setForm(f => ({ ...f, empleado: v }))} placeholder="Buscar empleado…" required />
          <div className="filter-group">
            <span className="filter-label">Tipo</span>
            <select className="filter-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="vacaciones">Vacaciones</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div className="filter-group">
            <span className="filter-label">Desde</span>
            <input type="date" className="filter-input" value={form.fecha_inicio}
              onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
          </div>
          <div className="filter-group">
            <span className="filter-label">Hasta{form.tipo === 'baja' ? ' (opcional)' : ''}</span>
            <input type="date" className="filter-input" value={form.fecha_fin}
              onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
          </div>
          <div className="filter-group" style={{ flex: 1, minWidth: 200 }}>
            <span className="filter-label">Observaciones</span>
            <input className="filter-input" style={{ width: '100%' }} placeholder="Opcional" value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
          <button className="btn-save" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Asignar'}</button>
        </div>
        {form.tipo === 'baja' && !form.fecha_fin && (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
            Si aún no se sabe cuándo termina, deja "Hasta" en blanco — luego podrás fijar la fecha de alta con "Modificar".
          </div>
        )}
        {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="data-table">
          <thead><tr>{['Empleado', 'Tipo', 'Desde', 'Hasta', 'Cobertura', 'Observaciones', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {!loading && ausenciasLista.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <div className="empty-state-icon">🌴</div>
                  <div className="empty-state-text">Sin vacaciones ni bajas registradas</div>
                </div>
              </td></tr>
            )}
            {ausenciasLista.map(a => (
              <tr key={a._id} className="row-parent" style={{ cursor: 'default' }}>
                <td data-label="Empleado">{a.empleado?.nombre_display || '—'}</td>
                <td data-label="Tipo"><TipoBadge tipo={a.tipo} /></td>
                <td data-label="Desde" className="cell-mono">{a.fecha_inicio.slice(0, 10)}</td>
                <td data-label="Hasta" className="cell-mono">
                  {a.fecha_fin ? a.fecha_fin.slice(0, 10) : <span style={{ color: 'var(--coral)', fontWeight: 600 }}>En curso</span>}
                </td>
                <td data-label="Cobertura"><CoberturaBadge cobertura={a.cobertura} /></td>
                <td data-label="Observaciones" className="cell-muted" style={{ fontSize: 12 }}>{a.observaciones || '—'}</td>
                <td data-label="Acciones" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn-edit" onClick={() => abrirCubrir(a)}>Cubrir</button>
                  <button className="btn-cancel" onClick={() => abrirEditar(a)}>Modificar</button>
                  <button className="btn-delete" onClick={() => eliminar(a._id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {diaSeleccionado && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDiaSeleccionado(null); }}>
          <div className="modal-upload" style={{ maxWidth: 560 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>
                {diaSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <button className="modal-close" onClick={() => setDiaSeleccionado(null)}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ausenciasDelDia.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ausenciasDelDia.map(a => (
                    <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.empleado?.nombre_display}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><TipoBadge tipo={a.tipo} /> · {a.fecha_inicio.slice(0, 10)} — {a.fecha_fin ? a.fecha_fin.slice(0, 10) : 'en curso'} <CoberturaBadge cobertura={a.cobertura} /></div>
                        {a.observaciones && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{a.observaciones}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-edit" onClick={() => abrirCubrir(a)}>Cubrir</button>
                        <button className="btn-cancel" onClick={() => abrirEditar(a)}>Modificar</button>
                        <button className="btn-delete" onClick={() => eliminar(a._id)}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {ausenciasDelDia.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Ningún empleado de vacaciones o baja este día.</div>
              )}

              <div>
                <div className="panel-title" style={{ fontSize: 13 }}>Añadir vacaciones / baja este día</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SearchSelect label="Empleado" items={empleados} value={formDia.empleado}
                    onChange={v => setFormDia(f => ({ ...f, empleado: v }))} placeholder="Buscar empleado…" required />
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <SearchSelect label="Tipo" items={TIPO_AUSENCIA_ITEMS} value={formDia.tipo}
                        onChange={v => setFormDia(f => ({ ...f, tipo: v }))} placeholder="Buscar tipo…" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Desde</label>
                      <input type="date" className="form-input" value={formDia.fecha_inicio}
                        onChange={e => setFormDia(f => ({ ...f, fecha_inicio: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Hasta{formDia.tipo === 'baja' ? ' (opcional)' : ''}</label>
                      <input type="date" className="form-input" value={formDia.fecha_fin}
                        onChange={e => setFormDia(f => ({ ...f, fecha_fin: e.target.value }))} />
                    </div>
                  </div>
                  <input className="form-input" placeholder="Observaciones (opcional)" value={formDia.observaciones}
                    onChange={e => setFormDia(f => ({ ...f, observaciones: e.target.value }))} />
                  <button className="btn-save" onClick={guardarDia}>Guardar</button>
                </div>
                {errorDia && <div className="error-msg" style={{ marginTop: 10 }}>{errorDia}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div className="modal-upload" style={{ maxWidth: 480 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>Modificar período</div>
              <button className="modal-close" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SearchSelect label="Empleado" items={empleados} value={formEdit.empleado}
                onChange={v => setFormEdit(f => ({ ...f, empleado: v }))} placeholder="Buscar empleado…" required />
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <SearchSelect label="Tipo" items={TIPO_AUSENCIA_ITEMS} value={formEdit.tipo}
                    onChange={v => setFormEdit(f => ({ ...f, tipo: v }))} placeholder="Buscar tipo…" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Desde</label>
                  <input type="date" className="form-input" value={formEdit.fecha_inicio}
                    onChange={e => setFormEdit(f => ({ ...f, fecha_inicio: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Hasta{formEdit.tipo === 'baja' ? ' (opcional)' : ''}</label>
                  <input type="date" className="form-input" value={formEdit.fecha_fin}
                    onChange={e => setFormEdit(f => ({ ...f, fecha_fin: e.target.value }))} />
                </div>
              </div>
              {formEdit.tipo === 'baja' && (
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  Deja "Hasta" en blanco mientras la baja siga en curso; ponla cuando se conceda el alta.
                </div>
              )}
              <input className="form-input" placeholder="Observaciones (opcional)" value={formEdit.observaciones}
                onChange={e => setFormEdit(f => ({ ...f, observaciones: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-cancel" onClick={() => setEditando(null)}>Cancelar</button>
                <button className="btn-save" disabled={guardandoEdit} onClick={guardarEdicion}>
                  {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
              {errorEdit && <div className="error-msg">{errorEdit}</div>}
            </div>
          </div>
        </div>
      )}

      {cubriendo && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCubriendo(null); }}>
          <div className="modal-upload" style={{ maxWidth: 720 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>
                Cubrir turnos — {cubriendo.empleado?.nombre_display || '—'}
              </div>
              <button className="modal-close" onClick={() => setCubriendo(null)}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <TipoBadge tipo={cubriendo.tipo} /> · {cubriendo.fecha_inicio.slice(0, 10)} — {cubriendo.fecha_fin ? cubriendo.fecha_fin.slice(0, 10) : 'en curso'}
                <CoberturaBadge cobertura={cubriendo.cobertura} />
                {cubriendo.cobertura?.turnos > 0 && (
                  <span style={{ color: 'var(--text-3)' }}>
                    {cubriendo.cobertura.turnos_cubiertos} de {cubriendo.cobertura.turnos} {cubriendo.cobertura.turnos === 1 ? 'turno cubierto' : 'turnos cubiertos'} por completo
                    {!cubriendo.fecha_fin && ' (hasta hoy)'}
                  </span>
                )}
              </div>

              {cargandoCubrir && <div className="empty-state"><div className="spinner" /></div>}

              {!cargandoCubrir && turnosCubrir.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Este empleado no tiene turnos semanales que cubrir.</div>
              )}

              {!cargandoCubrir && turnosCubrir.length > 0 && (
                <div className="seg" role="group" aria-label="Cómo cubrir" style={{ alignSelf: 'flex-start' }}>
                  <button type="button" aria-pressed={modoCubrir === 'uno'} onClick={() => { setModoCubrir('uno'); setErrorCubrir(''); setOkCubrir(''); }}>Todo a una persona</button>
                  <button type="button" aria-pressed={modoCubrir === 'varios'} onClick={() => { setModoCubrir('varios'); setErrorCubrir(''); setOkCubrir(''); }}>Repartir entre varias</button>
                </div>
              )}

              {!cargandoCubrir && turnosCubrir.length > 0 && modoCubrir === 'uno' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--surface-2)', borderRadius: 10, padding: 12 }}>
                  <SearchSelect label="Cubre todos los turnos" items={empleados.filter(e => e._id !== (cubriendo.empleado?._id || cubriendo.empleado))}
                    value={global.empleado_cubre} onChange={v => setGlobal(g => ({ ...g, empleado_cubre: v }))} placeholder="Buscar empleado…" required />
                  <div className="filter-group">
                    <span className="filter-label">Desde</span>
                    <input type="date" className="filter-input" value={global.desde} onChange={e => setGlobal(g => ({ ...g, desde: e.target.value }))} />
                  </div>
                  <div className="filter-group">
                    <span className="filter-label">Hasta</span>
                    <input type="date" className="filter-input" value={global.hasta} onChange={e => setGlobal(g => ({ ...g, hasta: e.target.value }))} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', flexBasis: '100%' }}>Marca abajo, en cada sitio, los días de la semana en los que irá. Sustituyen a los del turno original mientras dure la cobertura.</div>
                </div>
              )}

              {!cargandoCubrir && turnosCubrir.map(t => {
                const dias = [...(t.dias_semana || [])].sort((a, b) => DIAS_ORDEN.indexOf(a) - DIAS_ORDEN.indexOf(b));
                const segmentos = segmentosCobertura(t._id);
                const asig = asignacion[t._id] || {};
                const empleadoAusenteId = cubriendo.empleado?._id || cubriendo.empleado;
                const pctTurno = cubriendo.cobertura?.detalle?.find(d => d.turno === t._id)?.pct;
                return (
                  <div key={t._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{t.furgoneta ? `Furgoneta ${t.furgoneta.numero}` : (t.cliente?.nombre || '—')}{t.cliente?.sucursal ? ` · ${t.cliente.sucursal}` : ''}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {TAREAS_LABEL[t.tipo_tarea] || t.tipo_tarea}
                          {pctTurno != null && (pctTurno === 100
                            ? <span className="chip ok">Cubierto</span>
                            : pctTurno > 0 ? <span className="chip warn">{pctTurno} % cubierto</span>
                            : <span className="chip crit">Sin cubrir</span>)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="days-wrap">{dias.map(d => <span key={d} className="day-pill">{DIAS_L[d]}</span>)}</div>
                        <div style={{ marginTop: 4 }}><HorarioTramos tramos={t.tramos} /></div>
                      </div>
                    </div>

                    {segmentos.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {segmentos.map((sg, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12, background: 'var(--amber-lt)', color: 'var(--amber)', borderRadius: 6, padding: '4px 8px' }}>
                            <span>🔶 Cubre <strong>{sg.nombre}</strong> del {sg.desde} al {sg.hasta} · {sg.dias.map(d => DIAS_L[d]).join(', ')}</span>
                            <button className="btn-delete" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => quitarCobertura(t._id, sg.desde, sg.hasta)}>Quitar</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
                      {modoCubrir === 'varios' && (<>
                        <SearchSelect label="Cubre" items={empleados.filter(e => e._id !== empleadoAusenteId)}
                          value={asig.empleado_cubre || ''} onChange={v => setAsignacion(s => ({ ...s, [t._id]: { ...s[t._id], empleado_cubre: v } }))}
                          placeholder="Buscar empleado…" required />
                        <div className="filter-group">
                          <span className="filter-label">Desde</span>
                          <input type="date" className="filter-input" value={asig.desde || ''}
                            onChange={e => setAsignacion(s => ({ ...s, [t._id]: { ...s[t._id], desde: e.target.value } }))} />
                        </div>
                        <div className="filter-group">
                          <span className="filter-label">Hasta</span>
                          <input type="date" className="filter-input" value={asig.hasta || ''}
                            onChange={e => setAsignacion(s => ({ ...s, [t._id]: { ...s[t._id], hasta: e.target.value } }))} />
                        </div>
                      </>)}
                      <SelectorDias value={asig.dias_semana || []} onChange={v => setDiasTurno(t._id, v)} originales={dias} />
                      {modoCubrir === 'varios' && <button className="btn-save" disabled={guardandoCubrir} onClick={() => asignarTurno(t._id)}>Asignar</button>}
                    </div>
                  </div>
                );
              })}

              {!cargandoCubrir && turnosCubrir.length > 0 && modoCubrir === 'uno' && (
                <button className="btn-save" style={{ alignSelf: 'flex-end' }} disabled={guardandoCubrir} onClick={asignarTodos}>
                  {guardandoCubrir ? 'Guardando…' : turnosCubrir.length === 1 ? 'Asignar el turno' : `Asignar los ${turnosCubrir.length} turnos`}
                </button>
              )}

              {okCubrir && <div style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 700 }}>✓ {okCubrir}</div>}
              {errorCubrir && <div className="error-msg">{errorCubrir}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
