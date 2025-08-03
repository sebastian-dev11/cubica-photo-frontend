import React, { useState } from 'react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate(); // 🧭

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    const res = await login(usuario, contraseña);
    setMensaje(res);
    setCargando(false);

    if (res === '✅ Acceso concedido') {
      localStorage.setItem('sesionId', usuario);
      navigate('/dashboard'); // 🔀 redirección al dashboard
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingTop: '60px',
        background: 'linear-gradient(to bottom, #fff200, #ffffff)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Roboto, sans-serif',
        color: '#636363ff'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '30px',
          borderRadius: '15px',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <img
          src="https://res.cloudinary.com/drygjoxaq/image/upload/v1754102481/022e3445-0819-4ebc-962a-d9f0d772bf86_kmyqbw.jpg"
          alt="Logo Cubica"
          style={{
            width: '120px',
            height: 'auto',
            marginBottom: '15px',
            filter: 'drop-shadow(0 0 4px #fff)',
          }}
        />
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Bienvenido a Cubica Photo App</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ fontWeight: 'bold', color: '#555' }}>Usuario:</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                marginTop: '5px',
                backgroundColor: '#fff',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ fontWeight: 'bold', color: '#555' }}>Contraseña:</label>
            <input
              type="password"
              value={contraseña}
              onChange={(e) => setContraseña(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                marginTop: '5px',
                backgroundColor: '#fff',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#fff200',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            disabled={cargando}
          >
            {cargando ? (
              <span className="spinner" style={{ display: 'inline-block' }}>
                🔄
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {mensaje && (
          <p style={{ marginTop: '15px', fontWeight: 'bold', color: '#444' }}>{mensaje}</p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
