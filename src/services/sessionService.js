export const SESSION_EXPIRED_EVENT = 'cubica:session-expired';

const SESSION_KEYS = [
  'token', 'sesionId', 'nombreTecnico', 'isAdmin', 'userId',
  'usuario', 'rol', 'dashStep', 'numeroIncidencia'
];

export function getTokenExpiresAt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const { exp } = JSON.parse(window.atob(padded));
    return typeof exp === 'number' && Number.isFinite(exp * 1000) ? exp * 1000 : null;
  } catch {
    // Los tokens sin un exp legible se siguen validando en el backend.
    return null;
  }
}

export function isTokenExpired(token) {
  const expiresAt = getTokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= Date.now();
}

export function expireSession(token) {
  // Un 401 tardío no debe cerrar una sesión iniciada con un token nuevo.
  if (!token || localStorage.getItem('token') !== token) return false;

  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}
