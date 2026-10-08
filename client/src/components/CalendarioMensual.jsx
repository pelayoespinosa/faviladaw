import { useMemo } from 'react';
import { claveDia, generarCeldas } from '../utils/calendarioGrid';

const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarioMensual({ year, month, hoy, renderCelda, onSelectDia }) {
  const celdas = useMemo(() => generarCeldas(year, month), [year, month]);
  const hoyClave = claveDia(hoy || new Date());

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
        {DIAS_LABEL.map(d => (
          <div key={d} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {celdas.map((d, i) => {
          const enMes = d.getMonth() === month;
          const esHoy = claveDia(d) === hoyClave;
          return (
            <button
              key={i}
              onClick={() => onSelectDia?.(d)}
              style={{
                minHeight: 68, borderRadius: 8, border: `1px solid ${esHoy ? 'var(--accent)' : 'var(--border)'}`,
                background: enMes ? 'var(--surface-2)' : 'transparent', opacity: enMes ? 1 : 0.35,
                padding: '6px 8px', textAlign: 'left', cursor: onSelectDia ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--f-ui)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.getDate()}</span>
              {renderCelda?.(d, enMes, esHoy)}
            </button>
          );
        })}
      </div>
    </>
  );
}
