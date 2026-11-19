import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TiendasPage from './TiendasPage';
import InformesPage from './InformesPage';
import { abrirVistaPreviaInforme, obtenerVistaPreviaInforme } from '../services/pdfPreviewService';

const previewUrl = 'https://backend.test/pdf/preview/token';
const filename = 'INFORME TÉCNICO-123-TIENDA.pdf';
const historico = {
  _id: 'historico', numeroIncidencia: '123', title: 'Informe histórico', createdAt: '2025-01-01',
  url: 'https://res.cloudinary.com/legacy/report.pdf', shareUrl: 'https://res.cloudinary.com/legacy/report.pdf'
};
const response = (data) => ({ status: 200, ok: true, text: async () => JSON.stringify(data) });
let popup;

beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('isAdmin', 'true');
  popup = {
    opener: window, closed: false,
    document: { open: jest.fn(), write: jest.fn(), close: jest.fn(), getElementById: jest.fn() },
    location: { replace: jest.fn() }
  };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  fetch.mockImplementation(async (url) => {
    const path = new URL(url).pathname;
    if (path === '/api/tiendas') return response({ data: [{ _id: 'store', nombre: 'Tienda' }] });
    if (path === '/api/tiendas/regionales') return response({ data: [] });
    if (path === '/api/informes' || path === '/api/informes/tienda/store') {
      return response({ data: [historico], total: 1, totalPages: 1 });
    }
    if (path === '/api/pdf/preview-link/historico') {
      return response({ ok: true, previewUrl, filename });
    }
    throw new Error(`Ruta sin simular: ${path}`);
  });
});

afterEach(() => jest.restoreAllMocks());

test.each([
  ['Tiendas', TiendasPage, 'Abrir PDF'],
  ['Informes', InformesPage, 'Ver PDF']
])('%s abre históricos con previewUrl, sin navegar a Cloudinary', async (name, Page, button) => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  if (name === 'Tiendas') fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
  fireEvent.click(await screen.findByRole('button', { name: button }));
  expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
  await waitFor(() => expect(popup.location.replace).toHaveBeenCalledWith(previewUrl));
  expect(popup.opener).toBeNull();
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/pdf/preview-link/historico'))).toBe(true);
  expect(popup.location.replace).not.toHaveBeenCalledWith(historico.url);
});

test('la ventana se abre antes de esperar al backend y se conserva filename literalmente', async () => {
  let resolve;
  fetch.mockImplementation(() => new Promise((res) => { resolve = res; }));
  const opening = abrirVistaPreviaInforme('historico');
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(popup.location.replace).not.toHaveBeenCalled();
  resolve(response({ ok: true, previewUrl, filename }));
  await expect(opening).resolves.toEqual({ previewUrl, filename });
  expect(popup.location.replace).toHaveBeenCalledWith(previewUrl);
});

test.each([
  ['Tiendas', TiendasPage],
  ['Informes', InformesPage]
])('%s comparte históricos mediante previewUrl', async (name, Page) => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  if (name === 'Tiendas') fireEvent.click(await screen.findByRole('button', { name: 'Historial' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Compartir por WhatsApp' }));
  await waitFor(() => expect(popup.location.replace).toHaveBeenCalledTimes(1));
  const url = new URL(popup.location.replace.mock.calls[0][0]);
  expect(url.origin).toBe('https://wa.me');
  expect(url.searchParams.get('text')).toContain(previewUrl);
  expect(url.searchParams.get('text')).not.toContain('cloudinary');
});

test('si el navegador bloquea ventanas muestra una acción clara y no solicita otro enlace', async () => {
  window.open.mockReturnValue(null);
  await expect(abrirVistaPreviaInforme('historico')).rejects.toThrow('Permite las ventanas emergentes');
  expect(fetch).not.toHaveBeenCalled();
});

test('no usa una URL de almacenamiento como fallback si falta previewUrl', async () => {
  fetch.mockResolvedValue(response({ url: 'https://r2.test/temporal?signature=123' }));
  await expect(obtenerVistaPreviaInforme('historico')).rejects.toThrow('enlace de vista previa');
});
