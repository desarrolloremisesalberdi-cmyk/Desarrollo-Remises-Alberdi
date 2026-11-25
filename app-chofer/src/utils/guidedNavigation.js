// Motor de Navegación GPS Guiada Paso a Paso (Turn-by-Turn en Español)

export function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatearDistancia(metros) {
  if (metros == null || isNaN(metros)) return '0 m';
  const m = Math.max(0, Math.round(metros));
  if (m >= 1000) {
    return `${(m / 1000).toFixed(1)} km`;
  }
  // Redondear a múltiplos de 10m para lectura limpia al conducir
  if (m > 50) {
    return `${Math.round(m / 10) * 10} m`;
  }
  return `${m} m`;
}

export function obtenerIconoManiobra(type, modifier) {
  if (type === 'arrive') return '🏁';
  if (type === 'roundabout' || type === 'rotary') return '🔄';
  if (!modifier) return '⬆️';
  if (modifier.includes('right')) return '↱';
  if (modifier.includes('left')) return '↰';
  if (modifier === 'uturn') return '↩️';
  return '⬆️';
}

export function traducirAccionManiobra(type, modifier, streetName, targetLabel = 'el punto de encuentro') {
  const calle = streetName && streetName.trim() !== '' ? ` por ${streetName}` : '';

  if (type === 'arrive') {
    return `Llegaste a ${targetLabel}`;
  }

  if (type === 'depart') {
    return streetName ? `Avance por ${streetName}` : 'Inicie el recorrido';
  }

  if (type === 'roundabout' || type === 'rotary') {
    return `En la rotonda, tome la salida${calle}`;
  }

  switch (modifier) {
    case 'right':
      return `gire a la derecha${calle}`;
    case 'slight right':
      return `gire levemente a la derecha${calle}`;
    case 'sharp right':
      return `gire cerrado a la derecha${calle}`;
    case 'left':
      return `gire a la izquierda${calle}`;
    case 'slight left':
      return `gire levemente a la izquierda${calle}`;
    case 'sharp left':
      return `gire cerrado a la izquierda${calle}`;
    case 'uturn':
      return `retome en U${calle}`;
    case 'straight':
    default:
      return `continúe recto${calle}`;
  }
}

/**
 * Consulta OSRM para obtener la polilínea exacta calle por calle y las maniobras paso a paso.
 */
export async function obtenerRutaGuiada(origenLat, origenLng, destinoLat, destinoLng, targetLabel = 'la ubicación del pasajero') {
  const oLat = parseFloat(origenLat);
  const oLng = parseFloat(origenLng);
  const dLat = parseFloat(destinoLat);
  const dLng = parseFloat(destinoLng);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
    return null;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return crearRutaDirectaFallback(oLat, oLng, dLat, dLng, targetLabel);
    }

    const route = data.routes[0];
    const coords = (route.geometry?.coordinates || []).map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const rawSteps = route.legs?.[0]?.steps || [];
    const steps = rawSteps.map((st, idx) => {
      const loc = st.maneuver?.location || [dLng, dLat];
      const mType = st.maneuver?.type || 'turn';
      const mMod = st.maneuver?.modifier || 'straight';
      const name = st.name || '';
      return {
        index: idx,
        type: mType,
        modifier: mMod,
        streetName: name,
        distanceMeters: Math.round(st.distance || 0),
        durationSeconds: Math.round(st.duration || 0),
        maneuverLat: loc[1],
        maneuverLng: loc[0],
        icon: obtenerIconoManiobra(mType, mMod),
        actionText: traducirAccionManiobra(mType, mMod, name, targetLabel),
      };
    });

    return {
      coordinates: coords.length > 0 ? coords : [
        { latitude: oLat, longitude: oLng },
        { latitude: dLat, longitude: dLng },
      ],
      totalDistanceMeters: Math.round(route.distance || 0),
      totalDurationSeconds: Math.round(route.duration || 0),
      steps,
      targetLabel,
      origenLat: oLat,
      origenLng: oLng,
      destinoLat: dLat,
      destinoLng: dLng,
    };
  } catch (error) {
    console.warn('Fallback ruta directa GPS:', error);
    return crearRutaDirectaFallback(oLat, oLng, dLat, dLng, targetLabel);
  }
}

function crearRutaDirectaFallback(oLat, oLng, dLat, dLng, targetLabel) {
  const dist = calcularDistanciaMetros(oLat, oLng, dLat, dLng);
  return {
    coordinates: [
      { latitude: oLat, longitude: oLng },
      { latitude: dLat, longitude: dLng },
    ],
    totalDistanceMeters: dist,
    totalDurationSeconds: Math.max(30, Math.round(dist / 8)),
    steps: [
      {
        index: 0,
        type: 'depart',
        modifier: 'straight',
        streetName: '',
        distanceMeters: dist,
        durationSeconds: Math.max(30, Math.round(dist / 8)),
        maneuverLat: oLat,
        maneuverLng: oLng,
        icon: '⬆️',
        actionText: `Diríjase hacia ${targetLabel}`,
      },
      {
        index: 1,
        type: 'arrive',
        modifier: 'straight',
        streetName: '',
        distanceMeters: 0,
        durationSeconds: 0,
        maneuverLat: dLat,
        maneuverLng: dLng,
        icon: '🏁',
        actionText: `Llegaste a ${targetLabel}`,
      },
    ],
    targetLabel,
    origenLat: oLat,
    origenLng: oLng,
    destinoLat: dLat,
    destinoLng: dLng,
  };
}

/**
 * Calcula la instrucción exacta actual ("En 200 m gire a la derecha por...") según la posición GPS en vivo del chofer.
 */
export function calcularEstadoNavegacionEnVivo(ruta, currentLat, currentLng, currentStepIdx = 0) {
  if (!ruta || !ruta.steps || ruta.steps.length === 0) return null;

  const steps = ruta.steps;
  const distTotalDestino = calcularDistanciaMetros(currentLat, currentLng, ruta.destinoLat, ruta.destinoLng);

  // Si ya está a menos de 35 metros del destino final
  if (distTotalDestino <= 35) {
    const lastStep = steps[steps.length - 1];
    return {
      stepIndex: steps.length - 1,
      icon: '🏁',
      mainInstruction: `¡Llegaste a ${ruta.targetLabel}!`,
      subInstruction: `Estás a ${distTotalDestino} m del punto marcado`,
      speechText: `Llegaste a ${ruta.targetLabel}`,
      distToNextTurnMeters: 0,
      remainingTotalMeters: distTotalDestino,
      etaMinutes: 1,
      hasArrived: true,
    };
  }

  // Determinar cuál es la próxima maniobra real (si `currentStepIdx` es 0 = 'depart', miramos hacia la maniobra del paso 1)
  let nextTurnIdx = Math.max(1, currentStepIdx);
  if (nextTurnIdx >= steps.length) {
    nextTurnIdx = steps.length - 1;
  }

  let nextTurnStep = steps[nextTurnIdx];
  let distToManeuver = calcularDistanciaMetros(
    currentLat,
    currentLng,
    nextTurnStep.maneuverLat,
    nextTurnStep.maneuverLng
  );

  // Si el chofer ya alcanzó la esquina de la maniobra (< 28 metros) y hay más pasos, avanzar al siguiente paso automáticamente
  if (distToManeuver <= 28 && nextTurnIdx < steps.length - 1) {
    nextTurnIdx += 1;
    nextTurnStep = steps[nextTurnIdx];
    distToManeuver = calcularDistanciaMetros(
      currentLat,
      currentLng,
      nextTurnStep.maneuverLat,
      nextTurnStep.maneuverLng
    );
  }

  const currentRoadName = steps[Math.max(0, nextTurnIdx - 1)]?.streetName || '';
  const distStr = formatearDistancia(distToManeuver);

  let mainInstruction = '';
  let speechText = '';

  if (nextTurnStep.type === 'arrive') {
    mainInstruction = `En ${distStr} llegarás a ${ruta.targetLabel}`;
    speechText = `Continúa ${distStr} por ${currentRoadName || 'esta calle'} hasta llegar a ${ruta.targetLabel}`;
  } else if (distToManeuver <= 35) {
    mainInstruction = `¡Ahora ${nextTurnStep.actionText}!`;
    speechText = `Ahora ${nextTurnStep.actionText}`;
  } else {
    mainInstruction = `En ${distStr} ${nextTurnStep.actionText}`;
    speechText = `En ${distStr}, ${nextTurnStep.actionText}`;
  }

  // Sub-instrucción (calle actual o siguiente giro)
  const followingStep = nextTurnIdx + 1 < steps.length ? steps[nextTurnIdx + 1] : null;
  let subInstruction = '';
  if (currentRoadName) {
    subInstruction = `Circulando por ${currentRoadName}`;
    if (followingStep && followingStep.type !== 'arrive') {
      subInstruction += ` • Luego: ${followingStep.actionText}`;
    }
  } else if (followingStep) {
    subInstruction = `Luego: ${followingStep.actionText}`;
  } else {
    subInstruction = `Rumbo a ${ruta.targetLabel}`;
  }

  // Estimar tiempo restante (promedio urbano ~30 km/h = 500m/min)
  const etaMinutes = Math.max(1, Math.round(distTotalDestino / 450));

  return {
    stepIndex: nextTurnIdx,
    icon: nextTurnStep.icon,
    mainInstruction,
    subInstruction,
    speechText,
    distToNextTurnMeters: distToManeuver,
    remainingTotalMeters: distTotalDestino,
    etaMinutes,
    hasArrived: false,
  };
}
