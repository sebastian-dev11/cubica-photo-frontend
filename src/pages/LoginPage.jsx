// LoginPage.jsx
import React, { useState } from 'react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const BG_URL = "https://blog.generaclatam.com/hubfs/shutterstock_93376264.jpg";

/* Umbrales y tiempos */
const SLOW_MS = 1800;        // mostrar mensaje de reactivacion si tarda mas que esto
const ATTEMPT_TIMEOUT_MS = 12000; // tiempo maximo por intento
const MAX_WAIT_MS = 60000;   // espera total antes de dar error
const RETRY_DELAY_MS = 3000; // pausa entre intentos

const LoginPage = () => {
  /* Estados de formulario */
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');

  /* Estados de UI */
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [latenciaMs, setLatenciaMs] = useState(0);

  const navigate = useNavigate();

  /* Helper timeout simple */
  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        const t = setTimeout(() => {
          clearTimeout(t);
          reject(new Error('timeout'));
        }, ms);
      }),
    ]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setCargando(true);
    setMensaje('Conectando con el servidor...');
    setLatenciaMs(0);

    let slowTimer = null;
    const tStart = performance.now();

    try {
      /* Preparar mensaje de reactivacion si se demora el primer tramo */
      slowTimer = setTimeout(() => {
        setMensaje('Estamos reactivando los servicios, por favor espera');
      }, SLOW_MS);

      /* Reintentos hasta MAX_WAIT_MS */
      let intento = 0;
      let ex;
      while (performance.now() - tStart < MAX_WAIT_MS) {
        intento += 1;
        try {
          const res = await withTimeout(login(usuario, contraseña), ATTEMPT_TIMEOUT_MS);

          const dtTotal = Math.round(performance.now() - tStart);
          setLatenciaMs(dtTotal);

          if (dtTotal > SLOW_MS) {
            setMensaje('Servicios listos, iniciando...');
          } else {
            setMensaje(res.mensaje || 'Acceso concedido');
          }

          if (res.mensaje && res.mensaje.toLowerCase() === 'acceso concedido') {
            localStorage.setItem('sesionId', usuario);
            if (res.nombre) localStorage.setItem('nombreTecnico', res.nombre);
            if (typeof res.isAdmin !== 'undefined') {
              localStorage.setItem('isAdmin', res.isAdmin ? '1' : '0');
            }
            if (res.userId) {
              localStorage.setItem('userId', res.userId);
            }
            navigate('/dashboard');
          } else {
            setMensaje(res.mensaje || 'Credenciales incorrectas');
          }

          return; // exito, salir
        } catch (err) {
          ex = err;
          /* Mientras haya presupuesto de tiempo, seguir esperando y reintentando */
          setMensaje('Estamos reactivando los servicios, por favor espera');
          const tiempoRestante = MAX_WAIT_MS - (performance.now() - tStart);
          if (tiempoRestante <= RETRY_DELAY_MS) break;
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      /* Si sale del bucle, excedio MAX_WAIT_MS */
      if (ex && ex.message === 'timeout') {
        setMensaje('No se pudo conectar. El servidor podria seguir reactivandose. Intenta nuevamente.');
      } else {
        setMensaje('No se pudo conectar. Intenta nuevamente.');
      }
    } catch (error) {
      setMensaje('Error en el servidor o conexion');
      console.error('Error en login:', error);
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      setCargando(false);
    }
  };

  return (
    <div className="login-root">
      {/* Fondo */}
      <div className="bg" style={{ backgroundImage: `url("${BG_URL}")` }} />
      {/* Overlay */}
      <div className="overlay" />

      {/* Contenido */}
      <div className="content">
        <div className="card">
          <img
            src="https://res.cloudinary.com/drygjoxaq/image/upload/v1754102481/022e3445-0819-4ebc-962a-d9f0d772bf86_kmyqbw.jpg"
            alt="Logo Cubica"
            className="logo"
          />
          <h2 className="title">Bienvenido a Cubica Photo App</h2>

          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label className="label">Ingresa tu Cédula:</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                className="input"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="field">
              <label className="label">Contraseña:</label>
              <input
                type="password"
                value={contraseña}
                onChange={(e) => setContraseña(e.target.value)}
                required
                className="input"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            {/* Mensaje dinamico */}
            {mensaje && (
              <p className="msg">
                {mensaje}
                {latenciaMs > SLOW_MS ? ` (≈ ${Math.round(latenciaMs / 100) / 10}s)` : null}
              </p>
            )}

            <button type="submit" className="btn" disabled={cargando}>
              {cargando ? <span className="modern-spinner" aria-label="Cargando" /> : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

      {/* Estilos */}
      <style>{`
        :root {
          --gold: #fff200;
          --ink: #0a0a0a;
          --text: #333333;
          --label: #555555;
          --panel: rgba(255,255,255,0.30);
          --panel-border: rgba(255,255,255,0.24);
          --input-bg: rgba(255,255,255,0.85);
          --input-text: #111111;
          --input-border: rgba(0,0,0,0.18);
          --placeholder: rgba(0,0,0,0.45);
          --title: #222222;
          --msg: #444444;
          --overlay: linear-gradient(to bottom,
                      rgba(255,242,0,0.35),
                      rgba(255,242,0,0.05) 40%,
                      rgba(0,0,0,0.10) 100%);
          --focus-ring: rgba(255,242,0,0.25);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --text: #e9e9e9;
            --label: #d3d3d3;
            --panel: rgba(24,24,24,0.42);
            --panel-border: rgba(255,255,255,0.18);
            --input-bg: rgba(255,255,255,0.10);
            --input-text: #f2f2f2;
            --input-border: rgba(255,255,255,0.22);
            --placeholder: rgba(255,255,255,0.55);
            --title: #fafafa;
            --msg: #efefef;
            --overlay: linear-gradient(to bottom,
                          rgba(255,242,0,0.28),
                          rgba(0,0,0,0.25) 45%,
                          rgba(0,0,0,0.45) 100%);
            --focus-ring: rgba(255,242,0,0.35);
          }
        }

        .login-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          padding: max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px));
          box-sizing: border-box;
          font-family: Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          color: var(--text);
          overflow: hidden;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }

        .bg {
          position: fixed;
          inset: 0;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: -2;
          transform: translateZ(0);
        }

        .overlay {
          position: fixed;
          inset: 0;
          z-index: -1;
          background: var(--overlay);
          pointer-events: none;
        }

        .content {
          min-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card {
          width: 92%;
          max-width: 380px;
          padding: 24px;
          border-radius: 16px;
          background: var(--panel);
          border: 1px solid var(--panel-border);
          box-shadow: 0 10px 36px rgba(0,0,0,0.30);
          text-align: center;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: box-shadow 180ms ease;
        }

        .card:hover { box-shadow: 0 12px 42px rgba(0,0,0,0.34); }

        .logo {
          width: clamp(92px, 28vw, 120px);
          height: auto;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 4px #ffffff);
          user-select: none;
          pointer-events: none;
        }

        .title {
          margin: 0 0 14px 0;
          color: var(--title);
          font-weight: 700;
          font-size: clamp(18px, 2.6vw, 22px);
          letter-spacing: 0.2px;
        }

        .form { text-align: left; }
        .field { margin-bottom: 14px; }

        .label {
          display: block;
          font-weight: 600;
          color: var(--label);
          margin-bottom: 6px;
          font-size: 0.95rem;
        }

        .input {
          width: 100%;
          box-sizing: border-box;
          height: 48px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--input-text);
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
          font-size: 16px;
        }

        .input:focus {
          border-color: var(--input-border);
          box-shadow: 0 0 0 3px var(--focus-ring);
          background: rgba(255,255,255,0.95);
        }

        @media (prefers-color-scheme: dark) {
          .input:focus { background: rgba(255,255,255,0.14); }
        }

        .btn {
          width: 100%;
          height: 48px;
          padding: 12px;
          background: var(--gold);
          color: #000;
          border: none;
          border-radius: 10px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
          user-select: none;
        }

        .btn:hover { transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .msg {
          margin: 10px 0 12px 0;
          font-weight: 700;
          color: var(--msg);
          text-align: center;
          min-height: 1.2em;
        }

        .modern-spinner {
          width: 22px;
          height: 22px;
          border: 3px solid rgba(0,0,0,0.3);
          border-top: 3px solid #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        @media (min-width: 480px) {
          .card { padding: 26px; }
          .field { margin-bottom: 16px; }
        }

        @media (min-width: 768px) {
          .card { padding: 28px; border-radius: 18px; max-width: 400px; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
