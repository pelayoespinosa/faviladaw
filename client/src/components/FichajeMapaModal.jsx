import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker1x from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const icon = L.icon({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const fmtHora = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function FichajeMapaModal({ fichaje, onClose }) {
  const entrada = fichaje.entrada;
  const salida = fichaje.salida;
  const tieneEntrada = entrada?.lat != null && entrada?.lng != null;
  const tieneSalida = salida?.lat != null && salida?.lng != null;

  if (!tieneEntrada) {
    return (
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-upload" style={{ maxWidth: 420 }}>
          <div className="modal-doc-header">
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>Ubicación</div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{ padding: 20, color: 'var(--text-2)', fontSize: 13 }}>No hay coordenadas guardadas para este fichaje.</div>
        </div>
      </div>
    );
  }

  const center = [entrada.lat, entrada.lng];
  const puntos = tieneSalida ? [[entrada.lat, entrada.lng], [salida.lat, salida.lng]] : null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-upload" style={{ maxWidth: 560 }}>
        <div className="modal-doc-header">
          <div>
            <div style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 15 }}>{fichaje.empleado?.nombre_display || 'Fichaje'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              Entrada {fmtHora(entrada.fecha_hora)}{tieneSalida ? ` · Salida ${fmtHora(salida.fecha_hora)}` : ''}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ height: 360 }}>
          <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[entrada.lat, entrada.lng]} icon={icon}>
              <Popup>Entrada · {fmtHora(entrada.fecha_hora)}</Popup>
            </Marker>
            {tieneSalida && (
              <Marker position={[salida.lat, salida.lng]} icon={icon}>
                <Popup>Salida · {fmtHora(salida.fecha_hora)}</Popup>
              </Marker>
            )}
            {puntos && <Polyline positions={puntos} pathOptions={{ color: '#3ddc84' }} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
