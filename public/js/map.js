// public/js/map.js
// Mapa Leaflet con autobuses en tiempo real

requireAuth();

const MADRID = [40.4168, -3.7038];
let mapInstance = null;
let markers = {};

function getColor(level) {
  return { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }[level] || '#22c55e';
}

function getLabel(level) {
  return { low: 'Bajo', medium: 'Medio', high: 'Alto' }[level] || 'Bajo';
}

function createBusIcon(line, level, color) {
  return L.divIcon({
    className: 'custom-bus-marker',
    html: `<div style="
      background:${getColor(level)};
      color:white;
      width:38px; height:38px;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:11px;
      font-family:'Space Grotesk',sans-serif;
      border:3px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 10px rgba(0,0,0,0.4);
    ">${line}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function initMap() {
  mapInstance = L.map('map', { zoomControl: true }).setView(MADRID, 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com">CARTO</a>',
    maxZoom: 19,
  }).addTo(mapInstance);
}

async function loadBuses() {
  try {
    const buses = await api.get('/buses');

    const count = buses.length;
    const avgOcc = count ? Math.round(buses.reduce((s, b) => s + b.occupancy_pct, 0) / count) : 0;

    document.getElementById('map-count').textContent = count;
    document.getElementById('map-avgOcc').textContent = avgOcc + '%';
    document.getElementById('map-update-time').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });

    // Actualizar/crear marcadores
    const seen = new Set();
    buses.forEach(bus => {
      seen.add(bus.bus_code);
      const icon = createBusIcon(bus.line, bus.occupancy_level, bus.line_color);
      const popupHTML = `
        <div style="font-family:'Space Grotesk',sans-serif; min-width:160px; padding:0.25rem">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="background:${getColor(bus.occupancy_level)};color:white;border-radius:8px;padding:4px 10px;font-weight:700;font-size:14px">
              Línea ${bus.line}
            </div>
          </div>
          <p style="margin:4px 0;font-size:13px"><strong>Destino:</strong> ${bus.destination}</p>
          <p style="margin:4px 0;font-size:13px"><strong>Aforo:</strong> ${bus.occupancy_pct}% (${getLabel(bus.occupancy_level)})</p>
          <p style="margin:4px 0;font-size:13px"><strong>Velocidad:</strong> ${bus.speed_kmh} km/h</p>
          <p style="margin:4px 0;font-size:13px"><strong>ETA:</strong> ${bus.eta_minutes} min</p>
          <div style="margin-top:8px;height:5px;background:#334155;border-radius:3px;overflow:hidden">
            <div style="width:${bus.occupancy_pct}%;height:100%;background:${getColor(bus.occupancy_level)};border-radius:3px"></div>
          </div>
        </div>`;

      if (markers[bus.bus_code]) {
        markers[bus.bus_code].setLatLng([bus.lat, bus.lng]).setIcon(icon).bindPopup(popupHTML);
      } else {
        const m = L.marker([bus.lat, bus.lng], { icon }).bindPopup(popupHTML);
        m.addTo(mapInstance);
        markers[bus.bus_code] = m;
      }
    });

    // Eliminar marcadores de buses que ya no están activos
    Object.keys(markers).forEach(code => {
      if (!seen.has(code)) {
        mapInstance.removeLayer(markers[code]);
        delete markers[code];
      }
    });

  } catch (err) {
    Toast.error('Error cargando datos del mapa: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadBuses();
  setInterval(loadBuses, 30000);

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadBuses();
    Toast.info('Mapa actualizado');
  });
});
