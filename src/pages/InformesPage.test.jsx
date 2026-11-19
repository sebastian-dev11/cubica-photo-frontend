import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InformesPage from './InformesPage';
import informesService from '../services/informesService';
import { http } from '../services/http';

jest.mock('../services/http', () => ({
  http: { get: jest.fn() }
}));

jest.mock('../services/informesService', () => ({
  __esModule: true,
  default: {
    listarInformes: jest.fn(),
    eliminarInforme: jest.fn()
  }
}));

const informe = (title) => ({
  _id: title,
  title,
  createdAt: '2026-01-01T12:00:00.000Z',
  numeroIncidencia: '123'
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.setItem('token', 'test-token');
  http.get.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('ignora resultados obsoletos cuando cambia el filtro mientras la consulta sigue pendiente', async () => {
  let resolveInitial;
  informesService.listarInformes
    .mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }))
    .mockResolvedValueOnce({ data: [informe('Informe reciente')], total: 1, totalPages: 1 });

  render(<MemoryRouter><InformesPage /></MemoryRouter>);
  await waitFor(() => expect(informesService.listarInformes).toHaveBeenCalledTimes(1));

  fireEvent.change(screen.getByPlaceholderText('Escribe para filtrar'), {
    target: { value: 'reciente' }
  });

  await waitFor(() => expect(informesService.listarInformes).toHaveBeenCalledTimes(2));
  await screen.findByText('Informe reciente');
  expect(informesService.listarInformes.mock.calls[0][1].signal.aborted).toBe(true);

  await act(async () => {
    resolveInitial({ data: [informe('Resultado obsoleto')], total: 1, totalPages: 1 });
  });

  expect(screen.getByText('Informe reciente')).toBeInTheDocument();
  expect(screen.queryByText('Resultado obsoleto')).not.toBeInTheDocument();
});

test('al fallar la carga muestra error en vez de un estado vacío y permite actualizar', async () => {
  informesService.listarInformes
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce({ data: [], total: 0, totalPages: 1 });

  render(<MemoryRouter><InformesPage /></MemoryRouter>);

  expect(await screen.findByRole('status')).toHaveTextContent('Error al cargar los informes');
  expect(screen.queryByText('No hay informes')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(await screen.findByText('No hay informes')).toBeInTheDocument();
});
