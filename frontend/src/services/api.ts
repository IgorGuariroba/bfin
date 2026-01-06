import axios from 'axios';

// Criar instância do axios
const api = axios.create({
  baseURL: '/api/v1', // Vite proxy vai redirecionar para http://localhost:3000/api/v1
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('@bfin:token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de resposta
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado, tentar refresh
      const refreshToken = localStorage.getItem('@bfin:refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          });

          // Salvar novos tokens
          localStorage.setItem('@bfin:token', data.tokens.access_token);
          localStorage.setItem('@bfin:refreshToken', data.tokens.refresh_token);

          // Repetir requisição original
          error.config.headers.Authorization = `Bearer ${data.tokens.access_token}`;
          return api.request(error.config);
        } catch (refreshError) {
          // Refresh falhou, fazer logout
          localStorage.removeItem('@bfin:token');
          localStorage.removeItem('@bfin:refreshToken');
          localStorage.removeItem('@bfin:user');
          window.location.href = '/login';
        }
      } else {
        // Sem refresh token, redirecionar para login
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
