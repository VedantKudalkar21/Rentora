import axios from 'axios';

let accessToken = sessionStorage.getItem('rentora.accessToken');
export function hasAuthToken() { return Boolean(accessToken); }
export function setAuthSession(response) {
  accessToken = response.accessToken;
  sessionStorage.setItem('rentora.accessToken', accessToken);
  return response.user;
}
export function clearAuthSession() {
  accessToken = null;
  sessionStorage.removeItem('rentora.accessToken');
}

export const http = axios.create({ baseURL: '/api', timeout: 15000 });
http.interceptors.request.use(config => {
  if (accessToken && !config.skipAuth) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
http.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?.headers?.Authorization && !error.config?.skipAuth) {
    clearAuthSession();
    window.dispatchEvent(new Event('rentora:unauthorized'));
  }
  const normalized = new Error(error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : 'Cannot reach Rentora. Check that the backend is running.'));
  normalized.status = error.response?.status;
  return Promise.reject(normalized);
});
export async function api(path, options = {}) {
  const response = await http.request({ url: path, method: options.method || 'GET', data: options.body, skipAuth: options.skipAuth || false });
  return response.data;
}
