import { expireSession, getTokenExpiresAt, isTokenExpired, SESSION_EXPIRED_EVENT } from './sessionService';

const jwt = (payload) => `header.${btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`;

afterEach(() => jest.restoreAllMocks());

test('lee exp en segundos de un JWT base64url sin padding', () => {
  expect(getTokenExpiresAt(jwt({ exp: 2000000000, sub: 'usuario' }))).toBe(2000000000000);
});

test.each([null, '', 'opaque-token', 'header.%%%.signature', jwt({}), jwt({ exp: '2000000000' })])(
  'delega en el backend los tokens sin expiración legible: %s',
  (token) => {
    expect(getTokenExpiresAt(token)).toBeNull();
    expect(isTokenExpired(token)).toBe(false);
  }
);

test('considera vencido el token desde el instante exacto de exp', () => {
  jest.spyOn(Date, 'now').mockReturnValue(2000000000000);
  expect(isTokenExpired(jwt({ exp: 2000000001 }))).toBe(false);
  expect(isTokenExpired(jwt({ exp: 2000000000 }))).toBe(true);
  expect(isTokenExpired(jwt({ exp: 1999999999 }))).toBe(true);
  expect(isTokenExpired(jwt({ exp: 0 }))).toBe(true);
});

test('limpia los datos de sesión y notifica una sola vez sin borrar datos ajenos', () => {
  const keys = [
    'token', 'sesionId', 'nombreTecnico', 'isAdmin', 'userId',
    'usuario', 'rol', 'dashStep', 'numeroIncidencia'
  ];
  keys.forEach((key) => localStorage.setItem(key, key === 'token' ? 'old-token' : 'dato'));
  localStorage.setItem('cubica_version_notes_seen_1.4.0', '1.4.0');
  sessionStorage.setItem('cubica_generacion_pendiente_session', 'intento pendiente');
  const dispatch = jest.spyOn(window, 'dispatchEvent');

  expect(expireSession('old-token')).toBe(true);
  keys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
  expect(localStorage.getItem('cubica_version_notes_seen_1.4.0')).toBe('1.4.0');
  expect(sessionStorage.getItem('cubica_generacion_pendiente_session')).toBe('intento pendiente');
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: SESSION_EXPIRED_EVENT }));
  expect(expireSession('old-token')).toBe(false);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test('una respuesta de una sesión anterior no elimina las credenciales nuevas', () => {
  localStorage.setItem('token', 'new-token');
  localStorage.setItem('sesionId', 'new-session');
  const dispatch = jest.spyOn(window, 'dispatchEvent');

  expect(expireSession('old-token')).toBe(false);
  expect(localStorage.getItem('token')).toBe('new-token');
  expect(localStorage.getItem('sesionId')).toBe('new-session');
  expect(dispatch).not.toHaveBeenCalled();
});
