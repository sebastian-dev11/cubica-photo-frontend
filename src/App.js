import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage'; // asegúrate de tener esta clase creada
import InformesPage from './pages/InformesPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/informes" element={<InformesPage />} />
      </Routes>
    </Router>
  );
}

export default App;
