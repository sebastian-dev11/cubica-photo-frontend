import axios from 'axios';

const API_URL = 'https://cubica-photo-app.onrender.com/auth';

const login = (usuario, contraseña) => {
  return axios.post(`${API_URL}/login`, { usuario, contraseña });
};

export default { login };
