import { coincideConIntento, recuperarInformePorIntento } from './informesService';

const intento = {
  sesionId: 'session', numeroIncidencia: 'INC-123', tiendaId: 'store',
  startedAt: '2026-11-19T12:00:00.000Z'
};
const informe = {
  _id: 'report', sesionId: 'session', numeroIncidencia: 'INC-123',
  tiendaId: { _id: 'store' }, createdAt: '2026-11-19T12:01:02.000Z'
};
const response = (status, data) => ({ status, ok: status < 400, text: async () => JSON.stringify(data) });

test.each([
  { createdAt: '2026-11-19T11:59:59.999Z' },
  { numeroIncidencia: 'INC-ANTERIOR' },
  { tiendaId: { _id: 'otra-tienda' } },
  { sesionId: 'otra-sesion' },
  { createdAt: undefined },
  { createdAt: '2026-11-20T12:00:00.000Z' }
])('no recupera un informe anterior o que no corresponde: %o', (changes) => {
  expect(coincideConIntento({ ...informe, ...changes }, intento, Date.parse('2026-11-19T12:02:00Z'))).toBe(false);
});

test('varios 404 y un informe anterior no confirman fallo; recupera el informe tardío', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-19T12:00:00Z'));
  try {
    fetch
      .mockResolvedValueOnce(response(404, { error: 'No hay informes' }))
      .mockResolvedValueOnce(response(200, { ...informe, createdAt: '2026-11-19T11:59:59Z' }))
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(404, {}))
      .mockResolvedValueOnce(response(200, informe));
    const onCheck = jest.fn();
    const recovery = recuperarInformePorIntento(intento, { onCheck });
    // Cada consulta es de solo lectura. Se controla el tiempo sin esperar 75 s reales.
    for (let index = 0; index < 6; index += 1) {
      for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
      if (index < 5) jest.advanceTimersByTime(15000);
    }
    await expect(recovery).resolves.toEqual(informe);
    expect(onCheck).toHaveBeenCalledTimes(6);
    expect(fetch.mock.calls.every(([url]) => url.includes('/informes/utils/ultimo-por-sesion?sesionId=session'))).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('agotadas las consultas devuelve resultado desconocido y no regenera', async () => {
  fetch.mockResolvedValue(response(404, {}));
  await expect(recuperarInformePorIntento(intento, { checks: 2, intervalMs: 0 })).resolves.toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.some(([url]) => url.includes('/pdf/generar'))).toBe(false);
});
