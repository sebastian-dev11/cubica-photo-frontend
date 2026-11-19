import { render, screen } from '@testing-library/react';
import App from './App';

test('muestra el acceso a Cubica sin solicitar datos del backend', () => {
  render(<App />);
  expect(screen.getByLabelText('Cédula o usuario')).toBeInTheDocument();
  expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
