// public/js/gestor.js
// Lógica del panel gestor: tabs, incidencias, usuarios, mensajes, Three.js 3D

requireRole(['gestor']);

// ─── Datos telemetría mock ────────────────────
const fleetData = {
  'bus-01': { km: 145200, lastService: '2023-11-15', tireFL: 85, tireFR: 80, tireRL: 45, tireRR: 20, engine: 'warning', glass: 'ok' },
  'bus-02': { km: 89000,  lastService: '2024-01-10', tireFL: 90, tireFR: 92, tireRL: 88, tireRR: 85, engine: 'ok',      glass: 'warning' },
  'bus-03': { km: 215000, lastService: '2023-08-05', tireFL: 15, tireFR: 10, tireRL: 12, tireRR: 15, engine: 'critical', glass: 'critical' },
};

// ─── Tabs ─────────────────────────────────────
const tabs = ['incidents','stats','users','messages','fleet3d'];

tabs.forEach(tab => {
  document.getElementById(`tab-${tab}`)?.addEventListener('click', () => switchTab(tab));
});

function switchTab(tab) {
  tabs.forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`content-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'incidents') loadIncidents();
  if (tab === 'users')     loadUsers();
  if (tab === 'messages')  loadMessages();
  if (tab === 'fleet3d' && !window._3dInitialized) { initBus3D(); window._3dInitialized = true; }
}

// ─── Incidencias ──────────────────────────────
const STATUS_ICON = {
  abierta:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
  en_proceso: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  resuelta:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

const TYPE_CLASS = { urgencia: 'badge-danger', refuerzo: 'badge-info', normal: 'badge-warning' };

async function loadIncidents() {
  const container = document.getElementById('incidents-list');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Cargando...</span></div>`;
  try {
    const data = await api.get('/incidents');
    document.getElementById('stat-incidents-count').textContent = data.filter(i => i.status === 'abierta').length;

    if (!data.length) {
      container.innerHTML = `<p style="text-align:center;color:var(--muted-fg);padding:3rem">No hay incidencias registradas</p>`;
      return;
    }

    container.innerHTML = data.map((inc, i) => `
      <div class="card animate-in" style="animation-delay:${i * 0.05}s">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem">
              ${STATUS_ICON[inc.status] || ''}
              <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:0.9rem;color:var(--fg)">${inc.title}</span>
            </div>
            ${inc.description ? `<p style="font-size:0.82rem;color:var(--fg-2);margin-bottom:0.5rem">${inc.description}</p>` : ''}
            <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
              <span class="badge ${TYPE_CLASS[inc.type] || 'badge-muted'}">${inc.type}</span>
              ${inc.line ? `<span style="font-size:0.75rem;color:var(--muted-fg)">Línea ${inc.line}</span>` : ''}
              <span style="font-size:0.75rem;color:var(--muted-fg)">${new Date(inc.created_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
              ${inc.user_name ? `<span style="font-size:0.75rem;color:var(--muted-fg)">· ${inc.user_name}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:0.875rem">
          ${inc.status !== 'en_proceso' ? `<button class="btn btn-sm" style="background:var(--info-bg);color:var(--info);border:none;cursor:pointer" onclick="updateIncident(${inc.id},'en_proceso')">En proceso</button>` : ''}
          ${inc.status !== 'resuelta' ? `<button class="btn btn-sm" style="background:var(--success-bg);color:var(--success);border:none;cursor:pointer" onclick="updateIncident(${inc.id},'resuelta')">Resolver</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p style="text-align:center;color:var(--muted-fg);padding:3rem">Error cargando incidencias</p>`;
    Toast.error(err.message);
  }
}

async function updateIncident(id, status) {
  try {
    await api.put(`/incidents/${id}`, { status });
    Toast.success('Estado de incidencia actualizado');
    loadIncidents();
  } catch (err) {
    Toast.error(err.message);
  }
}

// ─── Usuarios ─────────────────────────────────
const ROLE_LABELS = { pasajero: 'Pasajero', conductor: 'Conductor', gestor: 'Gestor' };

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem"><div class="spinner" style="margin:auto"></div></td></tr>`;
  try {
    const users = await api.get('/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.625rem">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--secondary);display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:0.8rem;color:var(--primary)">
              ${u.display_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <div style="font-weight:600;font-size:0.875rem">${u.display_name}</div>
              <div style="font-size:0.75rem;color:var(--muted-fg)">${u.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-${u.role === 'gestor' ? 'primary' : u.role === 'conductor' ? 'info' : 'muted'}">${ROLE_LABELS[u.role]}</span></td>
        <td>${u.assigned_line ? `<span class="badge badge-primary">${u.assigned_line}</span>` : '<span style="color:var(--muted-fg);font-size:0.8rem">—</span>'}</td>
        <td><div style="display:flex;align-items:center;gap:0.375rem"><div class="status-dot" style="background:${u.status==='activo'?'var(--success)':'var(--muted-fg)'}"></div><span style="font-size:0.82rem;color:${u.status==='activo'?'var(--success)':'var(--muted-fg)'}">${u.status}</span></div></td>
      </tr>
    `).join('');
  } catch (err) {
    Toast.error(err.message);
  }
}

// ─── Mensajes ─────────────────────────────────
async function loadMessages() {
  const container = document.getElementById('messages-list');
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div><span>Cargando...</span></div>`;
  try {
    const data = await api.get('/suggestions');
    if (!data.length) {
      container.innerHTML = `<p style="text-align:center;color:var(--muted-fg);padding:3rem">No hay mensajes de usuarios</p>`;
      return;
    }
    container.innerHTML = data.map((s, i) => `
      <div class="card animate-in" style="animation-delay:${i * 0.05}s">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span style="font-size:0.8rem;font-weight:600;color:var(--fg)">${s.user_name || 'Usuario'}</span>
          <span style="font-size:0.72rem;color:var(--muted-fg);margin-left:auto">${new Date(s.created_at).toLocaleString('es-ES')}</span>
        </div>
        <p style="font-size:0.875rem;color:var(--fg-2)">${s.message}</p>
        ${s.response ? `<div style="margin-top:0.75rem;background:var(--secondary);border-radius:var(--radius);padding:0.625rem 0.875rem"><p style="font-size:0.82rem;color:var(--fg)">${s.response}</p></div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    Toast.error(err.message);
  }
}

// ─── Three.js Bus 3D ──────────────────────────
let renderer, scene3d, camera3d, bus3dMesh, animFrameId;

function getTireColor(pct) {
  if (pct < 30) return 0xef4444; // danger
  if (pct < 60) return 0xf59e0b; // warning
  return 0x22c55e;               // success
}

function getStatusColor(status) {
  if (status === 'critical') return 0xef4444;
  if (status === 'warning')  return 0xf59e0b;
  return 0x22c55e;
}

function buildBusMesh(data) {
  const group = new THREE.Group();

  // Cuerpo principal
  const bodyGeo = new THREE.BoxGeometry(4, 1.8, 1.6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Techo
  const roofGeo = new THREE.BoxGeometry(3.8, 0.1, 1.5);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.7 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 1.45;
  group.add(roof);

  // Cristales (parabrisas + laterales)
  const glassColor = getStatusColor(data.glass);
  const glassMat = new THREE.MeshStandardMaterial({ color: glassColor, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.65 });

  // Ventana delantera
  const windshieldGeo = new THREE.BoxGeometry(0.05, 0.9, 1.2);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(2.03, 0.6, 0);
  group.add(windshield);

  // Ventanas laterales
  for (let x = -1.5; x <= 1.5; x += 1) {
    const wGeo = new THREE.BoxGeometry(0.6, 0.5, 0.05);
    const w1 = new THREE.Mesh(wGeo, glassMat);
    w1.position.set(x, 0.75, 0.83);
    group.add(w1);
    const w2 = new THREE.Mesh(wGeo, glassMat);
    w2.position.set(x, 0.75, -0.83);
    group.add(w2);
  }

  // Ruedas (4)
  const wheelPositions = [
    { x: 1.5,  z: 0.9,  label: 'FL', pct: data.tireFL },
    { x: 1.5,  z: -0.9, label: 'FR', pct: data.tireFR },
    { x: -1.5, z: 0.9,  label: 'RL', pct: data.tireRL },
    { x: -1.5, z: -0.9, label: 'RR', pct: data.tireRR },
  ];

  wheelPositions.forEach(w => {
    const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 20);
    const mat = new THREE.MeshStandardMaterial({ color: getTireColor(w.pct), roughness: 0.9, metalness: 0.1 });
    const wheel = new THREE.Mesh(geo, mat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(w.x, -0.15, w.z);
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Motor (bloque frontal)
  const engineColor = getStatusColor(data.engine);
  const engineGeo = new THREE.BoxGeometry(0.4, 0.6, 0.8);
  const engineMat = new THREE.MeshStandardMaterial({ color: engineColor, roughness: 0.5, metalness: 0.8 });
  const engineMesh = new THREE.Mesh(engineGeo, engineMat);
  engineMesh.position.set(2.2, 0.1, 0);
  group.add(engineMesh);

  // Línea de la empresa
  const stripeGeo = new THREE.BoxGeometry(4.1, 0.12, 1.62);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.8;
  group.add(stripe);

  return group;
}

function initBus3D() {
  const canvas = document.getElementById('bus3d-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight || 360);

  scene3d = new THREE.Scene();

  camera3d = new THREE.PerspectiveCamera(45, canvas.offsetWidth / (canvas.offsetHeight || 360), 0.1, 100);
  camera3d.position.set(6, 4, 6);
  camera3d.lookAt(0, 0, 0);

  // Luces
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene3d.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(10, 10, 5);
  dirLight.castShadow = true;
  scene3d.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
  fillLight.position.set(-5, 3, -5);
  scene3d.add(fillLight);

  // Suelo
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.55;
  ground.receiveShadow = true;
  scene3d.add(ground);

  // Orbit controls simple
  let isDragging = false, lastX = 0, lastY = 0;
  let angleH = 0, angleV = 0.4, zoom = 8;

  const updateCamera = () => {
    camera3d.position.x = zoom * Math.sin(angleH) * Math.cos(angleV);
    camera3d.position.y = zoom * Math.sin(angleV);
    camera3d.position.z = zoom * Math.cos(angleH) * Math.cos(angleV);
    camera3d.lookAt(0, 0, 0);
  };
  updateCamera();

  canvas.addEventListener('mousedown', e => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    angleH += (e.clientX - lastX) * 0.01;
    angleV  = Math.max(-0.3, Math.min(1.2, angleV - (e.clientY - lastY) * 0.01));
    lastX = e.clientX; lastY = e.clientY;
    updateCamera();
  });
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('wheel', e => {
    zoom = Math.max(4, Math.min(15, zoom + e.deltaY * 0.01));
    updateCamera();
  });

  // Construir bus
  updateBus3D('bus-01');

  const animate = () => {
    animFrameId = requestAnimationFrame(animate);
    if (bus3dMesh) bus3dMesh.rotation.y += 0.003;
    renderer.render(scene3d, camera3d);
  };
  animate();

  // Selector
  document.getElementById('bus-selector')?.addEventListener('change', e => {
    updateBus3D(e.target.value);
    updateTelemetry(fleetData[e.target.value]);
  });

  updateTelemetry(fleetData['bus-01']);
}

function updateBus3D(busId) {
  if (bus3dMesh) scene3d.remove(bus3dMesh);
  const data = fleetData[busId];
  if (!data) return;
  bus3dMesh = buildBusMesh(data);
  scene3d.add(bus3dMesh);
}

function tireColor(pct) {
  if (pct < 30) return 'var(--danger)';
  if (pct < 60) return 'var(--warning)';
  return 'var(--success)';
}

function statusLabel(s) { return { ok: '✅ OK', warning: '⚠️ Atención', critical: '🔴 Crítico' }[s] || s; }
function statusBg(s)    { return { ok: 'var(--success-bg)', warning: 'var(--warning-bg)', critical: 'var(--danger-bg)' }[s] || 'var(--muted)'; }
function statusFg(s)    { return { ok: 'var(--success)', warning: 'var(--warning)', critical: 'var(--danger)' }[s] || 'var(--fg)'; }

function updateTelemetry(data) {
  if (!data) return;
  document.getElementById('tel-km').textContent = data.km.toLocaleString('es-ES') + ' km';
  document.getElementById('tel-service').textContent = new Date(data.lastService).toLocaleDateString('es-ES');

  ['fl','fr','rl','rr'].forEach((id, i) => {
    const pct = [data.tireFL, data.tireFR, data.tireRL, data.tireRR][i];
    const el = document.getElementById(`tire-${id}`);
    el.textContent = pct + '%';
    el.style.color = tireColor(pct);
  });

  const engine = document.getElementById('status-engine');
  engine.textContent = statusLabel(data.engine);
  engine.style.background = statusBg(data.engine);
  engine.style.color = statusFg(data.engine);

  const glass = document.getElementById('status-glass');
  glass.textContent = statusLabel(data.glass);
  glass.style.background = statusBg(data.glass);
  glass.style.color = statusFg(data.glass);
}

// ─── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadIncidents();
});

window.updateIncident = updateIncident;
