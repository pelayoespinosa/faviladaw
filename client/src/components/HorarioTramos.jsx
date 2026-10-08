export default function HorarioTramos({ tramos }) {
  const validos = (tramos || []).filter(t => t.hora_llegada);
  if (!validos.length) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {validos.map((t, i) => (
        <span key={i} className="horario-cell">
          {t.hora_llegada}<span className="horario-dash">–</span>{t.hora_salida || '?'}
        </span>
      ))}
    </span>
  );
}
