import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

process.env.REACT_APP_API_URL = '/api';
process.env.REACT_APP_PDF_TIMEOUT_MS = '600000';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Toda la suite está aislada: una ruta no simulada nunca llega a la red.
  global.fetch = jest.fn(() => Promise.reject(new Error('Solicitud de red no simulada')));
  window.matchMedia = jest.fn(() => ({
    matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn()
  }));
  URL.createObjectURL = jest.fn(() => 'blob:preview-local');
  URL.revokeObjectURL = jest.fn();
  window.scrollTo = jest.fn();
});
