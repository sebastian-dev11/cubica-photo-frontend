import React, { useState } from 'react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/ui/Icon';

const SLOW_MS = 1800;
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_WAIT_MS = 60000;
const RETRY_DELAY_MS = 3000;

const WAIT_MESSAGES = [
  'Estableciendo canal seguro...',
  'Sincronizando servicios...',
  'Comprobando credenciales...',
  'Preparando tu sesión...',
  'Optimizando recursos...',
  'Casi estamos...'
];

const LoginPage = () => {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [latenciaMs, setLatenciaMs] = useState(0);

  const navigate = useNavigate();

  const withTimeout = (promise, ms) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]).finally(() => window.clearTimeout(timer));
  };

  const limpiarSesionLocal = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('sesionId');
    localStorage.removeItem('nombreTecnico');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userId');
    localStorage.removeItem('usuario');
    localStorage.removeItem('rol');
  };

  const guardarSesionLocal = (res) => {
    localStorage.setItem('token', res.token);
    localStorage.setItem('sesionId', res.sesionId);
    localStorage.setItem('nombreTecnico', res.nombre || 'Técnico');
    localStorage.setItem('isAdmin', res.isAdmin ? '1' : '0');
    localStorage.setItem('userId', res.userId);
    localStorage.setItem('usuario', res.usuario || usuario.trim());
    localStorage.setItem('rol', res.rol || 'tecnico');
  };

  const getMensajeError = (err) => {
    return (
      err?.response?.data?.mensaje ||
      err?.response?.data?.error ||
      err?.message ||
      'Error en el servidor o conexión'
    );
  };

  const isErrorCredenciales = (err) => {
    const status = err?.response?.status;
    return [400, 401, 403, 404].includes(status);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario.trim() || !contraseña) {
      setMensaje('Usuario y contraseña son obligatorios');
      return;
    }

    limpiarSesionLocal();
    setCargando(true);
    setMensaje('Conectando con el servidor...');
    setLatenciaMs(0);

    let slowTimer = null;
    let rotateTimer = null;
    let rotateIndex = 0;
    const tStart = performance.now();

    try {
      slowTimer = window.setTimeout(() => {
        setMensaje('Estamos reactivando los servicios, por favor espera');
      }, SLOW_MS);

      rotateTimer = window.setInterval(() => {
        rotateIndex = (rotateIndex + 1) % WAIT_MESSAGES.length;
        setMensaje(WAIT_MESSAGES[rotateIndex]);
      }, 10000);

      let ex;

      while (performance.now() - tStart < MAX_WAIT_MS) {
        const attemptController = new AbortController();
        try {
          const res = await withTimeout(
            login(usuario.trim(), contraseña, { signal: attemptController.signal }),
            ATTEMPT_TIMEOUT_MS
          );
          const dtTotal = Math.round(performance.now() - tStart);

          setLatenciaMs(dtTotal);

          if (!res?.token || !res?.sesionId || !res?.userId) {
            setMensaje('Respuesta de inicio de sesión incompleta');
            return;
          }

          guardarSesionLocal(res);
          setMensaje(dtTotal > SLOW_MS ? 'Servicios listos, iniciando...' : res.mensaje || 'Acceso concedido');
          navigate('/dashboard');
          return;
        } catch (err) {
          attemptController.abort();
          ex = err;

          if (isErrorCredenciales(err)) {
            setMensaje(getMensajeError(err));
            return;
          }

          setMensaje('Estamos reactivando los servicios, por favor espera');

          const restante = MAX_WAIT_MS - (performance.now() - tStart);

          if (restante <= RETRY_DELAY_MS) {
            break;
          }

          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (ex?.message === 'timeout') {
        setMensaje('No se pudo conectar. El servidor podría seguir reactivándose. Intenta nuevamente.');
      } else {
        setMensaje(getMensajeError(ex));
      }
    } catch (error) {
      setMensaje(getMensajeError(error));
      console.error('Error en login:', error);
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      if (rotateTimer) clearInterval(rotateTimer);
      setCargando(false);
    }
  };

  return (
    <div className="login-root ui-page" role="main">
      <div className="login-shell">
        <section
          className={`login-card ui-card ui-card-strong animate-in ${cargando ? 'is-busy' : ''}`}
          aria-label="Formulario de inicio de sesión"
        >
          {cargando && <div className="ui-progress md-progress" role="progressbar" aria-label="Cargando" />}

          <div className="logo-wrap">
            <img
              src="https://res.cloudinary.com/drygjoxaq/image/upload/v1788878195/LOGO_CUBICA_TRANSPARENTE_gfjdep.png"
              alt="Logo Cubica"
              className="logo"
              draggable={false}
            />
          </div>

          <div className="login-heading">
            <h2 className="ui-title">Iniciar sesión</h2>
            <p className="ui-subtitle">Ingresa para continuar con la gestión y generación de informes.</p>
          </div>

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="field ui-field">
              <label htmlFor="usuario" className="ui-label">Cédula o usuario</label>
              <input
                id="usuario"
                type="text"
                className="ui-input"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingresa tu cédula o usuario"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                aria-required="true"
              />
            </div>

            <div className="field ui-field">
              <label htmlFor="password" className="ui-label">Contraseña</label>
              <input
                id="password"
                type="password"
                className="ui-input"
                value={contraseña}
                onChange={(e) => setContraseña(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="current-password"
                aria-required="true"
              />
            </div>

            {mensaje && (
              <p className={`message ${cargando ? 'loading' : ''}`} role="status" aria-live="polite">
                {mensaje}
                {latenciaMs > SLOW_MS ? ` (${Math.round(latenciaMs / 100) / 10}s)` : null}
              </p>
            )}

            <button
              type="submit"
              className={`ui-btn ui-btn-primary btn primary ${cargando ? 'is-loading' : ''}`}
              disabled={cargando}
              aria-busy={cargando}
            >
              {cargando ? <span className="spinner" aria-label="Cargando" /> : <><Icon name="login" />Ingresar</>}
            </button>
          </form>

        </section>
      </div>

      <style>{`
        .login-root {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 4vw, 42px);
          color: var(--text);
          font-family: var(--font-sans);
          background: var(--bg);
        }
        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(40px);
          opacity: 0;
          pointer-events: none;
        }
        .ambient-one {
          width: 360px; height: 360px;
          left: -140px; top: -120px;
          background: radial-gradient(circle, rgba(246,201,69,0.22), rgba(246,201,69,0));
        }
        .ambient-two {
          width: 320px; height: 320px;
          right: -120px; bottom: -120px;
          background: radial-gradient(circle, rgba(56,189,248,0.18), rgba(56,189,248,0));
        }
        .ambient-grid { display: none; }
        .login-shell {
          position: relative;
          z-index: 1;
          width: min(420px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: center;
        }
        .login-card {
          position: relative;
          min-height: 0;
          width: 100%;
          padding: clamp(18px, 4vw, 30px);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          border: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .login-card::after { display: none; }
        .md-progress {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 999px 999px 0 0;
        }
        .logo-wrap {
          width: 108px; height: 108px;
          margin: 0 auto 18px;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 0;
          box-shadow: none;
        }
        .logo {
          width: 94px; height: auto;
          user-select: none;
          filter: none;
        }
        .login-heading { text-align: center; margin-bottom: 22px; }
        .login-heading h2 {
          margin: 0;
          font-size: clamp(24px, 4vw, 30px);
        }
        .login-heading p { margin: 10px auto 0; max-width: 360px; font-size: 14px; }
        .form { display: grid; gap: 16px; }
        .message {
          margin: 2px 0 0;
          padding: 12px 14px;
          min-height: 44px;
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-family: var(--font-tech);
        }
        .message.loading {
          background: var(--processing-soft);
          border-color: rgba(96,165,250,0.22);
          color: #dbeafe;
        }
        .btn.primary { width: 100%; min-height: 50px; font-size: 15px; }
        .spinner {
          width: 20px; height: 20px;
          border-radius: 50%;
          border: 2px solid rgba(20,18,8,0.25);
          border-top-color: var(--primary-ink);
          animation: spin .8s linear infinite;
        }
        @media (max-width: 520px) {
          .login-root { padding: 18px 20px; }
          .login-card { border-radius: 0; padding: 12px 0; }
          .logo-wrap { width: 96px; height: 96px; margin-bottom: 14px; }
          .logo { width: 84px; }
          .message { text-align: left; font-size: 13px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .intro-card::after { animation: none; display: none; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
