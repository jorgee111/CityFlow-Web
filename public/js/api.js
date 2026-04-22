// public/js/api.js
// Cliente API centralizado - maneja JWT automáticamente

const API_BASE = '/api';

const getToken = () => localStorage.getItem('cf_token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('cf_user') || 'null'); } catch { return null; } };

const api = {
  async request(method, endpoint, body = null) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);

    // Token expirado → redirigir a login
    if (res.status === 401) {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      window.location.href = '/index.html';
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  },

  get:    (endpoint)        => api.request('GET',    endpoint),
  post:   (endpoint, body)  => api.request('POST',   endpoint, body),
  put:    (endpoint, body)  => api.request('PUT',    endpoint, body),
  delete: (endpoint)        => api.request('DELETE', endpoint),
};

// Redirigir si no hay token (para páginas protegidas)
const requireAuth = () => {
  if (!getToken()) {
    window.location.href = '/index.html';
  }
};

// Redirigir si el rol no coincide
const requireRole = (allowedRoles) => {
  requireAuth();
  const user = getUser();
  if (!user || !allowedRoles.includes(user.role)) {
    // Redirigir al dashboard correcto
    redirectByRole(user?.role);
  }
};

const redirectByRole = (role) => {
  const map = { pasajero: '/dashboard.html', conductor: '/conductor.html', gestor: '/gestor.html' };
  window.location.href = map[role] || '/dashboard.html';
};

// Exportar globalmente
window.api = api;
window.getUser = getUser;
window.getToken = getToken;
window.requireAuth = requireAuth;
window.requireRole = requireRole;
window.redirectByRole = redirectByRole;
