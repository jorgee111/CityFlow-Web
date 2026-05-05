// public/js/map.js
// Mapa Leaflet con paradas de autobuses EMT Madrid en tiempo real

requireAuth();

const MADRID = [40.4168, -3.7038];
let mapInstance = null;
let stopMarkers = {};
let stopsLoaded = false;
let stopsLayer = null;
let busLayer = null; // New layer for the tracked bus

let lastTrackedBus = null;
let lastSelectedStopId = null;

function getColor(level) {
  return { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }[level] || '#22c55e';
}

// ─── Create a stop icon ────────────────────────────────────
function createStopIcon(linesCount) {
  const size = Math.min(24 + linesCount * 2, 36);
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `<div style="
      background: #1e293b;
      border: 2px solid #6366f1;
      color: #e2e8f0;
      width:${size}px; height:${size}px;
      border-radius: 50%;
      display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:9px;
      font-family:'Space Grotesk',sans-serif;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
      transition: all 0.2s;
    ">🚏</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2 - 4],
  });
}

// ─── Create a bus icon ─────────────────────────────────────
function createBusIcon(line, occupancy_pct) {
  const color = occupancy_pct < 50 ? '#22c55e' : occupancy_pct < 80 ? '#f59e0b' : '#ef4444';
  return L.divIcon({
    className: 'custom-bus-marker',
    html: `
      <div style="position:relative">
        <div style="
          background: #0f172a;
          border: 2.5px solid ${color};
          color: white;
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          transform: rotate(45deg);
        ">
          <div style="transform: rotate(-45deg); font-weight: 800; font-size: 11px;">${line}</div>
        </div>
        <div style="
          position: absolute; top: -5px; right: -5px;
          background: ${color};
          color: #0f172a;
          font-size: 9px; font-weight: 800;
          padding: 2px 4px; border-radius: 4px;
          border: 1.5px solid #0f172a;
        ">${occupancy_pct}%</div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
}

// ─── Track a specific bus on the map ───────────────────────
window.trackBusOnMap = function(busDataJson, isRestore = false) {
  const a = typeof busDataJson === 'string' ? JSON.parse(decodeURIComponent(busDataJson)) : busDataJson;
  lastTrackedBus = a;
  
  if (!a.lat || !a.lng) {
    if (!isRestore) Toast.error('No hay posición GPS para este autobús ahora mismo.');
    return;
  }

  busLayer.clearLayers();
  
  const busIcon = createBusIcon(a.line, a.occupancy_pct);
  const busMarker = L.marker([a.lat, a.lng], { 
    icon: busIcon,
    zIndexOffset: 1000 
  });

  const levelText = { low: 'Bajo', medium: 'Medio', high: 'Alto' }[a.occupancy_level] || 'Bajo';
  
  busMarker.bindPopup(`
    <div style="font-family:'Space Grotesk',sans-serif; min-width:180px">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px">
        <div style="background:#3b9ed4; color:white; padding:4px 10px; border-radius:8px; font-weight:800; font-size:16px">${a.line}</div>
        <div>
          <div style="font-size:12px; font-weight:700; color:#f1f5f9">${a.destination}</div>
          <div style="font-size:10px; color:#94a3b8">Bus #${a.bus}</div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:8px">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px">
          <span style="color:#94a3b8">Ocupación estimada</span>
          <span style="font-weight:700; color:${getColor(a.occupancy_level)}">${a.occupancy_pct}% (${levelText})</span>
        </div>
        <div style="height:6px; background:#1e293b; border-radius:3px; overflow:hidden">
          <div style="height:100%; width:${a.occupancy_pct}%; background:${getColor(a.occupancy_level)}"></div>
        </div>
      </div>
    </div>
  `, { className: 'dark-popup' }).addTo(busLayer);

  if (!isRestore) {
    mapInstance.setView([a.lat, a.lng], 17);
    busMarker.openPopup();
    Toast.success(`Localizando Línea ${a.line} (Bus #${a.bus})`);
  }
};

// ─── Build arrivals popup content ──────────────────────────
function buildArrivalsPopup(stop, arrivals) {
  const linesHtml = stop.lines.map(l => 
    `<span style="background:#6366f1;color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">${l}</span>`
  ).join(' ');

  let arrivalsHtml = '';
  if (arrivals.length === 0) {
    arrivalsHtml = `<p style="color:#94a3b8;font-size:12px;text-align:center;padding:8px 0">Sin autobuses próximos</p>`;
  } else {
    arrivalsHtml = arrivals.slice(0, 8).map(a => {
      const etaColor = a.eta_minutes <= 2 ? '#22c55e' : a.eta_minutes <= 5 ? '#f59e0b' : '#94a3b8';
      const etaText = a.eta_minutes === 0 ? '📍 En parada' : `${a.eta_minutes} min`;
      const busData = encodeURIComponent(JSON.stringify(a));
      
      return `
        <div class="arrival-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #334155;cursor:pointer" onclick="trackBusOnMap('${busData}')">
          <span style="background:#3b9ed4;color:white;padding:2px 8px;border-radius:6px;font-weight:700;font-size:12px;min-width:36px;text-align:center">${a.line}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.destination}</div>
            <div style="font-size:10px;color:#64748b;display:flex;align-items:center;gap:6px">
               <span>${a.distance_m}m</span>
               <span style="color:${getColor(a.occupancy_level)}">● ${a.occupancy_pct}% ocup.</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="color:${etaColor};font-weight:700;font-size:13px;font-family:'Space Grotesk',sans-serif;white-space:nowrap">${etaText}</div>
            <div style="font-size:9px;color:#64748b">Clic para ver bus</div>
          </div>
        </div>`;
    }).join('');
  }

  return `
    <div style="font-family:'Space Grotesk',sans-serif;min-width:240px;max-width:300px">
      <div style="margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:#f1f5f9;display:flex;align-items:baseline;justify-content:space-between">
          <span>${stop.name}</span>
          <span style="font-size:10px;font-weight:400;color:#64748b;margin-left:8px">#${stop.id}</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${stop.address || ''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">${linesHtml}</div>
      <div style="border-top:1px solid #334155;padding-top:8px">
        <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:6px">PRÓXIMOS AUTOBUSES</div>
        <div id="arrivals-${stop.id}">${arrivalsHtml}</div>
      </div>
    </div>`;
}

// ─── Loading popup while fetching arrivals ──────────────────
function buildLoadingPopup(stop) {
  const linesHtml = stop.lines.map(l => 
    `<span style="background:#6366f1;color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700">${l}</span>`
  ).join(' ');

  return `
    <div style="font-family:'Space Grotesk',sans-serif;min-width:240px">
      <div style="margin-bottom:8px">
        <div style="font-size:14px;font-weight:700;color:#f1f5f9;display:flex;align-items:baseline;justify-content:space-between">
          <span>${stop.name}</span>
          <span style="font-size:10px;font-weight:400;color:#64748b;margin-left:8px">#${stop.id}</span>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${stop.address || ''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">${linesHtml}</div>
      <div style="text-align:center;padding:16px 0;color:#94a3b8;font-size:12px">
        <div class="spinner" style="margin:0 auto 8px;width:20px;height:20px;border-width:2px"></div>
        Consultando llegadas...
      </div>
    </div>`;
}

const ZOOM_THRESHOLD = 15;

// ─── Initialize map ────────────────────────────────────────
function initMap() {
  mapInstance = L.map('map', { zoomControl: true }).setView(MADRID, 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://carto.com">CARTO</a> · Datos: <a href="https://emtmadrid.es">EMT Madrid</a>',
    maxZoom: 19,
  }).addTo(mapInstance);

  stopsLayer = L.layerGroup();
  busLayer = L.layerGroup().addTo(mapInstance);
  
  // Toggle visibility based on zoom
  mapInstance.on('zoomend', () => {
    const zoom = mapInstance.getZoom();
    if (zoom >= ZOOM_THRESHOLD) {
      if (!mapInstance.hasLayer(stopsLayer)) {
        stopsLayer.addTo(mapInstance);
        Toast.info('Mostrando paradas');
      }
    } else {
      if (mapInstance.hasLayer(stopsLayer)) {
        mapInstance.removeLayer(stopsLayer);
        Toast.info('Acércate para ver las paradas');
      }
    }
  });

  // Initial check (starts at 14, so hidden)
  if (mapInstance.getZoom() >= ZOOM_THRESHOLD) {
    stopsLayer.addTo(mapInstance);
  }
}

// ─── Load and display all stops ────────────────────────────
async function loadStops() {
  if (stopsLoaded) return;
  
  try {
    document.getElementById('map-count').textContent = '...';
    const stops = await api.get('/buses/stops');
    
    document.getElementById('map-count').textContent = stops.length;
    if (document.getElementById('map-update-time')) {
      document.getElementById('map-update-time').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    }

    stops.forEach(stop => {
      if (!stop.lat || !stop.lng) return;

      const icon = createStopIcon(stop.lines?.length || 1);
      const marker = L.marker([stop.lat, stop.lng], { icon });

      marker.on('click', async () => {
        lastSelectedStopId = stop.id;
        // Show loading popup immediately
        marker.bindPopup(buildLoadingPopup(stop), { 
          maxWidth: 320, 
          className: 'dark-popup' 
        }).openPopup();

        // Fetch real-time arrivals
        try {
          const arrivals = await api.get(`/buses/stops/${stop.id}/arrivals`);
          // Re-bind with real data
          marker.bindPopup(buildArrivalsPopup(stop, arrivals), { 
            maxWidth: 320, 
            className: 'dark-popup' 
          }).openPopup();
        } catch (err) {
          marker.bindPopup(`<div style="padding:10px;color:#ef4444">Error cargando llegadas</div>`).openPopup();
        }
      });

      stopMarkers[stop.id] = marker;
      marker.addTo(stopsLayer);
    });

    stopsLoaded = true;

    // Restore selection if it existed
    if (lastSelectedStopId && stopMarkers[lastSelectedStopId]) {
      // Re-open popup but don't force setView if it was just a refresh
      stopMarkers[lastSelectedStopId].fire('click');
    }
    if (lastTrackedBus) {
      window.trackBusOnMap(lastTrackedBus, true);
    }

    // Update stats
    const totalLines = stops.reduce((s, st) => s + (st.lines?.length || 0), 0);
    const avgLines = stops.length > 0 ? (totalLines / stops.length).toFixed(1) : 0;
    if (document.getElementById('map-avgOcc')) {
      document.getElementById('map-avgOcc').textContent = avgLines;
    }

  } catch (err) {
    console.error('Error loading stops:', err);
    Toast.error('Error cargando paradas: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadStops();

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    stopsLoaded = false;
    stopsLayer.clearLayers();
    stopMarkers = {};
    loadStops();
    Toast.info('Mapa actualizado');
  });

  // ─── Stop Search logic ───────────────────────────────────
  document.getElementById('stop-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const stopId = e.target.value.trim();
      const marker = stopMarkers[stopId];
      
      if (marker) {
        mapInstance.setView(marker.getLatLng(), 18);
        marker.fire('click'); // Simulate click to trigger popup/arrivals
        e.target.value = ''; // Clear search
      } else {
        Toast.error('Parada no encontrada: ' + stopId);
      }
    }
  });
});
