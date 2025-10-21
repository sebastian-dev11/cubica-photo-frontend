import React, { useState } from 'react';
import { login } from '../services/authService';
import { useNavigate } from 'react-router-dom';

/* Tiempos */
const SLOW_MS = 1800;
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_WAIT_MS = 60000;
const RETRY_DELAY_MS = 3000;

/* Mensajes rotativos de espera */
const WAIT_MESSAGES = [
  'Estableciendo canal seguro…',
  'Sincronizando servicios…',
  'Comprobando credenciales…',
  'Preparando tu sesión…',
  'Optimizando recursos…',
  'Casi estamos…'
];

const LoginPage = () => {
  /* Estado de formulario */
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');

  /* Estado de UI */
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [latenciaMs, setLatenciaMs] = useState(0);

  const navigate = useNavigate();

  /* Helper timeout */
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
    let rotateTimer = null;
    let rotateIndex = 0;
    const tStart = performance.now();

    try {
      /* Mensaje si demora el primer tramo */
      slowTimer = window.setTimeout(() => {
        setMensaje('Estamos reactivando los servicios, por favor espera');
      }, SLOW_MS);

      /* Mensajes dinámicos cada 10 s */
      rotateTimer = window.setInterval(() => {
        rotateIndex = (rotateIndex + 1) % WAIT_MESSAGES.length;
        setMensaje(WAIT_MESSAGES[rotateIndex]);
      }, 10000);

      /* Reintentos hasta MAX_WAIT_MS */
      let ex;
      while (performance.now() - tStart < MAX_WAIT_MS) {
        try {
          const res = await withTimeout(login(usuario, contraseña), ATTEMPT_TIMEOUT_MS);
          const dtTotal = Math.round(performance.now() - tStart);
          setLatenciaMs(dtTotal);

          if (dtTotal > SLOW_MS) setMensaje('Servicios listos, iniciando...');
          else setMensaje(res && res.mensaje ? res.mensaje : 'Acceso concedido');

          if (res && res.mensaje && String(res.mensaje).toLowerCase() === 'acceso concedido') {
            localStorage.setItem('sesionId', usuario);
            if (res.nombre) localStorage.setItem('nombreTecnico', res.nombre);
            if (typeof res.isAdmin !== 'undefined') {
              localStorage.setItem('isAdmin', res.isAdmin ? '1' : '0');
            }
            if (res.userId) localStorage.setItem('userId', res.userId);
            navigate('/dashboard');
          } else {
            setMensaje((res && res.mensaje) || 'Credenciales incorrectas');
          }
          return;
        } catch (err) {
          ex = err;
          setMensaje('Estamos reactivando los servicios, por favor espera');
          const restante = MAX_WAIT_MS - (performance.now() - tStart);
          if (restante <= RETRY_DELAY_MS) break;
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      /* Excedió MAX_WAIT_MS */
      if (ex && ex.message === 'timeout') {
        setMensaje('No se pudo conectar. El servidor podría seguir reactivándose. Intenta nuevamente.');
      } else {
        setMensaje('No se pudo conectar. Intenta nuevamente.');
      }
    } catch (error) {
      setMensaje('Error en el servidor o conexión');
      console.error('Error en login:', error);
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      if (rotateTimer) clearInterval(rotateTimer);
      setCargando(false);
    }
  };

  return (
    <div className="login-root" role="main">
      <div className="content">
        <section className={`card md-elevation ${cargando ? 'is-busy' : ''}`} aria-label="Formulario de inicio de sesión">
          {/* Barra de progreso indeterminada */}
          {cargando && <div className="md-progress" role="progressbar" aria-label="Cargando" />}

          <img
            src="https://res.cloudinary.com/drygjoxaq/image/upload/v1760147856/cubica_logo_HD_transparent_bemx4o.png"
            alt="Logo Cubica"
            className="logo"
            draggable={false}
          />
          <h1 className="title">Bienvenido a Cubica PDF App</h1>

          <form onSubmit={handleSubmit} className="form" noValidate>
            {/* Cédula */}
            <div className="md-field">
              <input
                id="usuario"
                className="md-input"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder=" "
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                aria-required="true"
              />
              <label htmlFor="usuario" className="md-label">Ingresa tu Cédula</label>
            </div>

            {/* Contraseña */}
            <div className="md-field">
              <input
                id="password"
                className="md-input"
                type="password"
                value={contraseña}
                onChange={(e) => setContraseña(e.target.value)}
                placeholder=" "
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="current-password"
                aria-required="true"
              />
              <label htmlFor="password" className="md-label">Contraseña</label>
            </div>

            {/* Mensaje */}
            {mensaje && (
              <p className="md-message" role="status">
                {mensaje}
                {latenciaMs > SLOW_MS ? ` (≈ ${Math.round(latenciaMs / 100) / 10}s)` : null}
              </p>
            )}

            <button
              type="submit"
              className={`md-button md-button--filled ${cargando ? 'is-loading' : ''}`}
              disabled={cargando}
              aria-busy={cargando}
            >
              {cargando ? <span className="md-spinner" aria-label="Cargando" /> : 'Ingresar'}
            </button>
          </form>
        </section>
      </div>

      {/* Estilos */}
      <style>{`
        /* Reset para eliminar bordes blancos */
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        html, body { margin: 0; background: #0f1113; }

        /* Tokens */
        :root{
          --primary: #fff200;
          --on-primary: #111111;
          --bg: #0f1113;
          --surface: #15181c;
          --on-surface: #e9eaec;
          --outline: rgba(255,255,255,0.18);
          --outline-strong: rgba(255,255,255,0.28);
          --label: #b8bcc3;
          --focus: rgba(255,242,0,0.35);
        }

        /* Lienzo */
        .login-root{
          min-height: 100dvh;
          min-height: 100svh;
          width: 100%;
          background: var(--bg);
          color: var(--on-surface);
          font-family: Inter, Roboto, system-ui, -apple-system, Segoe UI, Helvetica, Arial;
          display: flex;
        }
        .content{
          margin: auto;
          width: 100%;
          padding: clamp(16px, 3vw, 32px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Tarjeta */
        .card{
          position: relative;
          width: min(440px, 92vw);
          border-radius: 16px;
          background: var(--surface);
          padding: 28px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.22);
          animation: md-enter 260ms cubic-bezier(.2,.8,.2,1);
          will-change: transform;
        }
        .card.is-busy{ animation: md-busy 700ms ease-out 1; }

        /* Progreso indeterminado superior */
        .md-progress{
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          overflow: hidden;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
          background: transparent;
        }
        .md-progress::before{
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0, rgba(255,242,0,.2) 30%, var(--primary) 52%, rgba(255,242,0,.2) 74%, transparent 100%);
          transform: translateX(-100%);
          animation: md-indeterminate 1.2s cubic-bezier(.4,0,.2,1) infinite;
        }

        /* Logo con brillo reducido */
        .logo{
          width: clamp(96px, 26vw, 120px);
          height: auto;
          display: block;
          margin: 0 auto 12px auto;
          user-select: none;
          filter: brightness(.88) contrast(.96);
        }
        @media (prefers-color-scheme: dark){
          .logo{ filter: brightness(.85) contrast(.96); }
        }

        .title{
          margin: 0 0 18px 0;
          text-align: center;
          font-size: clamp(18px, 2.4vw, 22px);
          font-weight: 700;
          letter-spacing: .2px;
        }

        /* Formulario */
        .form{ display: grid; gap: 16px; }
        .md-field{ position: relative; }

        .md-input{
          width: 100%;
          height: 56px;
          border-radius: 12px;
          padding: 18px 16px 10px 16px;
          border: 1px solid var(--outline);
          background: transparent;
          color: var(--on-surface);
          font-size: 16px;
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .md-input::placeholder{ color: transparent; }
        .md-input:focus{
          border-color: var(--outline-strong);
          box-shadow: 0 0 0 4px var(--focus);
          background: transparent;
        }

        .md-label{
          position: absolute;
          left: 16px;
          top: 18px;
          color: var(--label);
          font-size: 14px;
          pointer-events: none;
          transform-origin: left top;
          transition: transform 160ms ease, color 160ms ease, top 160ms ease;
          background: transparent;
          padding: 0 4px;
        }
        .md-input:focus + .md-label,
        .md-input:not(:placeholder-shown) + .md-label{
          transform: translateY(-12px) scale(0.88);
          color: var(--label);
        }

        .md-message{
          margin: 2px 2px 4px 2px;
          min-height: 1.25rem;
          font-size: 0.95rem;
          font-weight: 600;
          opacity: .95;
          text-align: center;
        }

        /* Botón con animación al cargar */
        .md-button{
          height: 48px;
          border: none;
          border-radius: 12px;
          padding: 0 16px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          transition: transform 120ms ease, box-shadow 180ms ease, opacity 120ms ease;
        }
        .md-button--filled{
          background: var(--primary);
          color: var(--on-primary);
          box-shadow: 0 6px 16px rgba(0,0,0,0.22);
        }
        .md-button--filled:hover{ transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.26); }
        .md-button--filled:active{ transform: translateY(0); box-shadow: 0 6px 16px rgba(0,0,0,0.22); }
        .md-button:disabled{ opacity: .7; cursor: not-allowed; }
        .md-button.is-loading{ animation: md-pulse 1.2s ease-in-out infinite; }

        /* Spinner más estético (conic ring) */
        .md-spinner{
          --sz: 22px;
          width: var(--sz);
          height: var(--sz);
          border-radius: 50%;
          background:
            conic-gradient(from 0deg, transparent 0 28%, var(--on-primary) 32% 64%, transparent 68% 100%);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(50% - 4px), #000 calc(50% - 3px));
          animation: md-rotate .9s linear infinite;
        }

        /* Motion */
        @keyframes md-enter{
          from{ opacity: 0; transform: translateY(4px) scale(.995); }
          to{ opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes md-busy{
          0% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-1px) scale(1.005); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes md-indeterminate{
          to { transform: translateX(100%); }
        }
        @keyframes md-rotate{
          to { transform: rotate(360deg); }
        }
        @keyframes md-pulse{
          0%,100% { box-shadow: 0 6px 16px rgba(0,0,0,0.22); transform: translateY(0); }
          50% { box-shadow: 0 10px 22px rgba(0,0,0,0.26); transform: translateY(-1px); }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
