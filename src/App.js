import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InformesPage from './pages/InformesPage';
import UsuariosPage from './pages/UsuariosPage';
import TiendasPage from './pages/TiendasPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/informes" element={<InformesPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/tiendas" element={<TiendasPage />} />
      </Routes>
    </Router>
  );
}

export default App;
