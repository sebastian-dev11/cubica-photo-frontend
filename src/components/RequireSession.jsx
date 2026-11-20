import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { expireSession, getTokenExpiresAt, isTokenExpired, SESSION_EXPIRED_EVENT } from '../services/sessionService';

const MAX_TIMER_DELAY = 2147483647;

export default function RequireSession() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    let timer;

    const checkSession = () => {
      window.clearTimeout(timer);
      const currentToken = localStorage.getItem('token');

      if (currentToken && isTokenExpired(currentToken)) {
        expireSession(currentToken);
        return;
      }

      setToken(currentToken);
      const expiresAt = getTokenExpiresAt(currentToken);
      if (expiresAt !== null) {
        timer = window.setTimeout(checkSession, Math.min(expiresAt - Date.now(), MAX_TIMER_DELAY));
      }
    };

    const onStorage = (event) => {
      if (event.storageArea === localStorage && (event.key === 'token' || event.key === null)) {
        checkSession();
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, checkSession);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', checkSession);
    window.addEventListener('pageshow', checkSession);
    document.addEventListener('visibilitychange', checkSession);
    checkSession();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, checkSession);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', checkSession);
      window.removeEventListener('pageshow', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, []);

  if (!token || isTokenExpired(token)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
