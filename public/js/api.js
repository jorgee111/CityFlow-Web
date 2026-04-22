// public/js/api.js
// Cliente API centralizado - maneja JWT automáticamente
//
// ┌─────────────────────────────────────────────────────────┐
// │  DEMO_MODE = true  →  Funciona SIN servidor backend     │
// │  DEMO_MODE = false →  Usa el servidor Express real      │
// └─────────────────────────────────────────────────────────┘
const DEMO_MODE = true;

// ─── Datos mock para demo ─────────────────────
const DEMO_USERS = {
  'admin@cityflow.es':  { id: 1, email: 'admin@cityflow.es',  password: 'Admin1234!',  display_name: 'Admin CityFlow', role: 'gestor',    assigned_line: null },
  'carlos@cityflow.es': { id: 2, email: 'carlos@cityflow.es', password: 'Conductor1!', display_name: 'Carlos López',   role: 'conductor', assigned_line: '27' },
  'ana@ejemplo.es':     { id: 3, email: 'ana@ejemplo.es',     password: 'Pasajero1!',  display_name: 'Ana García',     role: 'pasajero',  assigned_line: null },
};

const DEMO_BUSES = [
  { id:1, bus_code:'BUS-27-001', line:'27',  destination:'Plaza Castilla',  lat:40.4200, lng:-3.7000, occupancy_pct:30,  occupancy_level:'low',    speed_kmh:35, eta_minutes:3,  line_color:'#e8a838', is_active:true },
  { id:2, bus_code:'BUS-27-002', line:'27',  destination:'Plaza Castilla',  lat:40.4150, lng:-3.7020, occupancy_pct:62,  occupancy_level:'medium', speed_kmh:28, eta_minutes:8,  line_color:'#e8a838', is_active:true },
  { id:3, bus_code:'BUS-65-001', line:'65',  destination:'Moncloa',         lat:40.4320, lng:-3.7190, occupancy_pct:65,  occupancy_level:'medium', speed_kmh:40, eta_minutes:7,  line_color:'#3b9ed4', is_active:true },
  { id:4, bus_code:'BUS-82-001', line:'82',  destination:'Atocha',          lat:40.4060, lng:-3.6890, occupancy_pct:91,  occupancy_level:'high',   speed_kmh:22, eta_minutes:2,  line_color:'#e05252', is_active:true },
  { id:5, bus_code:'BUS-82-002', line:'82',  destination:'Pirámides',       lat:40.4080, lng:-3.7100, occupancy_pct:78,  occupancy_level:'high',   speed_kmh:30, eta_minutes:5,  line_color:'#e05252', is_active:true },
  { id:6, bus_code:'BUS-44-001', line:'44',  destination:'Chamartín',       lat:40.4500, lng:-3.6920, occupancy_pct:18,  occupancy_level:'low',    speed_kmh:45, eta_minutes:12, line_color:'#4ade80', is_active:true },
  { id:7, bus_code:'BUS-132-001',line:'132', destination:'Las Tablas',      lat:40.4680, lng:-3.7050, occupancy_pct:55,  occupancy_level:'medium', speed_kmh:38, eta_minutes:5,  line_color:'#a78bfa', is_active:true },
  { id:8, bus_code:'BUS-N1-001', line:'N1',  destination:'Las Tablas',      lat:40.4170, lng:-3.7040, occupancy_pct:12,  occupancy_level:'low',    speed_kmh:50, eta_minutes:15, line_color:'#94a3b8', is_active:true },
  { id:9, bus_code:'BUS-1-001',  line:'1',   destination:'Sol',             lat:40.4160, lng:-3.7036, occupancy_pct:88,  occupancy_level:'high',   speed_kmh:20, eta_minutes:4,  line_color:'#f97316', is_active:true },
  { id:10,bus_code:'BUS-74-001', line:'74',  destination:'Canillejas',      lat:40.4190, lng:-3.6800, occupancy_pct:50,  occupancy_level:'medium', speed_kmh:33, eta_minutes:9,  line_color:'#14b8a6', is_active:true },
];

const DEMO_INCIDENTS = [
  { id:1, user_id:2, user_name:'Carlos López', type:'normal',   title:'Retraso en parada Atocha',   description:'Acumulación de pasajeros.',  line:'27', status:'abierta',    created_at: new Date(Date.now()-3600000).toISOString(),  updated_at: new Date(Date.now()-3600000).toISOString() },
  { id:2, user_id:2, user_name:'Carlos López', type:'urgencia', title:'Avería en motor',             description:'Autobús inmovilizado en Goya.', line:'27', status:'en_proceso', created_at: new Date(Date.now()-10800000).toISOString(), updated_at: new Date(Date.now()-7200000).toISOString() },
  { id:3, user_id:2, user_name:'Carlos López', type:'refuerzo', title:'Necesito refuerzo en Retiro', description:'Alta ocupación, bus adicional.', line:'27', status:'resuelta',   created_at: new Date(Date.now()-18000000).toISOString(), updated_at: new Date(Date.now()-14400000).toISOString() },
];

const DEMO_SUGGESTIONS = [
  { id:1, user_id:3, user_name:'Ana García', message:'La app funciona muy bien, sería genial ver el tiempo en tiempo real.', response:'Gracias por tu sugerencia, lo estamos trabajando.',  created_at: new Date(Date.now()-7200000).toISOString() },
  { id:2, user_id:3, user_name:'Ana García', message:'Echaría de menos ver el historial de mis trayectos.', response:null, created_at: new Date(Date.now()-21600000).toISOString() },
];

const DEMO_USERS_LIST = [
  { id:1, email:'admin@cityflow.es',  display_name:'Admin CityFlow', role:'gestor',    assigned_line:null, status:'activo' },
  { id:2, email:'carlos@cityflow.es', display_name:'Carlos López',   role:'conductor', assigned_line:'27', status:'activo' },
  { id:3, email:'ana@ejemplo.es',     display_name:'Ana García',     role:'pasajero',  assigned_line:null, status:'activo' },
  { id:4, email:'pedro@cityflow.es',  display_name:'Pedro Martín',   role:'conductor', assigned_line:'65', status:'inactivo' },
  { id:5, email:'maria@cityflow.es',  display_name:'María Ruiz',     role:'pasajero',  assigned_line:null, status:'activo' },
];

// Simula un pequeño delay de red
const fakeDelay = (ms = 200) => new Promise(r => setTimeout(r, ms));

// ─── Router de respuestas mock ─────────────────
async function demoRequest(method, endpoint, body) {
  await fakeDelay(150);

  // ── Auth ───────────────────────────────────────
  if (endpoint === '/auth/login' && method === 'POST') {
    const u = DEMO_USERS[body?.email];
    if (!u || u.password !== body?.password) throw new Error('Credenciales incorrectas');
    const token = 'demo-token-' + u.id;
    return { token, user: { id:u.id, email:u.email, display_name:u.display_name, role:u.role, assigned_line:u.assigned_line } };
  }

  if (endpoint === '/auth/register' && method === 'POST') {
    const newUser = { id: Date.now(), email: body.email, display_name: body.display_name, role: body.role || 'pasajero', assigned_line: null };
    DEMO_USERS[body.email] = { ...newUser, password: body.password };
    return { token: 'demo-token-new', user: newUser };
  }

  if (endpoint === '/auth/me' && method === 'GET') {
    const u = getUser();
    return u || { error: 'No autenticado' };
  }

  if (endpoint === '/auth/profile' && method === 'PUT') {
    const u = getUser();
    if (u && body.display_name) {
      u.display_name = body.display_name;
      if (body.phone) u.phone = body.phone;
      localStorage.setItem('cf_user', JSON.stringify(u));
    }
    return { message: 'Perfil actualizado' };
  }

  // ── Buses ──────────────────────────────────────
  if (endpoint === '/buses' && method === 'GET') {
    // Simula movimiento ligero de los buses
    return DEMO_BUSES.map(b => ({ ...b, lat: b.lat + (Math.random()-0.5)*0.002, lng: b.lng + (Math.random()-0.5)*0.002 }));
  }

  if (endpoint === '/buses/stats' && method === 'GET') {
    const avg = Math.round(DEMO_BUSES.reduce((s,b) => s + b.occupancy_pct, 0) / DEMO_BUSES.length);
    return { active_buses: DEMO_BUSES.length, avg_occupancy: avg, high_occupancy_count: DEMO_BUSES.filter(b => b.occupancy_level === 'high').length };
  }

  if (endpoint === '/buses/lines' && method === 'GET') {
    return DEMO_BUSES.map(b => ({ ...b, eta: b.eta_minutes }));
  }

  // ── Incidents ──────────────────────────────────
  if (endpoint === '/incidents' && method === 'GET') {
    return DEMO_INCIDENTS;
  }

  if (endpoint === '/incidents' && method === 'POST') {
    const u = getUser();
    const inc = { id: DEMO_INCIDENTS.length + 1, user_id: u?.id || 99, user_name: u?.display_name || 'Demo',
      type: body.type, title: body.title, description: body.description || null,
      line: body.line || null, status: 'abierta', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    DEMO_INCIDENTS.unshift(inc);
    return inc;
  }

  if (endpoint.startsWith('/incidents/') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const inc = DEMO_INCIDENTS.find(i => i.id === id);
    if (inc) { inc.status = body.status; inc.updated_at = new Date().toISOString(); }
    return inc || { error: 'No encontrado' };
  }

  // ── Suggestions ────────────────────────────────
  if (endpoint === '/suggestions' && method === 'GET') {
    return DEMO_SUGGESTIONS;
  }

  if (endpoint === '/suggestions' && method === 'POST') {
    const u = getUser();
    const s = { id: DEMO_SUGGESTIONS.length + 1, user_id: u?.id || 99, user_name: u?.display_name || 'Demo',
      message: body.message, response: null, created_at: new Date().toISOString() };
    DEMO_SUGGESTIONS.unshift(s);
    return s;
  }

  if (endpoint.startsWith('/suggestions/') && method === 'PUT') {
    const id = parseInt(endpoint.split('/')[2]);
    const s = DEMO_SUGGESTIONS.find(s => s.id === id);
    if (s) s.response = body.response;
    return s || { error: 'No encontrado' };
  }

  // ── Users ──────────────────────────────────────
  if (endpoint === '/users' && method === 'GET') {
    return DEMO_USERS_LIST;
  }

  throw new Error(`Demo: endpoint ${method} ${endpoint} no implementado`);
}

// ─── API real (con servidor) ───────────────────
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

    if (res.status === 401) {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      window.location.href = '/index.html';
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  },

  async get(endpoint) {
    if (window.DEMO_MODE && !endpoint.startsWith('/gestures/')) return demoRequest('GET', endpoint);
    return this.request('GET', endpoint);
  },

  async post(endpoint, body) {
    if (window.DEMO_MODE && !endpoint.startsWith('/gestures/')) return demoRequest('POST', endpoint, body);
    return this.request('POST', endpoint, body);
  },

  async put(endpoint, body) {
    if (window.DEMO_MODE && !endpoint.startsWith('/gestures/')) return demoRequest('PUT', endpoint, body);
    return this.request('PUT', endpoint, body);
  },

  async delete(endpoint) {
    if (window.DEMO_MODE && !endpoint.startsWith('/gestures/')) return demoRequest('DELETE', endpoint);
    return this.request('DELETE', endpoint);
  },
};

// ─── Guards de autenticación ───────────────────
const requireAuth = () => {
  if (!getToken()) window.location.href = '/index.html';
};

const requireRole = (allowedRoles) => {
  requireAuth();
  const user = getUser();
  if (!user || !allowedRoles.includes(user.role)) redirectByRole(user?.role);
};

const redirectByRole = (role) => {
  const map = { pasajero: '/dashboard.html', conductor: '/conductor.html', gestor: '/gestor.html' };
  window.location.href = map[role] || '/dashboard.html';
};

// Exportar globalmente
window.api           = api;
window.getUser       = getUser;
window.getToken      = getToken;
window.requireAuth   = requireAuth;
window.requireRole   = requireRole;
window.redirectByRole= redirectByRole;
window.DEMO_MODE     = DEMO_MODE;
