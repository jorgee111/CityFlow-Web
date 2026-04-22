// public/js/nav.js
// Sidebar de navegación desktop - carga dinámica según rol

const NAV_ITEMS = {
  pasajero: [
    { href: '/dashboard.html', icon: 'home',    label: 'Dashboard' },
    { href: '/lineas.html',    icon: 'list',     label: 'Líneas' },
    { href: '/mapa.html',      icon: 'map',      label: 'Mapa en vivo' },
    { href: '/alertas.html',   icon: 'bell',     label: 'Alertas' },
    { href: '/trafico.html',   icon: 'trending', label: 'Tráfico' },
    { href: '/buscar.html',    icon: 'search',   label: 'Buscar' },
  ],
  conductor: [
    { href: '/conductor.html', icon: 'bus',      label: 'Panel Conductor' },
    { href: '/mapa.html',      icon: 'map',      label: 'Mapa en vivo' },
    { href: '/alertas.html',   icon: 'bell',     label: 'Alertas' },
  ],
  gestor: [
    { href: '/gestor.html',    icon: 'shield',   label: 'Panel Gestor' },
    { href: '/mapa.html',      icon: 'map',      label: 'Mapa en vivo' },
    { href: '/alertas.html',   icon: 'bell',     label: 'Alertas' },
    { href: '/trafico.html',   icon: 'trending', label: 'Tráfico' },
  ],
};

const ICONS = {
  home:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  list:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  map:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
  bell:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  search:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  bus:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="22" height="16" rx="2"/><path d="M1 9h22M7 3v16M17 3v16"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>`,
  shield:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  user:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  menu:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
};

function renderNav() {
  const user = getUser();
  if (!user) return;

  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const items = NAV_ITEMS[user.role] || NAV_ITEMS.pasajero;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const navHTML = items.map(item => {
    const isActive = currentPath === item.href.replace('/', '') || currentPath === '' && item.href === '/dashboard.html';
    return `
      <a href="${item.href}" class="nav-link ${isActive ? 'active' : ''}">
        ${ICONS[item.icon]}
        ${item.label}
      </a>`;
  }).join('');

  const roleLabels = { pasajero: 'Pasajero', conductor: 'Conductor', gestor: 'Gestor' };
  const initial = user.display_name ? user.display_name.charAt(0).toUpperCase() : 'U';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="3" width="22" height="16" rx="2"/>
          <path d="M1 9h22M7 3v16M17 3v16"/>
          <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
        </svg>
      </div>
      <div class="sidebar-brand-text">
        <h1>CityFlow</h1>
        <p>Madrid · Tiempo real</p>
      </div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-section-label">Navegación</span>
      ${navHTML}
      <span class="nav-section-label" style="margin-top:auto">Cuenta</span>
      <a href="/perfil.html" class="nav-link ${currentPath === 'perfil.html' ? 'active' : ''}">
        ${ICONS.user} Mi perfil
      </a>
    </nav>
    <div class="sidebar-footer">
      <div class="user-card">
        <div class="user-avatar">${initial}</div>
        <div class="user-info">
          <div class="user-name">${user.display_name || 'Usuario'}</div>
          <div class="user-role">${roleLabels[user.role] || user.role}</div>
        </div>
        <button class="btn-logout" onclick="handleLogout()" title="Cerrar sesión">
          ${ICONS.logout}
        </button>
      </div>
    </div>
  `;

  // Mobile toggle
  const toggle = document.getElementById('menu-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('visible');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }
}

async function handleLogout() {
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_user');
  window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', renderNav);
window.handleLogout = handleLogout;
window.ICONS = ICONS;
