import React, { useState } from 'react';
import { login } from '../services/authService';

const LoginPage = () => {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(usuario, contraseña);
    setMensaje(res);

    if (res === '✅ Acceso concedido') {
      localStorage.setItem('sesionId', usuario);
      // Aquí puedes redirigir, por ejemplo, usando React Router
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '20px', border: '1px solid #ccc' }}>
      <h2>Inicio de Sesión</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Usuario:</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label>Contraseña:</label>
          <input
            type="password"
            value={contraseña}
            onChange={(e) => setContraseña(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ marginTop: '15px' }}>Ingresar</button>
      </form>
      {mensaje && <p style={{ marginTop: '15px' }}>{mensaje}</p>}
    </div>
  );
};

export default LoginPage;

