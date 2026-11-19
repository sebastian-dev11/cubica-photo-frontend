import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { optimizeMany } from '../utils/uploadFiles';

jest.mock('../utils/uploadFiles', () => ({
  ...jest.requireActual('../utils/uploadFiles'),
  optimizeMany: jest.fn()
}));

const response = (status, data) => ({ status, ok: status < 400, text: async () => JSON.stringify(data) });
const jpeg = (name) => new File([new Uint8Array([255, 216, 255, 217])], name, { type: 'image/jpeg' });
const pdf = (name = 'acta.pdf') => new File(['%PDF-1.7\ncontenido\n%%EOF'], name, { type: 'application/pdf' });
const tienda = { _id: 'store', nombre: 'Tienda prueba', regional: 'NORTE', departamento: 'D', ciudad: 'C' };
const previewUrl = 'https://backend.test/pdf/preview/token-estable';
const filename = 'INFORME TÉCNICO-123-Tienda prueba.pdf';
let overrides;

const calls = (path) => fetch.mock.calls.filter(([url]) => new URL(url).pathname === `/api${path}`);
const uploadNames = () => calls('/imagenes/subir').map(([, options]) => options.body.get('imagen').name);

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('sesionId', 'session');
  localStorage.setItem('cubica_version_notes_seen_1.4.0', '1.4.0');
  optimizeMany.mockImplementation(async (files) => files.map((original) => ({ original, file: original, error: '' })));
  overrides = {};
  fetch.mockImplementation(async (url, options) => {
    const path = new URL(url).pathname.replace(/^\/api/, '');
    if (overrides[path]) return overrides[path](options);
    if (path === '/tiendas') return response(200, { data: [tienda] });
    if (path === '/imagenes/subir') {
      const body = options.body;
      return response(201, { url: 'https://storage.test/image', sesionId: body.get('sesionId'), tipo: body.get('tipo'), ubicacion: body.get('ubicacion') });
    }
    if (path === '/acta/subir') return response(200, { ok: true, persistido: true });
    if (path === '/pdf/generar/session') return response(201, { ok: true, id: 'report', previewUrl, filename });
    if (path === '/pdf/preview-link/report') return response(200, { ok: true, previewUrl, filename });
    if (path === '/pdf/session/reset/session') return response(200, { ok: true });
    if (path === '/informes/utils/ultimo-por-sesion') return response(404, { error: 'Todavía no existe' });
    throw new Error(`Ruta sin simular: ${path}`);
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function mount() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>);
}

async function evidenceStep() {
  mount();
  fireEvent.change(screen.getByLabelText('Incidencia'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Tienda' } });
  fireEvent.click(await screen.findByRole('option', { name: /Tienda prueba/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function selectEvidence(names) {
  fireEvent.change(screen.getByLabelText('Seleccionar evidencias'), { target: { files: names.map(jpeg) } });
  await waitFor(() => expect(screen.getByRole('button', { name: names.length > 1 ? 'Subir imágenes' : 'Subir imagen' })).toBeEnabled());
}

async function uploadEvidence(names) {
  await selectEvidence(names);
  fireEvent.click(screen.getByRole('button', { name: names.length > 1 ? 'Subir imágenes' : 'Subir imagen' }));
  await screen.findByText(`${names.length} de ${names.length} imágenes subidas`);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Atrás' })).toBeEnabled());
}

async function selectPdf(name) {
  fireEvent.change(screen.getByLabelText('Seleccionar PDF del acta'), { target: { files: [pdf(name)] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Subir acta' })).toBeEnabled());
}

async function readyToGenerate() {
  await evidenceStep();
  await uploadEvidence(['previa-1.jpg', 'previa-2.jpg']);
  await uploadEvidence(['posterior.jpg']);
  // Se permiten cantidades distintas: 2 previas / 1 posterior.
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await selectPdf();
  fireEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
  await screen.findByText('Acta cargada correctamente');
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 30; index += 1) await Promise.resolve();
  });
}

test('fallo parcial: cuenta cada confirmación, la retira de la cola y solo reintenta pendientes', async () => {
  await evidenceStep();
  let failSecond;
  let index = 0;
  overrides['/imagenes/subir'] = (options) => {
    index += 1;
    if (index === 2) return new Promise((resolve) => { failSecond = resolve; });
    return response(201, {
      url: 'stored', sesionId: 'session', tipo: options.body.get('tipo'), ubicacion: 'store'
    });
  };
  fireEvent.change(screen.getByLabelText('Observación'), { target: { value: 'Detalle' } });
  await selectEvidence(['uno.jpg', 'dos.jpg', 'tres.jpg']);
  fireEvent.click(screen.getByRole('button', { name: 'Subir imágenes' }));
  await screen.findByText('1 de 3 imágenes subidas');
  expect(screen.getByLabelText('1 previas confirmadas')).toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: 'Archivos pendientes' })).queryByText('uno.jpg')).not.toBeInTheDocument();
  expect(uploadNames()).toEqual(['uno.jpg', 'dos.jpg']);
  for (const name of ['Atrás', 'Continuar', 'Volver al inicio', 'Abrir menú', 'Tipo de imagen']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
  expect(screen.getByLabelText('Observación')).toBeDisabled();
  expect(screen.getByLabelText('Seleccionar evidencias')).toBeDisabled();
  await act(async () => failSecond(response(422, { mensaje: 'Fallo controlado' })));
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar no confirmadas' }));
  await screen.findByText('3 de 3 imágenes subidas');
  expect(uploadNames()).toEqual(['uno.jpg', 'dos.jpg', 'dos.jpg', 'tres.jpg']);
  expect(screen.getByLabelText('3 previas confirmadas')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Archivos pendientes' })).not.toBeInTheDocument();
  const body = calls('/imagenes/subir')[0][1].body;
  expect(Array.from(body.keys())).toEqual(['imagen', 'tipo', 'sesionId', 'ubicacion', 'observacion']);
  expect(body.get('observacion')).toBe('Detalle');
});

test('una respuesta perdida no se reenvía automáticamente y conserva la selección no confirmada', async () => {
  await evidenceStep();
  overrides['/imagenes/subir'] = () => Promise.reject(new TypeError('Connection lost'));
  await selectEvidence(['incierta.jpg']);
  fireEvent.click(screen.getByRole('button', { name: 'Subir imagen' }));
  await screen.findByText(/No se reintentará automáticamente/);
  expect(screen.getByLabelText('0 previas confirmadas')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Archivos pendientes' })).toHaveTextContent('incierta.jpg');
  expect(uploadNames()).toEqual(['incierta.jpg']);
  expect(screen.getByRole('button', { name: 'Reintentar no confirmadas' })).toBeEnabled();
});

test('sube más de 20 evidencias secuencialmente sin truncar el lote', async () => {
  await evidenceStep();
  let active = 0;
  let peak = 0;
  overrides['/imagenes/subir'] = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active -= 1;
    return response(201, { url: 'stored', sesionId: 'session', tipo: 'previa', ubicacion: 'store' });
  };
  await uploadEvidence(Array.from({ length: 40 }, (_, index) => `${index}.jpg`));
  expect(uploadNames()).toHaveLength(40);
  expect(peak).toBe(1);
  expect(screen.getByLabelText('40 previas confirmadas')).toBeInTheDocument();
});

test.each([
  { ok: true, persistido: false },
  { ok: true },
  { ok: false, persistido: true }
])('el acta requiere ok y persistido estrictamente true: %o', async (data) => {
  localStorage.setItem('dashStep', '4');
  mount();
  overrides['/acta/subir'] = () => response(200, data);
  await selectPdf();
  fireEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
  await screen.findByText(/no confirmó la persistencia/);
  expect(screen.getByText('acta.pdf')).toBeInTheDocument();
  expect(screen.queryByText('Acta cargada correctamente')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();

  overrides['/acta/subir'] = () => response(200, { ok: true, persistido: true });
  fireEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
  await screen.findByText('Acta cargada correctamente');
  expect(screen.queryByText('acta.pdf')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  await selectPdf('sustituta.pdf');
  expect(screen.queryByText('Acta cargada correctamente')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  const body = calls('/acta/subir')[0][1].body;
  expect(body.get('sesionId')).toBe('session');
  expect(body.get('acta').name).toBe('acta.pdf');
});

test('una conversión fallida queda identificada y puede quitarse sin enviar el original', async () => {
  await evidenceStep();
  optimizeMany.mockImplementationOnce(async ([original]) => [{ original, file: null, error: `${original.name}: no pudo procesarse.` }]);
  const file = new File(['BM...'], 'rota.bmp', { type: 'image/bmp' });
  fireEvent.change(screen.getByLabelText('Seleccionar evidencias'), { target: { files: [file] } });
  await screen.findByText('rota.bmp: no pudo procesarse.');
  expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar rota.bmp' }));
  expect(screen.queryByText('rota.bmp')).not.toBeInTheDocument();
  expect(calls('/imagenes/subir')).toHaveLength(0);
});

test('un acta con una imagen no convertida bloquea el envío hasta corregirla', async () => {
  localStorage.setItem('dashStep', '4');
  mount();
  optimizeMany.mockImplementationOnce(async ([original]) => [{ original, file: null, error: 'acta.bmp: conversión fallida' }]);
  fireEvent.change(screen.getByLabelText('Seleccionar imágenes del acta'), {
    target: { files: [new File(['BM...'], 'acta.bmp', { type: 'image/bmp' })] }
  });
  await screen.findByText('acta.bmp: conversión fallida');
  expect(screen.getByRole('button', { name: 'Subir acta' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar acta.bmp' }));
  fireEvent.change(screen.getByLabelText('Seleccionar imágenes del acta'), { target: { files: [jpeg('acta.jpg')] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Subir acta' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
  await screen.findByText('Acta cargada correctamente');
  expect(calls('/acta/subir')[0][1].body.get('imagenes').name).toBe('acta.jpg');
});

test('rechaza evidencia mayor de 15 MiB justo antes del envío sin incrementar contadores', async () => {
  await evidenceStep();
  const large = jpeg('grande.jpg');
  Object.defineProperty(large, 'size', { value: 15 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText('Seleccionar evidencias'), { target: { files: [large] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Subir imagen' }));
  await screen.findByRole('button', { name: 'Reintentar no confirmadas' });
  expect(screen.getByRole('list', { name: 'Archivos pendientes' })).toHaveTextContent('15 MiB');
  expect(screen.getByLabelText('0 previas confirmadas')).toBeInTheDocument();
  expect(calls('/imagenes/subir')).toHaveLength(0);
});

test('PDF mayor de 25 MiB conserva la selección para corregirla y no se envía', async () => {
  localStorage.setItem('dashStep', '4');
  mount();
  const large = pdf('grande.pdf');
  Object.defineProperty(large, 'size', { value: 25 * 1024 * 1024 + 1 });
  fireEvent.change(screen.getByLabelText('Seleccionar PDF del acta'), { target: { files: [large] } });
  await waitFor(() => expect(screen.getAllByText(/25 MiB/).length).toBeGreaterThan(0));
  expect(screen.getByText('grande.pdf')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Subir acta' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  expect(calls('/acta/subir')).toHaveLength(0);
});

test('generación de 62 s: estado visible, un solo envío y enlace conservado si falla la limpieza', async () => {
  await readyToGenerate();
  let complete;
  overrides['/pdf/generar/session'] = () => new Promise((resolve) => { complete = resolve; });
  overrides['/pdf/session/reset/session'] = () => response(200, { ok: false });
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Generar PDF' }));
  fireEvent.click(screen.getByRole('button', { name: 'No, generar sin GPS' }));
  await flush();
  act(() => jest.advanceTimersByTime(62000));
  expect(screen.getByRole('button', { name: 'Generando...' })).toBeDisabled();
  expect(screen.getByText(/Los lotes grandes pueden tardar/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
  expect(calls('/pdf/generar/session')).toHaveLength(1);
  expect(calls('/pdf/generar/session')[0][1].signal.aborted).toBe(false);
  await act(async () => complete(response(201, { ok: true, id: 'report', previewUrl, filename })));
  await flush();
  expect(screen.getByRole('link', { name: 'Ver PDF' })).toHaveAttribute('href', previewUrl);
  expect(screen.getByRole('link', { name: 'Ver PDF' })).toHaveAttribute('title', filename);
  expect(screen.getByText(/no se confirmó la limpieza/)).toBeInTheDocument();
  expect(calls('/pdf/session/reset/session')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Compartir por WhatsApp' })).toBeEnabled();
});

test('desconexión al generar: 404 no limpia ni regenera; una consulta posterior recupera el intento exacto', async () => {
  await readyToGenerate();
  overrides['/pdf/generar/session'] = () => Promise.reject(new TypeError('Connection lost'));
  jest.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Generar PDF' }));
  fireEvent.click(screen.getByRole('button', { name: 'No, generar sin GPS' }));
  for (let index = 0; index < 6; index += 1) {
    await flush();
    if (index < 5) act(() => jest.advanceTimersByTime(15000));
  }
  await flush();
  expect(screen.getByText(/Resultado incierto:/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Volver al inicio' })).toBeDisabled();
  expect(calls('/pdf/session/reset/session')).toHaveLength(0);
  expect(calls('/pdf/generar/session')).toHaveLength(1);
  expect(localStorage.getItem('numeroIncidencia')).toBe('123');
  const pending = JSON.parse(sessionStorage.getItem('cubica_generacion_pendiente_session'));
  expect(pending.details).toMatchObject({ cntPrevias: 2, cntPosteriores: 1, actaOK: true });
  overrides['/informes/utils/ultimo-por-sesion'] = () => response(200, {
    _id: 'report', sesionId: 'session', numeroIncidencia: '123',
    tiendaId: { _id: 'store' }, createdAt: new Date().toISOString()
  });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar resultado' }));
  await flush();
  expect(screen.getByRole('link', { name: 'Ver PDF' })).toHaveAttribute('href', previewUrl);
  expect(calls('/pdf/generar/session')).toHaveLength(1);
  expect(calls('/pdf/session/reset/session')).toHaveLength(1);
  expect(sessionStorage.getItem('cubica_generacion_pendiente_session')).toBeNull();
});

test('al recargar un intento pendiente conserva su resumen y obliga a consultar antes de generar', async () => {
  sessionStorage.setItem('cubica_generacion_pendiente_session', JSON.stringify({
    sesionId: 'session', tiendaId: 'store', numeroIncidencia: '123', startedAt: new Date().toISOString(),
    details: { numeroIncidencia: '123', cntPrevias: 40, cntPosteriores: 40, actaOK: true }
  }));
  mount();
  expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Consultar resultado' })).toBeEnabled();
  expect(screen.getByText('123')).toBeInTheDocument();
  expect(screen.getAllByText('40')).toHaveLength(2);
  await waitFor(() => expect(calls('/tiendas')).toHaveLength(1));
  expect(calls('/pdf/session/reset/session')).toHaveLength(0);
});
