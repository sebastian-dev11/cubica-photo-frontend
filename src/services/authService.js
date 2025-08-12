export async function login(usuario, contraseña) {
  try {
    const response = await fetch('https://cubica-photo-app.onrender.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contraseña }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        mensaje: data.mensaje,
        nombre: data.nombre
      };
    } else {
      return {
        mensaje: data.mensaje || 'Credenciales incorrectas',
        nombre: null
      };
    }
  } catch (error) {
    return {
      mensaje: 'Error en la conexión con el servidor',
      nombre: null
    };
  }
}
