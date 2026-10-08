import { useEffect, useState } from 'react';
import api from '../api/axios';
import SearchSelect from '../components/SearchSelect';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const fInput = d => d ? new Date(d).toISOString().slice(0, 10) : '';
const fFecha = d => d ? new Date(d).toLocaleDateString('es-ES') : '—';

async function descargar(url, filename) {
  const r = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = blobUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(blobUrl);
}

const CAMPOS_IDENTIDAD = ['nombre', 'nif', 'naf', 'fecha_alta', 'ctto', 'categoria'];
const CAMPOS_EDITABLES = ['horario_base', 'dias_semana',
  'plus_transporte', 'plus_festivo', 'plus_penosidad', 'plus_nocturnidad',
  'semana1', 'semana2', 'semana3', 'semana4', 'semana5', 'observaciones'];

const DIAS_CORTOS = [['lunes', 'L'], ['martes', 'M'], ['miercoles', 'X'], ['jueves', 'J'], ['viernes', 'V'], ['sabado', 'S'], ['domingo', 'D']];

const NUMERICOS = new Set(['horario_base', 'dias_semana', 'plus_transporte', 'plus_festivo', 'plus_penosidad', 'plus_nocturnidad',
  'semana1', 'semana2', 'semana3', 'semana4', 'semana5']);

const GRUPOS = [
  { key: 'sin_variaciones', titulo: 'Sin variaciones', sufijo: '-sin-variaciones' },
  { key: 'con_variaciones', titulo: 'Con variaciones', sufijo: '-con-variaciones' },
];

function TablaCuadro({ cuadro, setCuadro, setError }) {
  const cambiarCelda = (filaId, campo, valor) => {
    setCuadro(c => ({ ...c, filas: c.filas.map(f => f._id === filaId ? { ...f, [campo]: valor } : f) }));
  };

  const guardarFila = async filaId => {
    const fila = cuadro.filas.find(f => f._id === filaId);
    if (!fila) return;
    const campos = fila.empleado ? CAMPOS_EDITABLES : CAMPOS_EDITABLES.concat(CAMPOS_IDENTIDAD);
    const payload = {};
    for (const campo of campos) {
      let v = fila[campo];
      if (NUMERICOS.has(campo)) v = (v === '' || v == null) ? null : parseFloat(v);
      payload[campo] = v;
    }
    if ('fecha_alta' in payload) payload.fecha_alta = fila.fecha_alta ? fila.fecha_alta : null;
    try {
      const { data } = await api.put(`/cuadro-laboral/${cuadro._id}/filas/${filaId}`, payload);
      const guardada = data.filas.find(f => f._id === filaId);
      if (guardada) cambiarCelda(filaId, 'plus_transporte', guardada.plus_transporte);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar la fila');
    }
  };

  const resincronizar = async filaId => {
    try {
      const { data } = await api.post(`/cuadro-laboral/${cuadro._id}/filas/${filaId}/resincronizar`);
      setCuadro(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al resincronizar');
    }
  };

  const quitarFila = async filaId => {
    if (!confirm('¿Quitar esta fila del cuadro de este mes? No afecta al empleado.')) return;
    try {
      const { data } = await api.delete(`/cuadro-laboral/${cuadro._id}/filas/${filaId}`);
      setCuadro(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al quitar la fila');
    }
  };

  const inputNum = (fila, campo) => (
    <input type="number" step="0.5" className="form-input cuadro-num"
      value={fila[campo] ?? ''} onChange={e => cambiarCelda(fila._id, campo, e.target.value)} onBlur={() => guardarFila(fila._id)} />
  );
  const inputTxt = (fila, campo, width = 100) => (
    <input className="form-input cuadro-txt" style={{ width }}
      value={fila[campo] ?? ''} onChange={e => cambiarCelda(fila._id, campo, e.target.value)} onBlur={() => guardarFila(fila._id)} />
  );
  const soloLectura = (fila, campo, minWidth = 90) => (
    <div style={{ minWidth, whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--text-2)' }}>
      {fila[campo] || '—'}
    </div>
  );
  const celdaIdentidad = (fila, campo, minWidth) => fila.empleado
    ? soloLectura(fila, campo, minWidth)
    : inputTxt(fila, campo, minWidth);

  return (
    <div className="table-wrap">
      <table className="data-table tabla-cuadro">
        <thead><tr>
          {['Nombre', 'NIF', 'NAF', 'F. Alta', 'Ctto', 'Categoría', 'H. Base', 'Días semana', 'P. Transp. (días)', 'P. Festivo (h)', 'P. Penos. (h)', 'P. Noct. (h)',
            '1ª Sem.', '2ª Sem.', '3ª Sem.', '4ª Sem.', '5ª Sem.', 'Observaciones', 'Acciones'].map(h => <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {cuadro.filas.length === 0 && <tr><td colSpan={19}><div className="empty-state"><div className="empty-state-text">Sin filas en este cuadro.</div></div></td></tr>}
          {cuadro.filas.map(f => (
            <tr key={f._id}>
              <td>{celdaIdentidad(f, 'nombre', 240)}</td>
              <td>{celdaIdentidad(f, 'nif', 95)}</td>
              <td>{celdaIdentidad(f, 'naf', 130)}</td>
              <td>{f.empleado
                ? <div style={{ minWidth: 90, color: 'var(--text-2)' }}>{fFecha(f.fecha_alta)}</div>
                : <input type="date" className="form-input cuadro-txt" style={{ width: 140 }}
                    value={fInput(f.fecha_alta)} onChange={e => cambiarCelda(f._id, 'fecha_alta', e.target.value)} onBlur={() => guardarFila(f._id)} />}
              </td>
              <td>{celdaIdentidad(f, 'ctto', 55)}</td>
              <td>{celdaIdentidad(f, 'categoria', 120)}</td>
              <td>{inputNum(f, 'horario_base')}</td>
              <td>
                <div className="cuadro-dias">
                  {inputNum(f, 'dias_semana')}
                  {(f.dias_trabajo || []).length > 0 && (
                    <span title="Días que trabaja (Gestión de empleados): con ellos se calcula el plus de transporte exacto">
                      {DIAS_CORTOS.filter(([d]) => f.dias_trabajo.includes(d)).map(([, c]) => c).join(' ')}
                    </span>)}
                </div>
              </td>
              <td>{inputNum(f, 'plus_transporte')}</td>
              <td>{inputNum(f, 'plus_festivo')}</td>
              <td>{inputNum(f, 'plus_penosidad')}</td>
              <td>{inputNum(f, 'plus_nocturnidad')}</td>
              <td>{inputNum(f, 'semana1')}</td>
              <td>{inputNum(f, 'semana2')}</td>
              <td>{inputNum(f, 'semana3')}</td>
              <td>{inputNum(f, 'semana4')}</td>
              <td>{inputNum(f, 'semana5')}</td>
              <td><textarea className="form-input cuadro-txt cuadro-obs" rows={1}
                value={f.observaciones ?? ''} onChange={e => cambiarCelda(f._id, 'observaciones', e.target.value)} onBlur={() => guardarFila(f._id)} /></td>
              <td><div style={{ display: 'flex', gap: 4 }}>
                {f.empleado && <button className="btn-edit" title="Volver a copiar nombre/NIF/NAF/F.alta/Ctto/categoría/horario base/días de trabajo desde el empleado" onClick={() => resincronizar(f._id)}>↻</button>}
                <button className="btn-delete" onClick={() => quitarFila(f._id)}>Quitar</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CuadroLaboral() {
  const hoy = new Date();
  const [meses, setMeses] = useState([]);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [cuadros, setCuadros] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [genMes, setGenMes] = useState(hoy.getMonth() + 1);
  const [aviso, setAviso] = useState('');
  const genAnio = genMes >= (hoy.getMonth() + 1) ? hoy.getFullYear() : hoy.getFullYear() + 1;
  const mm = String(mes).padStart(2, '0');
  const totalFilas = cuadros ? GRUPOS.reduce((n, g) => n + (cuadros[g.key]?.filas.length || 0), 0) : 0;

  const cargarMeses = () => api.get('/cuadro-laboral/meses').then(r => setMeses(r.data));

  const cargarCuadro = (a, m) => {
    setLoading(true); setError('');
    api.get(`/cuadro-laboral/${a}/${m}`)
      .then(r => { setCuadros(r.data.cuadros); setAnio(a); setMes(m); })
      .catch(() => { setCuadros(null); setAnio(a); setMes(m); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/cuadro-laboral/meses').then(r => {
      setMeses(r.data);
      if (r.data.length) cargarCuadro(r.data[0].anio, r.data[0].mes);
      else setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setCuadroDe = grupo => upd => setCuadros(cs => ({ ...cs, [grupo]: typeof upd === 'function' ? upd(cs[grupo]) : upd }));

  const generar = async () => {
    setError(''); setAviso('');
    try {
      const { data } = await api.post('/cuadro-laboral/generar', { anio: genAnio, mes: genMes });
      await cargarMeses();
      cargarCuadro(genAnio, genMes);
      const n = g => data.cuadros[g]?.filas.length || 0;
      setAviso(`Cuadros de ${MESES[genMes - 1]} ${genAnio} generados: ${n('sin_variaciones')} sin variaciones y ${n('con_variaciones')} con variaciones.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar el cuadro');
    }
  };

  const eliminarCuadros = async () => {
    if (!confirm(`¿Eliminar los dos cuadros de ${MESES[mes - 1]} ${anio}? Se borran sus ${totalFilas} fila(s). No afecta a los empleados.`)) return;
    setError(''); setAviso('');
    try {
      await api.delete(`/cuadro-laboral/mes/${anio}/${mes}`);
      const { data } = await api.get('/cuadro-laboral/meses');
      setMeses(data);
      if (data.length) cargarCuadro(data[0].anio, data[0].mes);
      else { setCuadros(null); setLoading(false); }
      setAviso('Cuadros eliminados.');
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar el cuadro');
    }
  };

  const recalcularSemanas = async grupo => {
    const g = GRUPOS.find(x => x.key === grupo);
    if (!confirm(`¿Recalcular las 5 semanas del cuadro «${g.titulo}» a partir del horario base y el calendario del mes (sumando las horas de cobertura de turnos de compañeros ausentes)? No toca pluses ni observaciones.`)) return;
    setError(''); setAviso('');
    try {
      const { data } = await api.post(`/cuadro-laboral/${cuadros[grupo]._id}/recalcular-semanas`);
      setCuadroDe(grupo)(data);
      setAviso(`Semanas recalculadas en «${g.titulo}».`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al recalcular las semanas');
    }
  };

  const sincronizar = async () => {
    setError(''); setAviso('');
    try {
      const { data } = await api.post(`/cuadro-laboral/mes/${anio}/${mes}/sincronizar`);
      setCuadros(data.cuadros);
      const partes = [];
      if (data.anadidos) partes.push(`${data.anadidos} empleado(s) añadido(s)`);
      if (data.movidos) partes.push(`${data.movidos} fila(s) cambiada(s) de cuadro por su «¿Tiene variaciones?»`);
      setAviso(partes.length ? `${partes.join(' y ')}.` : `Todo al día: no falta nadie y cada uno está en su cuadro (${data.total_activos} empleados activos).`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al actualizar');
    }
  };

  return (<>
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Cuadro laboral</div>

      <div className="filters-bar" style={{ marginBottom: 0 }}>
        <SearchSelect label="Meses generados"
          items={meses.map(x => ({ _id: `${x.anio}-${x.mes}`, nombre: `${MESES[x.mes - 1]} ${x.anio}` }))}
          value={cuadros ? `${anio}-${mes}` : ''}
          onChange={v => { const [a, m] = v.split('-').map(Number); cargarCuadro(a, m); }}
          placeholder="Buscar mes…" />

        <div className="filter-group">
          <span className="filter-label">Generar cuadros de</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="filter-select" value={genMes} onChange={e => setGenMes(+e.target.value)}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m} {i + 1 >= (hoy.getMonth() + 1) ? hoy.getFullYear() : hoy.getFullYear() + 1}</option>
              ))}
            </select>
            <button className="btn-save" onClick={generar} title="Genera a la vez el cuadro de empleados sin variaciones y el de empleados con variaciones">Generar los dos</button>
          </div>
        </div>

        {cuadros && (<>
          <div className="filter-group">
            <span className="filter-label">Plantilla</span>
            <button className="btn-save" onClick={sincronizar} title="Añade los empleados activos que faltan y pasa al otro cuadro a quien haya cambiado su «¿Tiene variaciones?»">
              🔄 Actualizar
            </button>
          </div>

          <div className="filter-group">
            <span className="filter-label">Descargar los dos juntos</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-save" onClick={() => descargar(`/cuadro-laboral/mes/${anio}/${mes}/export/xlsx`, `cuadro-laboral-${anio}-${mm}.xlsx`)}>⬇ XLSX</button>
              <button className="btn-save" onClick={() => descargar(`/cuadro-laboral/mes/${anio}/${mes}/export/pdf`, `cuadro-laboral-${anio}-${mm}.pdf`)}>⬇ PDF</button>
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">&nbsp;</span>
            <button className="btn-delete" onClick={eliminarCuadros}>🗑 Eliminar los dos cuadros</button>
          </div>
        </>)}
      </div>
    </div>

    {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
    {aviso && <div className="error-msg" style={{ marginBottom: 12, color: 'var(--accent)' }}>{aviso} <button className="btn-cancel" style={{ marginLeft: 8 }} onClick={() => setAviso('')}>✕</button></div>}

    {loading && <div className="panel"><div className="spinner" /><div>Cargando…</div></div>}

    {!loading && !cuadros && (
      <div className="panel"><div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">Todavía no hay ningún cuadro laboral generado. Elige el mes arriba y pulsa «Generar los dos».</div>
      </div></div>
    )}

    {!loading && cuadros && GRUPOS.map(g => {
      const cuadro = cuadros[g.key];
      return (
        <section key={g.key} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 720, letterSpacing: '-0.01em' }}>
              Cuadro laboral · {g.titulo}
            </h2>
            <span className={`chip ${g.key === 'con_variaciones' ? 'warn' : 'ok'}`}>{cuadro?.filas.length || 0} trabajador(es)</span>
            <span style={{ flex: 1 }} />
            {cuadro && <>
              <button className="btn-edit" onClick={() => recalcularSemanas(g.key)}>↻ Recalcular semanas</button>
              <button className="btn-edit" onClick={() => descargar(`/cuadro-laboral/${cuadro._id}/export/xlsx`, `cuadro-laboral-${anio}-${mm}${g.sufijo}.xlsx`)}>⬇ XLSX</button>
              <button className="btn-edit" onClick={() => descargar(`/cuadro-laboral/${cuadro._id}/export/pdf`, `cuadro-laboral-${anio}-${mm}${g.sufijo}.pdf`)}>⬇ PDF</button>
            </>}
          </div>
          {cuadro
            ? <TablaCuadro cuadro={cuadro} setCuadro={setCuadroDe(g.key)} setError={setError} />
            : <div className="panel"><div className="empty-state-text">Este mes no tiene cuadro «{g.titulo}». Pulsa «Actualizar» para crearlo.</div></div>}
        </section>
      );
    })}
  </>);
}
