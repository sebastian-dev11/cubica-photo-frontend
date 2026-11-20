import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import RequireSession from './RequireSession';
import { http } from '../services/http';

const jwt = (expiresAt) => `header.${btoa(JSON.stringify({ exp: expiresAt / 1000 })).replace(/=/g, '')}.signature`;
const response = (status, data) => ({ status, ok: status < 400, text: async () => JSON.stringify(data) });

function Location() {
  const { pathname } = useLocation();
  const action = useNavigationType();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{pathname}:{action}</output>
    <button onClick={() => navigate(-1)}>Atrás</button>
    <button onClick={() => navigate('/informes')}>Informes</button>
  </>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/', '/dashboard']} initialIndex={1}>
      <Location />
      <Routes>
        <Route path="/" element={<h1>Iniciar sesión</h1>} />
        <Route element={<RequireSession />}>
          <Route path="/dashboard" element={<h1>Panel privado</h1>} />
          <Route path="/informes" element={<h1>Informes privados</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-20T12:00:00Z'));
});

afterEach(() => jest.useRealTimers());

test('redirige al login sin montar la página privada cuando falta el token', () => {
  mount();
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(screen.queryByText('Panel privado')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/:REPLACE');
});

test('redirige y elimina un JWT que ya estaba vencido al abrir una ruta', () => {
  localStorage.setItem('token', jwt(Date.now() - 1000));
  localStorage.setItem('sesionId', 'old-session');
  mount();
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('sesionId')).toBeNull();
});

test('redirige al caducar aun sin interacción ni solicitudes y no permite regresar con Atrás', () => {
  localStorage.setItem('token', jwt(Date.now() + 60000));
  mount();
  expect(screen.getByRole('heading', { name: 'Panel privado' })).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(59999));
  expect(screen.queryByText('Iniciar sesión')).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));

  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/:REPLACE');
  expect(localStorage.getItem('token')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
  expect(screen.queryByText('Panel privado')).not.toBeInTheDocument();
});

test('mantiene la vigilancia al navegar entre rutas protegidas', () => {
  localStorage.setItem('token', jwt(Date.now() + 1000));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Informes' }));
  expect(screen.getByRole('heading', { name: 'Informes privados' })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});

test.each(['focus', 'pageshow', 'visibilitychange'])(
  'comprueba el vencimiento al volver a la app mediante %s, aunque el temporizador se haya suspendido',
  (event) => {
    localStorage.setItem('token', jwt(Date.now() + 60000));
    mount();
    jest.setSystemTime(Date.now() + 120000);
    act(() => (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event)));
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  }
);

test.each(['token', null])('redirige si otra pestaña borra la sesión (storage key: %s)', (key) => {
  localStorage.setItem('token', 'opaque-token');
  mount();
  localStorage.removeItem('token');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage })));
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});

test('reprograma el vencimiento si otra pestaña cambia el token', () => {
  localStorage.setItem('token', jwt(Date.now() + 1000));
  mount();
  const newToken = jwt(Date.now() + 10000);
  localStorage.setItem('token', newToken);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage })));
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole('heading', { name: 'Panel privado' })).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBe(newToken);
  act(() => jest.advanceTimersByTime(9000));
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});

test('un 401 del backend redirige incluso si el token no tiene exp', async () => {
  localStorage.setItem('token', 'opaque-token');
  mount();
  fetch.mockResolvedValue(response(401, { mensaje: 'Token inválido o expirado' }));
  await act(async () => {
    await expect(http.get('/privado')).rejects.toMatchObject({ kind: 'authentication' });
  });
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('un 403 no cierra la sesión ni redirige', async () => {
  localStorage.setItem('token', 'opaque-token');
  mount();
  fetch.mockResolvedValue(response(403, { mensaje: 'Sin permisos' }));
  await act(async () => {
    await expect(http.get('/privado')).rejects.toMatchObject({ kind: 'permission' });
  });
  expect(screen.getByRole('heading', { name: 'Panel privado' })).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBe('opaque-token');
});

test('limpia el temporizador al desmontarse', () => {
  const token = jwt(Date.now() + 1000);
  localStorage.setItem('token', token);
  const { unmount } = mount();
  unmount();
  act(() => jest.advanceTimersByTime(2000));
  expect(localStorage.getItem('token')).toBe(token);
  expect(jest.getTimerCount()).toBe(0);
});

test('no vence inmediatamente por desbordamiento si exp supera el máximo de setTimeout', () => {
  localStorage.setItem('token', jwt(Date.now() + 2147483647 + 10000));
  mount();
  act(() => jest.advanceTimersByTime(2147483647));
  expect(screen.getByRole('heading', { name: 'Panel privado' })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
});
