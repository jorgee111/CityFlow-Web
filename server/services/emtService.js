// We use Node's native fetch

class EMTService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.clientId = process.env.EMT_CLIENT_ID;
    this.passKey = process.env.EMT_PASSKEY;
    this.baseUrl = process.env.EMT_API_BASE_URL || 'https://openapi.emtmadrid.es';
    
    // In-memory cache for buses
    this.busesCache = [];
    this.lastCacheTime = 0;
    this.CACHE_DURATION_MS = 30000; // 30 seconds
    this.workerInterval = null;
    
    // In-memory cache for stops (loaded once on startup, refreshed daily)
    this.stopsCache = [];
    this.stopsLastFetch = 0;
    this.STOPS_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    // In-memory cache for all lines
    this.linesCache = [];
    this.linesLastFetch = 0;
  }
  
  startBackgroundWorker() {
    console.log('🔄 Starting EMT Background Sync Worker...');
    // Initial fetch
    this.getBuses();
    
    // Fetch every 35 seconds to avoid rate limits while keeping data fresh
    this.workerInterval = setInterval(() => {
      this.getBuses(true); // true = force refresh
    }, 35000);
  }

  async login() {
    // If token is valid, don't login again
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v2/mobilitylabs/user/login/`, {
        method: 'GET',
        headers: {
          'X-ClientId': this.clientId,
          'passKey': this.passKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`EMT Login failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // Code 00 means fresh login, 01 means token extended/recovered.
      if ((data.code === '00' || data.code === '01') && data.data && data.data.length > 0 && data.data[0].accessToken) {
        this.accessToken = data.data[0].accessToken;
        // Token valid for 24h, let's cache it for 23h to be safe
        this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
        console.log('✅ EMT API Login successful');
        return this.accessToken;
      } else {
        throw new Error('Invalid response format from EMT login');
      }
    } catch (error) {
      console.error('Error logging into EMT API:', error);
      throw error;
    }
  }

  async getBuses(force = false) {
    // Return cached data if fresh and not forcing refresh
    if (!force && this.busesCache.length > 0 && Date.now() - this.lastCacheTime < this.CACHE_DURATION_MS) {
      return this.busesCache;
    }

    try {
      const token = await this.login();
      
      const realBuses = [];
      
      const stopsToFetch = [
        '1925', '1922', '5452', '5453', // Atocha area
        '5602', '5603', '5604', '5606', // Plaza Castilla
        '3688', '3687', '3686', '2419', // Moncloa
        '2403', '2404', '1049', '1050', // Sol / Callao
        '69', '70', '71', '72', '73',   // Cibeles / Prado
        '5247', '5248', '49',           // Nuevos Ministerios
        '1890', '1891', '1892',         // Cuatro Caminos
        '2296', '2297', '857',          // Principe Pio
        '1144', '1145', '1146',         // Avenida de America
        '1968', '1969',                 // Mendez Alvaro
        '1171', '1172',                 // Legazpi
        '676', '677', '1429', '1430',   // Goya / Diego de Leon
        '5063', '5064', '5065',         // Aluche
        '2796', '2797', '2800',         // Vallecas (Puente)
        '5756', '5757',                 // Villaverde Alto
        '4602', '4603',                 // Hortaleza / Mar de Cristal
        '1064', '1065',                 // Moratalaz / Pavones
        '5126', '5127',                 // Usera / Plaza Eliptica
        '1544', '1545'                  // Arturo Soria
      ];
      
      // We'll execute requests concurrently in small batches to avoid hitting rate limits instantly or timing out
      const batchSize = 15;
      for (let i = 0; i < stopsToFetch.length; i += batchSize) {
        const batch = stopsToFetch.slice(i, i + batchSize);
        const promises = batch.map(async stop => {
          try {
            const stopRes = await fetch(`${this.baseUrl}/v3/transport/busemtmad/stops/${stop}/arrives/all/`, {
              method: 'POST',
              headers: {
                'accessToken': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ "cultureInfo": "ES", "Text_StopRequired_YN": "Y", "Text_EstimationsRequired_YN": "Y" })
            });
            
            if (!stopRes.ok) return;
            
            const textRes = await stopRes.text();
            try {
              const data = JSON.parse(textRes);
              if (data.code === '00' && data.data && data.data[0].Arrive) {
                data.data[0].Arrive.forEach(arrive => {
                  // Only add if not already in array (avoid duplicates if multiple stops return the same bus)
                  if (!realBuses.some(b => b.bus_code === `EMT-${arrive.bus}`)) {
                    // EMT colors simulate based on line name (e.g. N lines are night)
                    let lcolor = '#3b9ed4'; // default EMT blue
                    if (arrive.line.startsWith('N')) lcolor = '#94a3b8'; // Night buses
                    else if (arrive.line.startsWith('E') || arrive.line === 'Exprés') lcolor = '#e8a838'; // Express
                    else if (arrive.line === '27' || arrive.line === 'C1' || arrive.line === 'C2') lcolor = '#10b981'; // BRT / Circular
                    
                    const occ_pct = Math.floor(Math.random() * 80) + 10; // 10-90 range
                    const occ_level = occ_pct < 50 ? 'low' : occ_pct < 80 ? 'medium' : 'high';
                    
                    realBuses.push({
                      bus_code: `EMT-${arrive.bus}`,
                      line: arrive.line,
                      destination: arrive.destination,
                      lat: arrive.geometry?.coordinates?.[1] || 40.416,
                      lng: arrive.geometry?.coordinates?.[0] || -3.703,
                      occupancy_pct: occ_pct,
                      occupancy_level: occ_level,
                      speed_kmh: Math.floor(Math.random() * 30) + 15,
                      eta_minutes: Math.floor(arrive.estimateArrive / 60),
                      line_color: lcolor,
                      is_active: true
                    });
                  }
                });
              }
            } catch (jsonErr) {
               console.warn('EMT API returned non-JSON response for stop', stop);
            }
          } catch (stopErr) {
            console.error(`Error fetching stop ${stop}:`, stopErr.message);
          }
        });
        
        await Promise.all(promises);
      }


      if (realBuses.length > 0) {
        this.busesCache = realBuses;
        this.lastCacheTime = Date.now();
        return realBuses;
      }
      
      throw new Error('No valid bus data retrieved from EMT API. Falling back to simulated data.');

    } catch (error) {
      console.error('EMT API Error:', error.message);
      
      // FALLBACK TO SIMULATED DATA
      const fallbackData = [
        { id: 1, bus_code: 'BUS-27-001', line: '27', destination: 'Plaza Castilla', lat: 40.4200, lng: -3.7000, occupancy_pct: 30, occupancy_level: 'low', speed_kmh: 35, eta_minutes: 3, line_color: '#e8a838', is_active: true },
        { id: 2, bus_code: 'BUS-27-002', line: '27', destination: 'Plaza Castilla', lat: 40.4150, lng: -3.7020, occupancy_pct: 62, occupancy_level: 'medium', speed_kmh: 28, eta_minutes: 8, line_color: '#e8a838', is_active: true },
        { id: 3, bus_code: 'BUS-65-001', line: '65', destination: 'Moncloa', lat: 40.4320, lng: -3.7190, occupancy_pct: 65, occupancy_level: 'medium', speed_kmh: 40, eta_minutes: 7, line_color: '#3b9ed4', is_active: true },
        { id: 4, bus_code: 'BUS-82-001', line: '82', destination: 'Atocha', lat: 40.4060, lng: -3.6890, occupancy_pct: 91, occupancy_level: 'high', speed_kmh: 22, eta_minutes: 2, line_color: '#e05252', is_active: true },
        { id: 5, bus_code: 'BUS-82-002', line: '82', destination: 'Pirámides', lat: 40.4080, lng: -3.7100, occupancy_pct: 78, occupancy_level: 'high', speed_kmh: 30, eta_minutes: 5, line_color: '#e05252', is_active: true },
        { id: 6, bus_code: 'BUS-44-001', line: '44', destination: 'Chamartín', lat: 40.4500, lng: -3.6920, occupancy_pct: 18, occupancy_level: 'low', speed_kmh: 45, eta_minutes: 12, line_color: '#4ade80', is_active: true },
        { id: 7, bus_code: 'BUS-132-001', line: '132', destination: 'Las Tablas', lat: 40.4680, lng: -3.7050, occupancy_pct: 55, occupancy_level: 'medium', speed_kmh: 38, eta_minutes: 5, line_color: '#a78bfa', is_active: true },
        { id: 8, bus_code: 'BUS-1-001', line: '1', destination: 'Sol', lat: 40.4160, lng: -3.7036, occupancy_pct: 88, occupancy_level: 'high', speed_kmh: 20, eta_minutes: 4, line_color: '#f97316', is_active: true }
      ];
      return fallbackData;
    }
  }

  // ─── Get all stops across all lines ────────────────────────
  async getAllStops() {
    // Return cached if fresh
    if (this.stopsCache.length > 0 && Date.now() - this.stopsLastFetch < this.STOPS_CACHE_DURATION_MS) {
      return this.stopsCache;
    }

    try {
      const token = await this.login();
      
      // Get all lines (both active and inactive)
      const allLinesData = await this.getAllLines();
      const uniqueLines = allLinesData.map(l => l.line);
      
      console.log(`📍 Fetching stops for all ${uniqueLines.length} EMT lines...`);
      
      const allStops = new Map(); // Use Map to deduplicate by stop ID
      
      // Fetch stops in batches of 5 lines at a time
      const batchSize = 5;
      for (let i = 0; i < uniqueLines.length; i += batchSize) {
        const batch = uniqueLines.slice(i, i + batchSize);
        const promises = [];
        
        batch.forEach(line => {
          [1, 2].forEach(direction => {
            promises.push((async () => {
              try {
                const res = await fetch(`${this.baseUrl}/v3/transport/busemtmad/lines/${line}/stops/${direction}/`, {
                  method: 'GET',
                  headers: { 'accessToken': token }
                });
                if (!res.ok) return;
                const data = await res.json();
                if (data.code === '00' && data.data && data.data[0]?.stops) {
                  data.data[0].stops.forEach(stop => {
                    if (!allStops.has(stop.stop)) {
                      allStops.set(stop.stop, {
                        id: stop.stop,
                        name: stop.name,
                        address: stop.postalAddress || '',
                        lat: stop.geometry?.coordinates?.[1] || 0,
                        lng: stop.geometry?.coordinates?.[0] || 0,
                        lines: stop.dataLine || [line]
                      });
                    } else {
                      const existing = allStops.get(stop.stop);
                      if (!existing.lines.includes(line)) {
                        existing.lines.push(line);
                      }
                    }
                  });
                }
              } catch (err) {
                // Skip failed lines/directions silently
              }
            })());
          });
        });
        await Promise.all(promises);
      }

      this.stopsCache = Array.from(allStops.values());
      this.stopsLastFetch = Date.now();
      console.log(`✅ Loaded ${this.stopsCache.length} unique stops`);
      return this.stopsCache;
    } catch (error) {
      console.error('Error fetching stops:', error.message);
      return this.stopsCache.length > 0 ? this.stopsCache : [];
    }
  }

  // ─── Get real-time arrivals for a specific stop ────────────
  async getStopArrivals(stopId) {
    try {
      const token = await this.login();
      const res = await fetch(`${this.baseUrl}/v3/transport/busemtmad/stops/${stopId}/arrives/all/`, {
        method: 'POST',
        headers: { 'accessToken': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cultureInfo: 'ES', Text_StopRequired_YN: 'Y', Text_EstimationsRequired_YN: 'Y' })
      });

      if (!res.ok) return [];

      const data = await res.json();
      if (data.code === '00' && data.data && data.data[0]?.Arrive) {
        return data.data[0].Arrive.map(a => {
          const occ_pct = Math.floor(Math.random() * 80) + 10;
          const occ_level = occ_pct < 50 ? 'low' : occ_pct < 80 ? 'medium' : 'high';
          
          return {
            line: a.line,
            destination: a.destination,
            bus: a.bus,
            eta_seconds: a.estimateArrive,
            eta_minutes: Math.floor(a.estimateArrive / 60),
            distance_m: a.DistanceBus,
            lat: a.geometry?.coordinates?.[1] || 0,
            lng: a.geometry?.coordinates?.[0] || 0,
            occupancy_pct: occ_pct,
            occupancy_level: occ_level
          };
        }).sort((a, b) => a.eta_seconds - b.eta_seconds);
      }
      return [];
    } catch (error) {
      console.error(`Error fetching arrivals for stop ${stopId}:`, error.message);
      return [];
    }
  }

  // ─── Get all lines ──────────────────────────────────────────
  async getAllLines() {
    if (this.linesCache.length > 0 && Date.now() - this.linesLastFetch < this.STOPS_CACHE_DURATION_MS) {
      return this.linesCache;
    }
    
    try {
      const token = await this.login();
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;

      const res = await fetch(`${this.baseUrl}/v3/transport/busemtmad/lines/info/${dateStr}/`, {
        method: 'GET',
        headers: { 'accessToken': token }
      });

      if (!res.ok) return [];

      const data = await res.json();
      if (data.code === '00' && data.data) {
        this.linesCache = data.data.map(l => ({
          line: l.label,       // "001" or "27"
          nameA: l.nameA,
          nameB: l.nameB,
          color: '#' + l.color,
          name_line: l.name_line
        }));
        this.linesLastFetch = Date.now();
        console.log(`✅ Loaded ${this.linesCache.length} EMT lines`);
        return this.linesCache;
      }
      return [];
    } catch (error) {
      console.error('Error fetching lines:', error.message);
      return this.linesCache.length > 0 ? this.linesCache : [];
    }
  }

  // ─── Get stops for a specific line ─────────────────────────
  async getLineStops(lineId) {
    try {
      const token = await this.login();
      const allStops = [];
      const stopIds = new Set();

      const directions = [1, 2];
      const promises = directions.map(async direction => {
        try {
          const res = await fetch(`${this.baseUrl}/v3/transport/busemtmad/lines/${lineId}/stops/${direction}/`, {
            method: 'GET',
            headers: { 'accessToken': token }
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.code === '00' && data.data && data.data[0]?.stops) {
            data.data[0].stops.forEach(s => {
              if (!stopIds.has(s.stop)) {
                stopIds.add(s.stop);
                allStops.push({
                  id: s.stop,
                  name: s.name,
                  address: s.postalAddress || '',
                  lat: s.geometry?.coordinates?.[1] || 0,
                  lng: s.geometry?.coordinates?.[0] || 0
                });
              }
            });
          }
        } catch (e) { /* ignore */ }
      });

      await Promise.all(promises);
      return allStops;
    } catch (error) {
      console.error(`Error fetching stops for line ${lineId}:`, error.message);
      return [];
    }
  }
}

module.exports = new EMTService();
