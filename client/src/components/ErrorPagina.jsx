import { Component } from 'react';

export default class ErrorPagina extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Error en la página:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-title">No se ha podido mostrar esta página</div>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 14 }}>
          Ha ocurrido un error al cargarla. Puedes seguir usando el resto de Favila desde el menú, o volver a intentarlo.
        </p>
        <button className="btn-save" onClick={() => window.location.reload()}>Volver a cargar</button>
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--f-mono)' }}>{String(this.state.error?.message || this.state.error)}</div>
      </div>
    );
  }
}
