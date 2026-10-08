import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Empleados from './pages/Empleados';
import Clientes from './pages/Clientes';
import Contrataciones from './pages/Contrataciones';
import Turnos from './pages/Turnos';
import Mapa from './pages/Mapa';
import Flota from './pages/Flota';
import MisTurnos from './pages/MisTurnos';
import GestionEmpleados from './pages/GestionEmpleados';
import GestionUsuarios from './pages/GestionUsuarios';
import GestionProductos from './pages/GestionProductos';
import GestionClientes from './pages/GestionClientes';
import Documentos from './pages/Documentos';
import MisDocumentos from './pages/MisDocumentos';
import Fichar from './pages/Fichar';
import MisFichajes from './pages/MisFichajes';
import Fichajes from './pages/Fichajes';
import VacacionesBajas from './pages/VacacionesBajas';
import MiCalendario from './pages/MiCalendario';
import Solicitudes from './pages/Solicitudes';
import MisSolicitudes from './pages/MisSolicitudes';
import Servicios from './pages/Servicios';
import CuadroLaboral from './pages/CuadroLaboral';
import Inicio from './pages/Inicio';
import Perfil from './pages/Perfil';
import Panel from './pages/Panel';
import { DESACTIVADOS } from './constants/navegacion';

function Home() {
  const { rol } = useAuth();
  return rol === 'empleado' ? <Inicio /> : <Panel />;
}

function Desactivado({ nombre, children, ruta }) {
  if (!DESACTIVADOS.has(ruta)) return children;
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <div className="panel-title">{nombre} está desactivado</div>
      <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Este apartado no está disponible de momento. Los datos se conservan y volverá a estar accesible cuando se reactive.</p>
    </div>
  );
}

function RequireRol({ roles, children }) {
  const { rol } = useAuth();
  if (!roles.includes(rol)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Home />} />
            <Route path="empleados"          element={<RequireRol roles={['admin','encargado','gestoria']}><Empleados /></RequireRol>} />
            <Route path="clientes"           element={<RequireRol roles={['admin','encargado']}><Clientes /></RequireRol>} />
            <Route path="contrataciones"     element={<RequireRol roles={['admin']}><Desactivado nombre="Contrataciones" ruta="/contrataciones"><Contrataciones /></Desactivado></RequireRol>} />
            <Route path="turnos"             element={<RequireRol roles={['admin']}><Turnos /></RequireRol>} />
            <Route path="mapa"               element={<RequireRol roles={['admin']}><Mapa /></RequireRol>} />
            <Route path="flota"              element={<RequireRol roles={['admin']}><Flota /></RequireRol>} />
            <Route path="mis-turnos"         element={<RequireRol roles={['encargado','empleado']}><MisTurnos /></RequireRol>} />
            <Route path="gestion-empleados"  element={<RequireRol roles={['admin']}><GestionEmpleados /></RequireRol>} />
            <Route path="gestion-usuarios"   element={<RequireRol roles={['admin']}><GestionUsuarios /></RequireRol>} />
            <Route path="gestion-productos"  element={<RequireRol roles={['admin']}><GestionProductos /></RequireRol>} />
            <Route path="gestion-clientes"   element={<RequireRol roles={['admin']}><GestionClientes /></RequireRol>} />
            <Route path="documentos"          element={<RequireRol roles={['admin','encargado','gestoria']}><Documentos /></RequireRol>} />
            <Route path="mis-documentos"      element={<RequireRol roles={['admin','encargado','gestoria','empleado']}><MisDocumentos /></RequireRol>} />
            <Route path="fichar"              element={<RequireRol roles={['encargado','empleado']}><Fichar /></RequireRol>} />
            <Route path="mis-fichajes"        element={<RequireRol roles={['encargado','empleado']}><MisFichajes /></RequireRol>} />
            <Route path="fichajes"            element={<RequireRol roles={['admin','encargado','gestoria']}><Fichajes /></RequireRol>} />
            <Route path="vacaciones-bajas"    element={<RequireRol roles={['admin','encargado']}><VacacionesBajas /></RequireRol>} />
            <Route path="mi-calendario"       element={<RequireRol roles={['encargado','empleado']}><MiCalendario /></RequireRol>} />
            <Route path="solicitudes"         element={<RequireRol roles={['admin','encargado']}><Solicitudes /></RequireRol>} />
            <Route path="mis-solicitudes"     element={<RequireRol roles={['encargado','empleado']}><MisSolicitudes /></RequireRol>} />
            <Route path="servicios"           element={<RequireRol roles={['admin']}><Servicios /></RequireRol>} />
            <Route path="cuadro-laboral"      element={<RequireRol roles={['admin','gestoria']}><CuadroLaboral /></RequireRol>} />
            <Route path="perfil"              element={<RequireRol roles={['admin','encargado','empleado','gestoria']}><Perfil /></RequireRol>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
