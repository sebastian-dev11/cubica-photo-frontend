import { http, resultadoIncierto } from './http';
import { login } from './authService';
import { generarInforme } from './informesService';
import { API_URL } from './apiConfig';

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
  [401, 'authentication'], [403, 'permission'], [422, 'validation'],
  [413, 'size'], [500, 'server'], [408, 'timeout']
])('diferencia HTTP %s sin borrar la sesión ni repetir solicitudes', async (status, kind) => {
  localStorage.setItem('token', 'retained');
  fetch.mockResolvedValue(response(status, { mensaje: 'Detalle controlado' }));
  await expect(http.post('/acta/subir', new FormData())).rejects.toMatchObject({ kind, response: { status } });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBe('retained');
});

test('una desconexión es incierta y no reintenta ni siquiera GET /pdf/generar', async () => {
  fetch.mockRejectedValue(new TypeError('Network error'));
  const error = await generarInforme('sesion', {}).catch((error) => error);
  expect(error.kind).toBe('connection');
  expect(resultadoIncierto(error)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
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
