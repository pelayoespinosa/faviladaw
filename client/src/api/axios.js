import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.BASE_URL + 'api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function irALogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = import.meta.env.BASE_URL + 'login';
}

let refrescoEnCurso = null;
function refrescar() {
  refrescoEnCurso ||= axios.post(import.meta.env.BASE_URL + 'api/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') })
    .finally(() => { refrescoEnCurso = null; });
  return refrescoEnCurso;
}

api.interceptors.response.use(
  res => res,
  async err => {
    const { config, response } = err;
    const rutaAuth = config?.url === '/auth/refresh' || config?.url === '/auth/login';
    const refreshToken = localStorage.getItem('refreshToken');

    if (response?.status === 401 && !rutaAuth && !config._retried && refreshToken) {
      config._retried = true;
      try {
        const { data } = await refrescar();
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        config.headers.Authorization = `Bearer ${data.token}`;
        return api(config);
      } catch {
        irALogin();
        return Promise.reject(err);
      }
    }
    if (response?.status === 401) irALogin();
    return Promise.reject(err);
  }
);

export default api;
