import { http, resultadoIncierto } from './http';
import { login } from './authService';
import { generarInforme } from './informesService';
import { API_URL } from './apiConfig';
import { SESSION_EXPIRED_EVENT } from './sessionService';

const response = (status, data) => ({ status, ok: status < 400, text: async () => JSON.stringify(data) });

test('centraliza URL y Bearer y deja el Content-Type multipart al navegador', async () => {
  localStorage.setItem('token', 'test-token');
  fetch.mockResolvedValue(response(201, { ok: true }));
  const body = new FormData();
  body.append('imagen', new File(['image'], 'foto.jpg', { type: 'image/jpeg' }));
  await http.post('/imagenes/subir', body, { headers: { 'content-type': 'multipart/form-data' } });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe(new URL(`${API_URL}/imagenes/subir`, window.location.origin).toString());
  expect(options.headers.get('Authorization')).toBe('Bearer test-token');
  expect(options.headers.has('Content-Type')).toBe(false);
  expect(options.body).toBe(body);
});

test('login utiliza el mismo cliente y no envía un token antiguo', async () => {
  localStorage.setItem('token', 'old-token');
  fetch.mockResolvedValue(response(200, { token: 'new-token', sesionId: 'session', nombre: 'Técnico' }));
  await expect(login('usuario', 'clave')).resolves.toMatchObject({ token: 'new-token' });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe(new URL(`${API_URL}/auth/login`, window.location.origin).toString());
  expect(options.headers.has('Authorization')).toBe(false);
  expect(JSON.parse(options.body)).toEqual({ usuario: 'usuario', contraseña: 'clave' });
});

test.each([
  [403, 'permission'], [422, 'validation'],
  [413, 'size'], [500, 'server'], [408, 'timeout']
])('diferencia HTTP %s sin borrar la sesión ni repetir solicitudes', async (status, kind) => {
  localStorage.setItem('token', 'retained');
  fetch.mockResolvedValue(response(status, { mensaje: 'Detalle controlado' }));
  await expect(http.post('/acta/subir', new FormData())).rejects.toMatchObject({ kind, response: { status } });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBe('retained');
});

test('un 401 autenticado elimina la sesión, notifica la redirección y no reintenta', async () => {
  localStorage.setItem('token', 'expired-token');
  localStorage.setItem('sesionId', 'old-session');
  const dispatch = jest.spyOn(window, 'dispatchEvent');
  try {
    fetch.mockResolvedValue(response(401, { mensaje: 'Token expirado' }));
    await expect(http.post('/acta/subir', new FormData())).rejects.toMatchObject({
      kind: 'authentication', response: { status: 401 }
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('sesionId')).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: SESSION_EXPIRED_EVENT }));
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    dispatch.mockRestore();
  }
});

test('un 401 del login no invalida otra sesión ni dispara una redirección', async () => {
  localStorage.setItem('token', 'retained');
  const dispatch = jest.spyOn(window, 'dispatchEvent');
  try {
    fetch.mockResolvedValue(response(401, { mensaje: 'Credenciales incorrectas' }));
    await expect(login('usuario', 'incorrecta')).rejects.toMatchObject({
      kind: 'authentication', response: { status: 401 }
    });
    expect(localStorage.getItem('token')).toBe('retained');
    expect(dispatch).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    dispatch.mockRestore();
  }
});

test('no envía solicitudes con un JWT que ya ha vencido', async () => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 1 }));
  localStorage.setItem('token', `header.${payload}.signature`);
  await expect(http.get('/tiendas')).rejects.toMatchObject({
    kind: 'authentication', response: { status: 401 }
  });
  expect(localStorage.getItem('token')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

test('un token antiguo y vencido no bloquea una solicitud pública de login', async () => {
  localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: 0 }))}.signature`);
  fetch.mockResolvedValue(response(200, { token: 'new-token' }));
  await expect(login('usuario', 'clave')).resolves.toMatchObject({ token: 'new-token' });
  expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false);
});

test('un 401 tardío de una solicitud anterior no elimina el token de un nuevo login', async () => {
  localStorage.setItem('token', 'old-token');
  let resolve;
  fetch.mockImplementation(() => new Promise((res) => { resolve = res; }));
  const pending = http.get('/tiendas');
  localStorage.setItem('token', 'new-token');
  localStorage.setItem('sesionId', 'new-session');
  resolve(response(401, { mensaje: 'Token antiguo' }));

  await expect(pending).rejects.toMatchObject({ kind: 'authentication' });
  expect(localStorage.getItem('token')).toBe('new-token');
  expect(localStorage.getItem('sesionId')).toBe('new-session');
});

test('una desconexión es incierta y no reintenta ni siquiera GET /pdf/generar', async () => {
  fetch.mockRejectedValue(new TypeError('Network error'));
  const error = await generarInforme('sesion', {}).catch((error) => error);
  expect(error.kind).toBe('connection');
  expect(resultadoIncierto(error)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('permite cancelar una consulta sin confundir la cancelación con una desconexión', async () => {
  const controller = new AbortController();
  fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));

  const request = http.get('/informes', {}, { signal: controller.signal }).catch((error) => error);
  controller.abort();

  await expect(request).resolves.toMatchObject({ name: 'AbortError', kind: 'aborted' });
  expect(resultadoIncierto(await request)).toBe(false);
});

test('la generación tiene margen para 62 segundos y el timeout es configurable', async () => {
  jest.useFakeTimers();
  try {
    let resolve;
    fetch.mockImplementation((url, { signal }) => new Promise((res, reject) => {
      resolve = res;
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const generation = generarInforme('sesion', {});
    jest.advanceTimersByTime(62000);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    resolve(response(201, { ok: true, id: 'report' }));
    await expect(generation).resolves.toMatchObject({ id: 'report' });

    const timeout = http.get('/lento', {}, { timeoutMs: 2000 }).catch((error) => error);
    jest.advanceTimersByTime(2000);
    expect((await timeout).kind).toBe('timeout');
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});
