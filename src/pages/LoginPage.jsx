import LoginForm from '../components/LoginForm';
import authService from '../services/authService';

const LoginPage = () => {
  const handleLogin = async (usuario, contraseña) => {
    try {
      const res = await authService.login(usuario, contraseña);
      if (res.status === 200) {
        localStorage.setItem('sesionId', usuario); // 🔐 para usar en la subida
        return { success: true };
      } else {
        return { success: false, message: res.data };
      }
    } catch (err) {
      return { success: false, message: 'Error de conexión con el servidor' };
    }
  };

  return <LoginForm onLogin={handleLogin} />;
};

export default LoginPage;
