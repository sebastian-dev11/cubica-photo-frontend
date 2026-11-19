import { API_URL, API_TIMEOUTS } from './apiConfig';

function getToken() {
  return localStorage.getItem('token');
}

function buildUrl(path, params) {
  const basePath = path.startsWith('http') ? path : `${API_URL}${path}`;
  const url = new URL(basePath, window.location.origin);

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function tipoError(status) {
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (status === 413) return 'size';
  if ([400, 415, 422].includes(status)) return 'validation';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'server';
  return 'http';
}

const mensajes = {
  authentication: 'La sesión no está autorizada o ha vencido. Inicia sesión nuevamente.',
  permission: 'No tienes permisos para realizar esta operación.',
  validation: 'Revisa los archivos y los datos enviados.',
  size: 'El archivo supera el tamaño permitido.',
  server: 'El servidor no pudo completar la solicitud.',
  connection: 'Se perdió la conexión con el servidor.',
  timeout: 'Se agotó el tiempo de espera. El servidor podría seguir procesando la solicitud.',
  http: 'No se pudo completar la solicitud.'
};

function crearError(data, status, kind = tipoError(status)) {
  const detalle = data?.mensaje || data?.error || data?.message;
  const error = new Error(`${mensajes[kind]}${typeof detalle === 'string' ? ` ${detalle}` : ''}`);
  error.kind = kind;

  error.response = {
    status,
    data
  };

  return error;
}

function crearErrorCancelacion() {
  const error = new Error('La solicitud fue cancelada.');
  error.name = 'AbortError';
  error.kind = 'aborted';
  return error;
}

export function mensajeError(error) {
  return error?.message || 'No se pudo completar la operación.';
}

// Un gateway también puede fallar después de que el servidor haya guardado los datos.
export function resultadoIncierto(error) {
  return ['connection', 'timeout', 'server', 'protocol'].includes(error?.kind);
}

async function request(path, options = {}) {
  const token = options.auth === false ? null : getToken();
  const isFormData = options.body instanceof FormData;

  const headers = new Headers({
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  });

  // Incluso si el llamador lo proporciona, el boundary debe asignarlo el navegador.
  if (isFormData) headers.delete('Content-Type');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const callerSignal = options.signal;
  let timeoutReached = false;
  let timer = null;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutMs = options.timeoutMs ?? API_TIMEOUTS.request;

  try {
    if (callerSignal?.aborted) throw crearErrorCancelacion();
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timeoutReached = true;
        controller.abort();
      }, timeoutMs);
    }

    // No reintentar: incluso GET /pdf/generar produce efectos en el servidor.
    const response = await fetch(buildUrl(path, options.params), {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
      cache: 'no-store',
      body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await parseResponse(response);
    if (!response.ok) throw crearError(data, response.status);
    return data;
  } catch (error) {
    // No redirigir al recibir 401: se perderían la selección y los éxitos parciales.
    if (error.response) throw error;
    if (callerSignal?.aborted && !timeoutReached) throw crearErrorCancelacion();
    throw crearError(null, 0, timeoutReached ? 'timeout' : 'connection');
  } finally {
    if (timer !== null) clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export const http = {
  get(path, params, options = {}) {
    return request(path, {
      method: 'GET',
      params,
      ...options
    });
  },

  post(path, body, options = {}) {
    return request(path, {
      method: 'POST',
      body,
      ...options
    });
  },

  put(path, body, options = {}) {
    return request(path, {
      method: 'PUT',
      body,
      ...options
    });
  },

  patch(path, body, options = {}) {
    return request(path, {
      method: 'PATCH',
      body,
      ...options
    });
  },

  delete(path, body, options = {}) {
    return request(path, {
      method: 'DELETE',
      body,
      ...options
    });
  }
};

export { API_URL };
