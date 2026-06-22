import React, { useState } from 'react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const SLOW_MS = 1800;
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_WAIT_MS = 60000;
const RETRY_DELAY_MS = 3000;

const WAIT_MESSAGES = [
  'Estableciendo canal seguro...',
  'Sincronizando servicios...',
  'Comprobando credenciales...',
  'Preparando tu sesion...',
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

  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        const t = setTimeout(() => {
          clearTimeout(t);
          reject(new Error('timeout'));
        }, ms);
      })
    ]);

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
    localStorage.setItem('nombreTecnico', res.nombre || 'Tecnico');
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
      'Error en el servidor o conexion'
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
        try {
          const res = await withTimeout(login(usuario.trim(), contraseña), ATTEMPT_TIMEOUT_MS);
          const dtTotal = Math.round(performance.now() - tStart);

          setLatenciaMs(dtTotal);

          if (!res?.token || !res?.sesionId || !res?.userId) {
            setMensaje('Respuesta de inicio de sesion incompleta');
            return;
          }

          guardarSesionLocal(res);
          setMensaje(dtTotal > SLOW_MS ? 'Servicios listos, iniciando...' : res.mensaje || 'Acceso concedido');
          navigate('/dashboard');
          return;
        } catch (err) {
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
        setMensaje('No se pudo conectar. El servidor podria seguir reactivandose. Intenta nuevamente.');
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
    <div className="login-root" role="main">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="login-shell">
        <section className="intro-panel">
          <div className="intro-card">
            <span className="eyebrow">Cubica PDF App</span>
            <h1>Gestiona informes tecnicos con evidencia fotografica.</h1>
            <p>
              Ingresa con tu usuario para cargar evidencias, actas y generar informes PDF.
            </p>
          </div>
        </section>

        <section className={`login-card ${cargando ? 'is-busy' : ''}`} aria-label="Formulario de inicio de sesion">
          {cargando && <div className="md-progress" role="progressbar" aria-label="Cargando" />}

          <div className="logo-wrap">
            <img
              src="https://res.cloudinary.com/drygjoxaq/image/upload/v1760147856/cubica_logo_HD_transparent_bemx4o.png"
              alt="Logo Cubica"
              className="logo"
              draggable={false}
            />
          </div>

          <div className="login-heading">
            <span>Bienvenido</span>
            <h2>Iniciar sesion</h2>
            <p>Accede para continuar con la generacion de informes.</p>
          </div>

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="field">
              <label htmlFor="usuario">Cedula o usuario</label>
              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingresa tu cedula"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                aria-required="true"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
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
              <p className={`message ${cargando ? 'loading' : ''}`} role="status">
                {mensaje}
                {latenciaMs > SLOW_MS ? ` (${Math.round(latenciaMs / 100) / 10}s)` : null}
              </p>
            )}

            <button
              type="submit"
              className={`btn primary ${cargando ? 'is-loading' : ''}`}
              disabled={cargando}
              aria-busy={cargando}
            >
              {cargando ? <span className="spinner" aria-label="Cargando" /> : 'Ingresar'}
            </button>
          </form>
        </section>
      </div>

      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          min-height: 100%;
        }

        html,
        body {
          margin: 0;
          background: #0b0d10;
        }

        .login-root {
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(255, 242, 0, 0.14), transparent 30%),
            radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.08), transparent 34%),
            linear-gradient(180deg, #101317 0%, #0b0d10 100%);
          color: #f4f4f5;
          font-family: Inter, Roboto, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(18px, 4vw, 42px);
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(10px);
          opacity: 0.7;
          pointer-events: none;
        }

        .ambient-one {
          width: 320px;
          height: 320px;
          left: -120px;
          top: -120px;
          background: rgba(255, 242, 0, 0.12);
        }

        .ambient-two {
          width: 260px;
          height: 260px;
          right: -90px;
          bottom: -90px;
          background: rgba(255, 255, 255, 0.06);
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: min(1080px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(360px, 440px);
          gap: clamp(18px, 4vw, 32px);
          align-items: stretch;
        }

        .intro-panel {
          display: flex;
          align-items: stretch;
        }

        .intro-card {
          width: 100%;
          min-height: 520px;
          padding: clamp(26px, 5vw, 46px);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          animation: enter 260ms ease-out;
        }

        .eyebrow {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 242, 0, 0.12);
          border: 1px solid rgba(255, 242, 0, 0.24);
          color: #fff200;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .intro-card h1 {
          margin: 0;
          max-width: 680px;
          font-size: clamp(34px, 6vw, 64px);
          line-height: 0.96;
          letter-spacing: -0.07em;
          font-weight: 900;
        }

        .intro-card p {
          margin: 18px 0 0;
          max-width: 560px;
          color: #c5c8ce;
          font-size: clamp(15px, 2vw, 18px);
          line-height: 1.55;
        }

        .login-card {
          position: relative;
          min-height: 520px;
          padding: clamp(24px, 4vw, 34px);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.075);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          display: flex;
          flex-direction: column;
          justify-content: center;
          animation: enter 300ms ease-out;
          overflow: hidden;
        }

        .login-card.is-busy {
          animation: busy 700ms ease-out 1;
        }

        .md-progress {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          overflow: hidden;
          background: transparent;
        }

        .md-progress::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0, rgba(255, 242, 0, 0.2) 30%, #fff200 52%, rgba(255, 242, 0, 0.2) 74%, transparent 100%);
          transform: translateX(-100%);
          animation: indeterminate 1.2s cubic-bezier(.4, 0, .2, 1) infinite;
        }

        .logo-wrap {
          width: 128px;
          height: 128px;
          margin: 0 auto 22px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 40px rgba(0, 0, 0, 0.22);
        }

        .logo {
          width: 102px;
          height: auto;
          display: block;
          user-select: none;
          filter: brightness(0.92) contrast(0.98);
        }

        .login-heading {
          text-align: center;
          margin-bottom: 24px;
        }

        .login-heading span {
          color: #fff200;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .login-heading h2 {
          margin: 8px 0 0;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1;
          letter-spacing: -0.06em;
          font-weight: 900;
        }

        .login-heading p {
          margin: 10px auto 0;
          color: #c5c8ce;
          line-height: 1.45;
          max-width: 330px;
          font-size: 14px;
        }

        .form {
          display: grid;
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field label {
          font-size: 13px;
          color: #d7d9dd;
          font-weight: 800;
        }

        input {
          width: 100%;
          height: 52px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #f5f5f5;
          border-radius: 16px;
          padding: 0 16px;
          font-size: 15px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        input::placeholder {
          color: rgba(197, 200, 206, 0.72);
        }

        input:focus {
          border-color: rgba(255, 242, 0, 0.45);
          box-shadow: 0 0 0 4px rgba(255, 242, 0, 0.12);
          background: rgba(255, 255, 255, 0.1);
        }

        .message {
          margin: 2px 0 0;
          padding: 12px 14px;
          min-height: 44px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f1f1f1;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .message.loading {
          background: rgba(255, 242, 0, 0.1);
          border-color: rgba(255, 242, 0, 0.2);
          color: #fff6a6;
        }

        .btn {
          min-height: 52px;
          border: 0;
          border-radius: 16px;
          padding: 0 18px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          color: #111;
          transition: transform 120ms ease, opacity 120ms ease, box-shadow 160ms ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .btn.primary {
          background: #fff200;
          box-shadow: 0 14px 32px rgba(255, 242, 0, 0.16);
        }

        .btn.primary.is-loading {
          animation: pulse 1.2s ease-in-out infinite;
        }

        .spinner {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background:
            conic-gradient(from 0deg, transparent 0 28%, #111 32% 64%, transparent 68% 100%);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
          animation: rotate .9s linear infinite;
        }

        @keyframes enter {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.99);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes busy {
          0% {
            transform: translateY(0) scale(1);
          }

          40% {
            transform: translateY(-1px) scale(1.005);
          }

          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes indeterminate {
          to {
            transform: translateX(100%);
          }
        }

        @keyframes rotate {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 14px 32px rgba(255, 242, 0, 0.16);
            transform: translateY(0);
          }

          50% {
            box-shadow: 0 18px 40px rgba(255, 242, 0, 0.22);
            transform: translateY(-1px);
          }
        }

        @media (max-width: 860px) {
          .login-shell {
            grid-template-columns: 1fr;
          }

          .intro-panel {
            display: none;
          }

          .login-card {
            min-height: auto;
            width: min(440px, 100%);
            margin: 0 auto;
          }
        }

        @media (max-width: 420px) {
          .login-root {
            padding: 14px;
          }

          .login-card {
            border-radius: 24px;
            padding: 22px;
          }

          .logo-wrap {
            width: 112px;
            height: 112px;
            border-radius: 24px;
          }

          .logo {
            width: 90px;
          }

          .login-heading h2 {
            font-size: 30px;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;