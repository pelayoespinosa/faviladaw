import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import CalendarioMensual from '../components/CalendarioMensual';
import { claveDia } from '../utils/calendarioGrid';
import { useAuth } from '../context/AuthContext';
import { resumenMensual } from '../utils/calendarioHoras';
import { calcHMesProrr } from '../constants/tareas';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPO_LABEL = { vacaciones: 'Vacaciones', baja: 'Baja' };
const MOTIVO_COLOR = {
  vacaciones:          { bg: 'var(--accent-lt)', color: 'var(--accent)' },
  baja:                { bg: 'color-mix(in srgb,var(--coral) 12%,transparent)', color: 'var(--coral)' },
  cobertura_cedida:    { bg: 'var(--amber-lt)', color: 'var(--amber)' },
  cobertura_recibida:  { bg: 'var(--amber-lt)', color: 'var(--amber)' },
};

const pad = n => String(n).padStart(2, '0');
const claveDesde = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function MiCalendario() {
  const { empleadoId } = useAuth();
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [turnos, setTurnos] = useState([]);
  const [turnosPorEmpleado, setTurnosPorEmpleado] = useState({});
  const [fichajesAnio, setFichajesAnio] = useState([]);
  const [ausencias, setAusencias] = useState([]);
  const [coberturas, setCoberturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  useEffect(() => {
    if (!empleadoId) { setLoading(false); return; }
    setLoading(true);
    const desde = claveDesde(new Date(mesActual.getFullYear(), 0, 1));
    const hasta = claveDesde(new Date(mesActual.getFullYear(), 11, 31));
    Promise.all([
      api.get('/turnos', { params: { empleado: empleadoId } }),
      api.get('/fichajes', { params: { desde, hasta } }),
      api.get('/calendario/ausencias', { params: { desde, hasta } }),
      api.get('/calendario/coberturas', { params: { desde, hasta } }),
    ]).then(async ([t, f, a, c]) => {
      setTurnos(t.data); setFichajesAnio(f.data); setAusencias(a.data); setCoberturas(c.data);
      const idsColegas = [...new Set(
        c.data.filter(cb => cb.empleado_cubre?._id === empleadoId).map(cb => cb.empleado_ausente?._id).filter(Boolean)
      )];
      const map = { [empleadoId]: t.data };
      if (idsColegas.length) {
        const resp = await Promise.all(idsColegas.map(id => api.get('/turnos', { params: { empleado: id } })));
        idsColegas.forEach((id, i) => { map[id] = resp[i].data; });
      }
      setTurnosPorEmpleado(map);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesActual.getFullYear(), empleadoId]);

  const cambiarMes = delta => setMesActual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const resumen = useMemo(() => {
    if (!empleadoId) return null;
    return resumenMensual({
      empleadoId, year: mesActual.getFullYear(), month: mesActual.getMonth(),
      turnos, turnosPorEmpleado, ausencias, coberturas,
    });
  }, [empleadoId, mesActual, turnos, turnosPorEmpleado, ausencias, coberturas]);

  const hContratadasMes = useMemo(
    () => +turnos.reduce((acc, t) => acc + calcHMesProrr(t), 0).toFixed(2),
    [turnos]
  );

  const hFichadasMes = useMemo(() => +fichajesAnio
    .filter(f => {
      const fecha = new Date(f.entrada.fecha_hora);
      return fecha.getFullYear() === mesActual.getFullYear() && fecha.getMonth() === mesActual.getMonth();
    })
    .reduce((acc, f) => acc + (f.duracion_horas || 0), 0)
    .toFixed(2), [fichajesAnio, mesActual]);

  const rejillaPorFecha = useMemo(() => {
    const map = {};
    (resumen?.rejilla || []).forEach(d => { map[d.fecha] = d; });
    return map;
  }, [resumen]);

  const diaClave = diaSeleccionado ? claveDia(diaSeleccionado) : null;
  const infoDia = diaClave ? rejillaPorFecha[diaClave] : null;
  const ausenciaDia = diaClave ? ausencias.find(a => diaClave >= a.fecha_inicio.slice(0, 10) && (!a.fecha_fin || diaClave <= a.fecha_fin.slice(0, 10))) : null;
  const coberturasDia = diaClave ? coberturas.filter(c => c.fecha.slice(0, 10) === diaClave) : [];

  return (
    <>
      <div className="filters-bar">
        <div className="filter-group">
          <div className="filter-label">Mes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-cancel" onClick={() => cambiarMes(-1)}>‹</button>
            <div style={{ fontSize: 13.5, fontWeight: 500, minWidth: 130, textAlign: 'center' }}>
              {MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
            </div>
            <button className="btn-cancel" onClick={() => cambiarMes(1)}>›</button>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-2)', alignSelf: 'center' }}>
          Contratadas: <strong>{hContratadasMes.toFixed(1)}h</strong> · Fichadas: <strong>{hFichadasMes}h</strong> · Calendario: <strong>{(resumen?.horasCalendario ?? 0).toFixed(1)}h</strong>
        </div>
      </div>

      {resumen?.incluyeNoSemanal && (
        <div style={{ marginBottom: 14, padding: '8px 14px', background: 'var(--amber-lt)', border: '1px solid color-mix(in srgb,var(--amber) 20%,transparent)', borderRadius: 8, fontSize: 12, color: 'var(--amber)' }}>
          Tienes turnos no semanales (quincenal, mensual, jardín…). Sus horas se incluyen en el total de "Calendario" pero no aparecen en un día concreto de la rejilla.
        </div>
      )}

      <div className="panel">
        {loading && <div className="empty-state"><div className="spinner" /></div>}
        {!loading && (
          <CalendarioMensual
            year={mesActual.getFullYear()} month={mesActual.getMonth()} hoy={hoy}
            onSelectDia={d => setDiaSeleccionado(d)}
            renderCelda={d => {
              const info = rejillaPorFecha[claveDia(d)];
              if (!info) return null;
              if (info.motivo) {
                const c = MOTIVO_COLOR[info.motivo] || { bg: 'var(--surface-2)', color: 'var(--text-2)' };
                const label = TIPO_LABEL[info.motivo] || (info.motivo === 'cobertura_cedida' ? 'Cede turno' : 'Cubre a otro');
                return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: c.bg, color: c.color, fontWeight: 600 }}>{label}</span>;
              }
              if (info.horasFinal > 0) return <span className="badge-hours">{info.horasFinal}h</span>;
              return null;
            }}
          />
        )}
      </div>

      {diaSeleccionado && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDiaSeleccionado(null); }}>
          <div className="modal-upload" style={{ maxWidth: 420 }}>
            <div className="modal-doc-header">
              <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>
                {diaSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
              <button className="modal-close" onClick={() => setDiaSeleccionado(null)}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13 }}>
                Horas previstas: <strong>{infoDia?.horasFinal ?? 0}h</strong>
              </div>
              {ausenciaDia && (
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{TIPO_LABEL[ausenciaDia.tipo]} del {ausenciaDia.fecha_inicio.slice(0, 10)} al {ausenciaDia.fecha_fin ? ausenciaDia.fecha_fin.slice(0, 10) : 'hoy (en curso)'}</div>
              )}
              {coberturasDia.map(c => (
                <div key={c._id} style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 500 }}>
                  🔶 {c.empleado_cubre?._id === empleadoId
                    ? `Cubres a ${c.empleado_ausente?.nombre_display}`
                    : `${c.empleado_cubre?.nombre_display} te cubre`}
                  {c.turno && (c.turno.cliente?.nombre || c.turno.furgoneta) && ` — ${c.turno.cliente?.nombre || 'furgoneta'}`}
                  {c.observaciones && ` — ${c.observaciones}`}
                </div>
              ))}
              {!ausenciaDia && !coberturasDia.length && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Día normal según tu horario.</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
