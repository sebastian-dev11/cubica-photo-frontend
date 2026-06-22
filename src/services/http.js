const API_URL = 'https://cubica-photo-app.onrender.com';

function getToken() {
  return localStorage.getItem('token');
}

function limpiarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('sesionId');
  localStorage.removeItem('nombreTecnico');
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('userId');
  localStorage.removeItem('usuario');
  localStorage.removeItem('rol');
}

function buildUrl(path, params) {
  const basePath = path.startsWith('http') ? path : `${API_URL}${path}`;
  const url = new URL(basePath);

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

function crearError(data, status) {
  const error = new Error(
    data?.mensaje ||
    data?.error ||
    data?.message ||
    'Error en la solicitud'
  );

  error.response = {
    status,
    data
  };

  return error;
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options.params), {
    method: options.method || 'GET',
    headers,
    body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      limpiarSesion();
      window.location.href = '/';
    }

    throw crearError(data, response.status);
  }

  return data;
}

export const http = {
  get(path, params) {
    return request(path, {
      method: 'GET',
      params
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