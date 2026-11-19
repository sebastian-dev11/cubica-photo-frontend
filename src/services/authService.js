import { http } from './http';

export async function login(usuario, contraseña, options = {}) {
  const data = await http.post('/auth/login', { usuario, contraseña }, {
    auth: false,
    ...options
  });
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
}
