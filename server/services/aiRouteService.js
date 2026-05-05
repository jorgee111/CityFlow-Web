const emtService = require('./emtService');

class AIRouteService {
  
  // ─── GEOCODING ───────────────────────────────────────────
  // Usa Nominatim de OpenStreetMap (gratuito) para convertir direcciones a coordenadas
  async geocode(address) {
    try {
      const query = encodeURIComponent(`${address}, Madrid, Spain`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
        headers: { 'User-Agent': 'CityFlowWeb/1.0' }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name.split(',')[0]
        };
      }
      return null;
    } catch (err) {
      console.error('Error geocoding:', err);
      return null;
    }
  }

  // ─── HAVERSINE DISTANCE (Meters) ──────────────────────────
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // ─── ENCUENTRA LA MEJOR RUTA (MOTOR IA HEURÍSTICO) ────────
  async calculateRoute(originText, destinationText) {
    // 1. Geocode both locations
    const origin = await this.geocode(originText);
    const destination = await this.geocode(destinationText);

    if (!origin || !destination) {
      return {
        error: true,
        message: '🤖 **No pude encontrar esas direcciones.** Asegúrate de que están en Madrid e inténtalo de nuevo.'
      };
    }

    // 2. Traer todas las paradas de la caché del EMT
    const allStops = await emtService.getAllStops();
    if (!allStops || allStops.length === 0) {
      return { error: true, message: '🤖 **Lo siento, los sistemas de la EMT están temporalmente caídos.** No tengo datos de paradas ahora mismo.' };
    }

    // 3. Encontrar paradas cercanas al Origen y Destino (radio de 800m)
    const RADIUS_M = 800;
    const originStops = allStops.filter(s => s.lat && s.lng && this.getDistance(origin.lat, origin.lng, s.lat, s.lng) <= RADIUS_M);
    const destStops = allStops.filter(s => s.lat && s.lng && this.getDistance(destination.lat, destination.lng, s.lat, s.lng) <= RADIUS_M);

    if (originStops.length === 0 || destStops.length === 0) {
      return { error: true, message: '🤖 **No hay paradas de autobús cerca de uno de esos lugares.** Quizá el origen o destino esté muy a las afueras.' };
    }

    // 4. Buscar líneas en común (líneas que paran cerca del origen y cerca del destino)
    let bestMatch = null;
    let shortestDistance = Infinity;

    for (const oStop of originStops) {
      for (const dStop of destStops) {
        // Encontrar líneas que sirvan a ambas paradas
        const commonLines = oStop.lines.filter(l => dStop.lines.includes(l));
        
        for (const line of commonLines) {
          const walkToOrig = this.getDistance(origin.lat, origin.lng, oStop.lat, oStop.lng);
          const walkToDest = this.getDistance(destination.lat, destination.lng, dStop.lat, dStop.lng);
          const totalWalk = walkToOrig + walkToDest;
          
          if (totalWalk < shortestDistance) {
            shortestDistance = totalWalk;
            bestMatch = {
              line: line,
              originStop: oStop,
              destStop: dStop,
              walkToOrig,
              walkToDest
            };
          }
        }
      }
    }

    if (!bestMatch) {
      return { error: true, message: '🤖 **Vaya... no hay autobuses directos entre esos puntos.** (Este agente actualmente solo soporta rutas directas sin transbordo).' };
    }

    // 5. Check real-time arrivals for the chosen origin stop
    let etaMinutes = null;
    let occupancy = 'desconocida';
    try {
      const arrivals = await emtService.getStopArrivals(bestMatch.originStop.id);
      const lineArrivals = arrivals.filter(a => a.line === bestMatch.line);
      if (lineArrivals.length > 0) {
        etaMinutes = lineArrivals[0].eta_minutes;
        // Just simulate occupancy based on ETA for fun flavor, or leave it unknown.
        occupancy = etaMinutes < 5 ? 'baja' : 'media';
      }
    } catch (e) {
      console.log('Error fetching arrivals in AI', e);
    }

    // 6. Generar texto simulando IA
    const walkMinsOrig = Math.ceil(bestMatch.walkToOrig / 80); // Asumiendo velocidad de caminata de ~80m/min
    const walkMinsDest = Math.ceil(bestMatch.walkToDest / 80);
    
    let text = `¡Hola! He calculado la ruta óptima basándome en datos en tiempo real de la EMT de Madrid.\n\n`;
    text += `**Instrucciones:**\n`;
    text += `1. **Camina** aproximadamente ${walkMinsOrig} minuto${walkMinsOrig > 1 ? 's' : ''} hasta la parada **${bestMatch.originStop.name}**.\n`;
    
    if (etaMinutes !== null) {
      if (etaMinutes === 0) {
        text += `2. **¡Corre!** El autobús de la **Línea ${bestMatch.line}** está llegando ahora mismo a la parada.\n`;
      } else {
        text += `2. Sube al autobús de la **Línea ${bestMatch.line}**. El próximo pasará en unos **${etaMinutes} minutos**.\n`;
      }
    } else {
      text += `2. Toma el autobús de la **Línea ${bestMatch.line}** en esa parada.\n`;
    }

    text += `3. Bájate en la parada **${bestMatch.destStop.name}**.\n`;
    text += `4. **Camina** ${walkMinsDest} minuto${walkMinsDest > 1 ? 's' : ''} hasta tu destino en ${destination.displayName}.\n\n`;
    text += `*¡Buen viaje por Madrid!*`;

    return {
      error: false,
      message: text,
      routeData: {
        origin: origin,
        destination: destination,
        line: bestMatch.line,
        originStop: { lat: bestMatch.originStop.lat, lng: bestMatch.originStop.lng, name: bestMatch.originStop.name },
        destStop: { lat: bestMatch.destStop.lat, lng: bestMatch.destStop.lng, name: bestMatch.destStop.name }
      }
    };
  }
}

module.exports = new AIRouteService();
