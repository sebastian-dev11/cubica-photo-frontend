export async function login(usuario, contraseña) {
  try {
    const response = await fetch('https://cubica-photo-app.onrender.com/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contraseña }),
    });

    if (response.ok) {
      return '✅ Acceso concedido';
    } else {
      return '❌ Credenciales incorrectas';
    }
  } catch (error) {
    return '⚠️ Error en la conexión con el servidor';
  }
}

