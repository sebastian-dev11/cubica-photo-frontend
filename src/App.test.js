import { render, screen } from '@testing-library/react';
import App from './App';

afterEach(() => window.history.replaceState({}, '', '/'));

test('muestra el acceso a Cubica sin solicitar datos del backend', () => {
  render(<App />);
  expect(screen.getByLabelText('Cédula o usuario')).toBeInTheDocument();
  expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['/dashboard', '/informes', '/usuarios', '/tiendas'])(
  'protege %s y vuelve al login sin solicitar datos si no hay token',
  (path) => {
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(fetch).not.toHaveBeenCalled();
  }
);

test.each(['/dashboard', '/informes', '/usuarios', '/tiendas'])(
  'protege %s al recargar con un token vencido',
  (path) => {
    localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: 0 }))}.signature`);
    localStorage.setItem('sesionId', 'old-session');
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('sesionId')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  }
);
