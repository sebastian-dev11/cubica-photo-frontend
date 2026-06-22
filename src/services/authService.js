const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function crearError(data, status) {
  const error = new Error(data?.mensaje || data?.error || 'Error en la solicitud');

  error.response = {
    status,
    data
  };

  return error;
}

export async function login(usuario, contraseña) {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuario,
        contraseña
      })
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      throw crearError(data, response.status);
    }

    return {
      mensaje: data.mensaje || 'Acceso concedido',
      token: data.token,
      sesionId: data.sesionId,
      nombre: data.nombre || 'Tecnico',
      userId: data.userId,
      usuario: data.usuario || usuario,
      rol: data.rol || 'tecnico',
      isAdmin: Boolean(data.isAdmin)
    };
  } catch (error) {
    if (error.response) {
      throw error;
    }

    throw crearError({
      mensaje: 'Error en la conexion con el servidor'
    }, 0);
  }
}