import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/axios';
import { normalizar } from '../utils/texto';
import SearchSelect from '../components/SearchSelect';

const iconCliente = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#3ddc84;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});
const iconEmpleado = L.divIcon({
  className: '',
  html: '<div style="width:15px;height:15px;border-radius:4px;background:#4d9fff;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>',
  iconSize: [15, 15], iconAnchor: [8, 8],
});
const iconClienteFoco = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#ffb020;border:3px solid #fff;box-shadow:0 0 0 4px rgba(255,176,32,0.35),0 0 6px rgba(0,0,0,0.6)"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11],
});

const CENTRO_ASTURIAS = [43.36, -5.85];

function parseCoordenadas(texto) {
  if (!texto) return null;
  const limpio = texto.trim();
  const partes = limpio.includes(',') ? limpio.split(',') : limpio.split(/\s+/);
  if (partes.length !== 2) return null;
  const lat = parseFloat(partes[0].trim());
  const lng = parseFloat(partes[1].trim());
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function ClickCatcher({ activo, onClick }) {
  useMapEvents({ click(e) { if (activo) onClick(e.latlng); } });
  return null;
}

function FlyTo({ lat, lng, nonce }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.flyTo([lat, lng], 17, { duration: 0.8 });
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FocoClienteMarker({ cliente, onCorregir }) {
  const ref = useRef();
  useEffect(() => {
    const t = setTimeout(() => ref.current?.openPopup(), 60);
    return () => clearTimeout(t);
  }, [cliente]);
  return (
    <Marker ref={ref} position={[cliente.lat, cliente.lng]} icon={iconClienteFoco} zIndexOffset={1000}>
      <Popup>
        <strong>{cliente.nombre}</strong>{cliente.sucursal ? ` — ${cliente.sucursal}` : ''}
        {cliente.geocode_manual && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)' }}>(ubicación manual)</span>}<br />
        <span style={{ color: '#3ddc84' }}>Cliente</span>{cliente.zona ? ` · ${cliente.zona}` : ''}<br />
        <button className="btn-edit" style={{ marginTop: 6 }} onClick={() => onCorregir(cliente)}>Corregir posición</button>
      </Popup>
    </Marker>
  );
}

function EditarDireccionModal({ cliente, onClose, onSave }) {
  const [form, setForm] = useState({
    direccion_real: cliente.direccion_real || '',
    direccion_facturacion: cliente.direccion_facturacion || '',
    zona: cliente.zona || '',
    cp: cliente.cp || '',
    provincia: cliente.provincia || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      await api.put(`/clientes/${cliente._id}`, form);
      onSave();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar');
      setSaving(false);
    }
  };

  const f = (key, label, opts = {}) => (
    <div className="filter-group" style={{ flex: opts.flex || 1, minWidth: opts.min || 160 }}>
      <span className="filter-label">{label}</span>
      <input className="form-input" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={opts.ph || ''} />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 16 }}>Corregir dirección</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{cliente.nombre}{cliente.sucursal ? ` — ${cliente.sucursal}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {f('direccion_real', 'Dirección comercial', { flex: 2, min: 220 })}
          {f('direccion_facturacion', 'Dirección facturación', { flex: 2, min: 220 })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {f('zona', 'Población / Zona', { ph: 'Oviedo' })}
          {f('cp', 'CP', { min: 100, ph: '33001' })}
          {f('provincia', 'Provincia', { ph: 'Asturias' })}
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-save" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function Mapa() {
  const [clientes, setClientes]   = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando]   = useState(true);

  const [empleadoSel, setEmpleadoSel] = useState('');
  const [etiqueta, setEtiqueta]       = useState('');
  const [modoClick, setModoClick]     = useState(false);
  const [pendiente, setPendiente]     = useState(null);

  const [busquedaDir, setBusquedaDir]     = useState('');
  const [resultadosDir, setResultadosDir] = useState([]);
  const [buscandoDir, setBuscandoDir]     = useState(false);
  const [coordsEmpleado, setCoordsEmpleado] = useState('');

  const [geocodificando, setGeocodificando] = useState(null);
  const [corrigiendoCliente, setCorrigiendoCliente] = useState(null);
  const [coordsCliente, setCoordsCliente] = useState('');
  const [editandoDireccion, setEditandoDireccion] = useState(null);
  const [error, setError] = useState('');

  const [busquedaCliente, setBusquedaCliente]   = useState('');
  const [dropdownClientes, setDropdownClientes] = useState(false);
  const [clienteEnfocado, setClienteEnfocado]   = useState(null);
  const [focoNonce, setFocoNonce]               = useState(0);
  const buscadorRef = useRef(null);

  const cargar = () => Promise.all([
    api.get('/clientes/mapa'),
    api.get('/empleados'),
  ]).then(([cR, eR]) => {
    setClientes(cR.data);
    setEmpleados(eR.data);
    setClienteEnfocado(prev => (prev ? cR.data.find(c => c._id === prev._id) || null : null));
    setCargando(false);
  });

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const h = e => { if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setDropdownClientes(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const clientesConCoords = clientes.filter(c => c.lat != null);
  const clientesSinCoords = clientes.filter(c => c.lat == null);

  const geocodificar = async id => {
    setGeocodificando(id);
    try {
      const { data } = await api.post(`/clientes/${id}/geocodificar`);
      if (data.zona_corregida) {
        setError(`Corregida la zona de "${data.zona_corregida.de || '—'}" a "${data.zona_corregida.a}" (no coincidía con el código postal).`);
      } else {
        setError('');
      }
      await cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo geolocalizar');
    } finally {
      setGeocodificando(null);
    }
  };

  const buscarDireccion = async () => {
    if (!busquedaDir.trim()) return;
    setBuscandoDir(true);
    try {
      const { data } = await api.get('/geocoding/buscar', { params: { q: busquedaDir } });
      setResultadosDir(data);
    } finally {
      setBuscandoDir(false);
    }
  };

  const elegirResultado = r => {
    setPendiente({ lat: r.lat, lng: r.lng });
    setResultadosDir([]);
    setBusquedaDir(r.display_name);
  };

  const guardarUbicacion = async () => {
    if (!empleadoSel || !pendiente) return setError('Selecciona un empleado y marca una ubicación (buscador o clic en el mapa)');
    const emp = empleados.find(e => e._id === empleadoSel);
    const ubicaciones = [...(emp.ubicaciones || []), { lat: pendiente.lat, lng: pendiente.lng, etiqueta: etiqueta || null }];
    try {
      await api.put(`/empleados/${empleadoSel}`, { ubicaciones });
      setPendiente(null); setEtiqueta(''); setBusquedaDir(''); setModoClick(false); setError('');
      cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar la ubicación');
    }
  };

  const eliminarUbicacion = async (empleadoId, idx) => {
    const emp = empleados.find(e => e._id === empleadoId);
    const ubicaciones = (emp.ubicaciones || []).filter((_, i) => i !== idx);
    await api.put(`/empleados/${empleadoId}`, { ubicaciones });
    cargar();
  };

  const empezarCorreccion = c => {
    setCorrigiendoCliente(c);
    setModoClick(false);
    setPendiente(null);
    setCoordsCliente('');
  };

  const usarCoordenadasCliente = () => {
    const coords = parseCoordenadas(coordsCliente);
    if (!coords) return setError('Coordenadas inválidas — usa el formato "lat, lng" (ej: 43.3653, -5.8502)');
    guardarCorreccion(coords);
  };

  const usarCoordenadasEmpleado = () => {
    const coords = parseCoordenadas(coordsEmpleado);
    if (!coords) return setError('Coordenadas inválidas — usa el formato "lat, lng" (ej: 43.3653, -5.8502)');
    setPendiente(coords);
    setError('');
  };

  const guardarCorreccion = async latlng => {
    if (!corrigiendoCliente) return;
    try {
      await api.put(`/clientes/${corrigiendoCliente._id}/ubicacion`, { lat: latlng.lat, lng: latlng.lng });
      setCorrigiendoCliente(null);
      setError('');
      cargar();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al corregir la ubicación');
    }
  };

  const resultadosClientes = (() => {
    const q = normalizar(busquedaCliente.trim());
    if (!q) return [];
    return clientes.filter(c =>
      normalizar(c.nombre).includes(q)
      || normalizar(c.sucursal).includes(q)
      || normalizar(c.zona).includes(q)
      || normalizar(c.cp).includes(q)
      || normalizar(c.direccion_real).includes(q)
      || normalizar(c.direccion_facturacion).includes(q)
    ).slice(0, 40);
  })();

  const seleccionarClienteMapa = c => {
    setDropdownClientes(false);
    setBusquedaCliente(c.nombre + (c.sucursal ? ` — ${c.sucursal}` : ''));
    if (c.lat == null) {
      setClienteEnfocado(null);
      setError(`"${c.nombre}" todavía no está geolocalizado — geolocalízalo desde la lista de abajo o márcalo ahora con un clic en el mapa.`);
      empezarCorreccion(c);
      return;
    }
    setError('');
    setClienteEnfocado(c);
    setFocoNonce(n => n + 1);
  };

  const limpiarBusquedaCliente = () => {
    setBusquedaCliente('');
    setDropdownClientes(false);
    setClienteEnfocado(null);
  };

  return (<>
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Añadir ubicación de empleado</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <SearchSelect label="Empleado" items={empleados} value={empleadoSel}
          onChange={setEmpleadoSel} placeholder="Buscar empleado…" />
        <div className="filter-group" style={{ minWidth: 160 }}>
          <span className="filter-label">Etiqueta (opcional)</span>
          <input className="form-input" value={etiqueta} onChange={e => setEtiqueta(e.target.value)} placeholder="Ej: Casa, zona centro…" />
        </div>
        <div className="filter-group" style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <span className="filter-label">Buscar dirección</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={busquedaDir} onChange={e => setBusquedaDir(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarDireccion()} placeholder="Calle, número, localidad…" />
            <button type="button" className="btn-cancel" onClick={buscarDireccion} disabled={buscandoDir}>{buscandoDir ? '…' : 'Buscar'}</button>
          </div>
          {resultadosDir.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, marginTop: 2, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
              {resultadosDir.map((r, i) => (
                <div key={i} onClick={() => elegirResultado(r)}
                  style={{ padding: '8px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: i < resultadosDir.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {r.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn-cancel" onClick={() => { setModoClick(m => !m); setCorrigiendoCliente(null); }}
          style={modoClick ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}>
          {modoClick ? 'Clic en el mapa: activado' : 'O marcar con clic en el mapa'}
        </button>
        <div className="filter-group" style={{ minWidth: 200 }}>
          <span className="filter-label">O pegar coordenadas</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" value={coordsEmpleado} onChange={e => setCoordsEmpleado(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && usarCoordenadasEmpleado()} placeholder="43.3653, -5.8502" />
            <button type="button" className="btn-cancel" onClick={usarCoordenadasEmpleado}>Usar</button>
          </div>
        </div>
        <button className="btn-save" onClick={guardarUbicacion} disabled={!pendiente || !empleadoSel}>Guardar ubicación</button>
      </div>
      {pendiente && <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Punto marcado: {pendiente.lat.toFixed(5)}, {pendiente.lng.toFixed(5)}</div>}
      {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
    </div>

    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Buscar cliente en el mapa</div>
      <div className="filter-group search-select-group" ref={buscadorRef} style={{ position: 'relative', maxWidth: 480 }}>
        <div style={{ position: 'relative' }}>
          <input className="form-input" value={busquedaCliente}
            onChange={e => { setBusquedaCliente(e.target.value); setDropdownClientes(true); }}
            onFocus={() => setDropdownClientes(true)}
            placeholder="Nombre, sucursal, zona, CP o dirección…" style={{ paddingRight: 28 }} />
          {busquedaCliente && (
            <button type="button" onClick={limpiarBusquedaCliente}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>
        {dropdownClientes && busquedaCliente.trim() && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 400, marginTop: 2, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {resultadosClientes.length === 0
              ? <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--text-3)' }}>Sin coincidencias</div>
              : resultadosClientes.map(c => (
                <div key={c._id} onClick={() => seleccionarClienteMapa(c)}
                  style={{ padding: '8px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>{c.nombre}{c.sucursal ? ` — ${c.sucursal}` : ''}{c.zona ? <span style={{ color: 'var(--text-3)' }}> · {c.zona}</span> : ''}</span>
                  {c.lat == null && <span style={{ color: 'var(--coral)', fontSize: 11, whiteSpace: 'nowrap' }}>sin ubicación</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>

    {corrigiendoCliente && (
      <div style={{ marginBottom: 16, padding: '10px 16px', background: 'var(--accent-lt)', border: '1px solid color-mix(in srgb,var(--accent) 30%,transparent)', borderRadius: 8, fontSize: 13, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span>Haz clic en el mapa para fijar la ubicación correcta de <strong>{corrigiendoCliente.nombre}</strong>, o pega sus coordenadas:</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="form-input" style={{ width: 200 }} value={coordsCliente} onChange={e => setCoordsCliente(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && usarCoordenadasCliente()} placeholder="43.3653, -5.8502" />
          <button type="button" className="btn-save" onClick={usarCoordenadasCliente}>Usar</button>
          <button type="button" className="btn-cancel" onClick={() => setCorrigiendoCliente(null)}>Cancelar</button>
        </div>
      </div>
    )}

    <div style={{ height: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', zIndex: 0 }}>
      <MapContainer center={CENTRO_ASTURIAS} zoom={9} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickCatcher activo={modoClick || !!corrigiendoCliente} onClick={latlng => {
          if (corrigiendoCliente) guardarCorreccion(latlng);
          else setPendiente({ lat: latlng.lat, lng: latlng.lng });
        }} />
        <FlyTo lat={clienteEnfocado?.lat} lng={clienteEnfocado?.lng} nonce={focoNonce} />

        {clientesConCoords.map(c => (
          <Marker key={c._id} position={[c.lat, c.lng]} icon={iconCliente}>
            <Popup>
              <strong>{c.nombre}</strong>{c.sucursal ? ` — ${c.sucursal}` : ''}
              {c.geocode_manual && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)' }}>(ubicación manual)</span>}<br />
              <span style={{ color: '#3ddc84' }}>Cliente</span>{c.zona ? ` · ${c.zona}` : ''}<br />
              <button className="btn-edit" style={{ marginTop: 6 }} onClick={() => empezarCorreccion(c)}>Corregir posición</button>
            </Popup>
          </Marker>
        ))}

        {empleados.flatMap(e => (e.ubicaciones || []).map((u, i) => (
          <Marker key={`${e._id}-${i}`} position={[u.lat, u.lng]} icon={iconEmpleado}>
            <Popup>
              <strong>{e.nombre_display}</strong>{u.etiqueta ? ` — ${u.etiqueta}` : ''}<br />
              <button className="btn-delete" style={{ marginTop: 6 }} onClick={() => eliminarUbicacion(e._id, i)}>Eliminar ubicación</button>
            </Popup>
          </Marker>
        )))}

        {clienteEnfocado && clienteEnfocado.lat != null && (
          <FocoClienteMarker cliente={clienteEnfocado} onCorregir={empezarCorreccion} />
        )}

        {pendiente && (
          <Marker position={[pendiente.lat, pendiente.lng]} icon={iconEmpleado} opacity={0.6}>
            <Popup>Ubicación pendiente de guardar</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>

    {!cargando && clientesSinCoords.length > 0 && (
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-title">Clientes sin geolocalizar ({clientesSinCoords.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {clientesSinCoords.map(c => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13 }}>
                {c.nombre}{c.sucursal ? ` — ${c.sucursal}` : ''}
                {c.geocode_error && <span style={{ marginLeft: 8, color: 'var(--coral)', fontSize: 11.5 }}>⚠ {c.geocode_error}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-edit" onClick={() => setEditandoDireccion(c)}>Editar cliente</button>
                <button className="btn-edit" onClick={() => geocodificar(c._id)} disabled={geocodificando === c._id}>
                  {geocodificando === c._id ? 'Geolocalizando…' : 'Geolocalizar'}
                </button>
                <button
                  className="btn-edit"
                  onClick={() => empezarCorreccion(c)}
                  style={corrigiendoCliente?._id === c._id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                >
                  {corrigiendoCliente?._id === c._id ? 'Clic en el mapa…' : 'Marcar en el mapa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {editandoDireccion && (
      <EditarDireccionModal
        cliente={editandoDireccion}
        onClose={() => setEditandoDireccion(null)}
        onSave={() => { setEditandoDireccion(null); cargar(); }}
      />
    )}
  </>);
}
