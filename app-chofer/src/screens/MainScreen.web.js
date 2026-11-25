import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, useColorScheme, Image } from 'react-native';
import { io } from 'socket.io-client';
import { obtenerRutaGuiada, calcularEstadoNavegacionEnVivo, formatearDistancia, calcularDistanciaMetros } from '../utils/guidedNavigation';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

export default function MainScreen({ route, navigation }) {
  // Estado automático: el chofer inicia siempre como LIBRE (isOnline = true) y pasa a OCUPADO solo con un viaje activo
  const [isOnline, setIsOnline] = useState(true); 
  const [viajeTelefonicoActivo, setViajeTelefonicoActivo] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [location, setLocation] = useState(() => route?.params?.initialLocation || { latitude: -33.044167, longitude: -61.168056 });
  const [mapCenter, setMapCenter] = useState(() => route?.params?.initialLocation || { latitude: -33.044167, longitude: -61.168056 });
  const [confirmadoJubilado, setConfirmadoJubilado] = useState(false);
  const [recaudacionHoy, setRecaudacionHoy] = useState(0);
  const [enEspera, setEnEspera] = useState(false);
  const [minutosEspera, setMinutosEspera] = useState(0);
  const [esperaIntervalId, setEsperaIntervalId] = useState(null);

  // Estados de Navegación GPS Guiada Paso a Paso (Turn-by-Turn + Voz)
  const [guidedRoute, setGuidedRoute] = useState(null);
  const [navStatus, setNavStatus] = useState(null);
  const [navStepIndex, setNavStepIndex] = useState(1);
  const [vozActiva, setVozActiva] = useState(true);
  const lastSpokenStepRef = useRef(null);

  const hablarIndicacion = (texto) => {
    if (!vozActiva || !texto) return;
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new window.SpeechSynthesisUtterance(texto);
        utter.lang = 'es-AR';
        utter.rate = 1.02;
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  };

  const abrirNavegacionVozGoogleMaps = (destLat, destLng) => {
    if (!destLat || !destLng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const solicitarUbicacionWeb = () => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coords = { latitude, longitude };
          locationRef.current = coords;
          setLocation(coords);
          mapCenterRef.current = coords;
          setMapCenter(coords);
          const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
          socket.emit('update_location', {
            chofer_id: chofer.id || 'sim-1',
            dni: chofer.dni || '31861718',
            movil: chofer.numero_movil || '14',
            lat: latitude,
            lng: longitude,
            isOnline: isOnline,
            estado: ocupado ? 'ocupado' : 'libre',
            foto_url: chofer.foto_url || null
          });
          alert('Ubicación GPS sincronizada.');
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            alert('Permiso de GPS denegado en tu navegador. Haz clic en el ícono del candado o ubicación en la barra de direcciones de tu navegador para permitir el acceso.');
          } else {
            alert('No se pudo obtener el GPS exacto en este navegador/PC (puede deberse a VPN o falta de sensor satelital). Se mantiene la ubicación central en Casilda.');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    }
  };

  // Recibimos los datos del chofer por parámetros de navegación
  const chofer = route?.params?.chofer || { id: null, nombre: 'Prueba' };

  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  const locationRef = useRef(location);
  const mapCenterRef = useRef(mapCenter);
  const isOnlineRef = useRef(isOnline);
  const activeTripRef = useRef(activeTrip);
  const viajeTelefonicoRef = useRef(viajeTelefonicoActivo);

  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { mapCenterRef.current = mapCenter; }, [mapCenter]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);
  useEffect(() => { viajeTelefonicoRef.current = viajeTelefonicoActivo; }, [viajeTelefonicoActivo]);

  const cargarRecaudacionHoy = async () => {
    if (!chofer?.id) return;
    try {
      const res = await fetch(`${API_URL}/api/finanzas/chofer/${chofer.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.viajes)) {
        const hoyStr = new Date().toDateString();
        const totalHoy = data.viajes
          .filter((v) => v.fecha && new Date(v.fecha).toDateString() === hoyStr)
          .reduce((acc, v) => acc + (parseFloat(v.monto_calculado) || 0), 0);
        setRecaudacionHoy(Math.round(totalHoy));
      }
    } catch (e) {}
  };

  useEffect(() => {
    cargarRecaudacionHoy();
  }, [chofer?.id]);

  // Calcular ruta guiada calle por calle automáticamente cuando se acepta un viaje o comienza el recorrido
  useEffect(() => {
    if (!activeTrip) {
      setGuidedRoute(null);
      setNavStatus(null);
      setNavStepIndex(1);
      lastSpokenStepRef.current = null;
      return;
    }

    const startLat = locationRef.current ? locationRef.current.latitude : -33.044167;
    const startLng = locationRef.current ? locationRef.current.longitude : -61.168056;

    const goingToDestination =
      activeTrip.estado === 'en_viaje' &&
      activeTrip.destino_lat &&
      activeTrip.destino_lng &&
      Number(activeTrip.destino_lat) !== 0 &&
      Number(activeTrip.destino_lng) !== 0;

    const targetLat = goingToDestination ? Number(activeTrip.destino_lat) : Number(activeTrip.origen_lat);
    const targetLng = goingToDestination ? Number(activeTrip.destino_lng) : Number(activeTrip.origen_lng);
    const targetLabel = goingToDestination
      ? 'el destino del pasajero'
      : (activeTrip.origen_direccion ? activeTrip.origen_direccion : 'la ubicación del pasajero');

    if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng)) return;

    let cancelled = false;
    (async () => {
      const ruta = await obtenerRutaGuiada(startLat, startLng, targetLat, targetLng, targetLabel);
      if (!cancelled && ruta) {
        setGuidedRoute(ruta);
        setNavStepIndex(1);
        const estadoInicial = calcularEstadoNavegacionEnVivo(ruta, startLat, startLng, 1);
        setNavStatus(estadoInicial);
        if (estadoInicial?.speechText) {
          lastSpokenStepRef.current = `${activeTrip.estado}-1`;
          hablarIndicacion(estadoInicial.speechText);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTrip?.id, activeTrip?.estado]);

  // Actualizar las indicaciones ("En 200 m gire a la derecha...") en tiempo real a medida que el chofer avanza con el GPS
  useEffect(() => {
    if (!guidedRoute || !location) return;
    const nuevoEstado = calcularEstadoNavegacionEnVivo(
      guidedRoute,
      location.latitude,
      location.longitude,
      navStepIndex
    );
    if (nuevoEstado) {
      if (nuevoEstado.stepIndex !== navStepIndex) {
        setNavStepIndex(nuevoEstado.stepIndex);
        const stepKey = `${activeTrip?.estado}-${nuevoEstado.stepIndex}`;
        if (lastSpokenStepRef.current !== stepKey && nuevoEstado.speechText) {
          lastSpokenStepRef.current = stepKey;
          hablarIndicacion(nuevoEstado.speechText);
        }
      }
      setNavStatus(nuevoEstado);
    }
  }, [location?.latitude, location?.longitude, guidedRoute]);

  useEffect(() => {
    // Al reconectar socket (por pérdida temporal de señal o suspensión)
    socket.on('connect', () => {
      console.log('Socket chofer conectado en Web');
      if (chofer && locationRef.current) {
        const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
        socket.emit('update_location', {
          chofer_id: chofer.id || 'sim-1',
          dni: chofer.dni || '31861718',
          movil: chofer.numero_movil || '14',
          lat: locationRef.current.latitude,
          lng: locationRef.current.longitude,
          isOnline: !ocupado,
          estado: ocupado ? 'ocupado' : 'libre',
          foto_url: chofer.foto_url || null
        });
      }
    });

    // Escuchar solicitudes de viaje nuevas
    socket.on('new_ride_request', async (viaje) => {
      if (viajeTelefonicoRef.current || activeTripRef.current) {
        return; // Chofer ocupado en otro viaje
      }
      if (viaje.chofer_destinado_id && String(viaje.chofer_destinado_id) !== String(chofer.id)) {
        return; // Asignado a otro chofer
      }

      // Si por alguna razón no tiene origen_direccion o es genérico, intentar geocodificar de inmediato
      if (!viaje.origen_direccion || viaje.origen_direccion === 'Mi ubicación actual' || viaje.origen_direccion.trim() === '' || String(viaje.origen_direccion).startsWith('-')) {
        if (viaje.origen_lat && viaje.origen_lng) {
          try {
            const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${viaje.origen_lat}&lon=${viaje.origen_lng}&format=json`);
            if (nomRes.ok) {
              const nomData = await nomRes.json();
              if (nomData && nomData.address) {
                const addr = nomData.address;
                const calle = addr.road || addr.pedestrian || addr.suburb || '';
                const altura = addr.house_number ? ` ${addr.house_number}` : '';
                const barrio = addr.neighbourhood || addr.suburb ? ` (${addr.neighbourhood || addr.suburb})` : '';
                const ciudad = addr.city || addr.town || addr.village || 'Casilda';
                if (calle) {
                  viaje.origen_direccion = `${calle}${altura}${barrio}, ${ciudad}`;
                } else if (nomData.display_name) {
                  viaje.origen_direccion = nomData.display_name.split(',').slice(0, 3).join(',').trim();
                }
              }
            }
          } catch (e) {
            console.error('Error reverse geocoding en app-chofer:', e);
          }
        }
      }

      setIncomingRide(viaje);
    });

    // Escuchar cambios de estado enviados por el Operador o la Base
    socket.on('driver_status_changed', (data) => {
      const matchesChofer = 
        (data.chofer_id && String(data.chofer_id) === String(chofer.id)) ||
        (data.dni && String(data.dni) === String(chofer.dni)) ||
        (data.numero_movil && String(data.numero_movil) === String(chofer.numero_movil));

      if (matchesChofer) {
        if (data.estado === 'ocupado') {
          setIsOnline(false);
          if (data.origen === 'base_telefonica') {
            setViajeTelefonicoActivo(true);
            try {
              const audio = new window.Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
              audio.play();
            } catch (e) {}
            alert('📞 La Base te ha asignado un VIAJE TELEFÓNICO.\n\nTu estado cambió automáticamente a OCUPADO.\nEste viaje NO rinde comisión a la app (0% Comisión).\nAl completar el viaje, presiona "Finalizar Viaje" para volver a LIBRE automáticamente.');
          }
        } else if (data.estado === 'libre') {
          setViajeTelefonicoActivo(false);
          setIsOnline(true);
        } else if (data.estado === 'inactivo') {
          setViajeTelefonicoActivo(false);
          setIsOnline(false);
        }
      }
    });

    socket.on('ride_cancelled', (data) => {
      const isCurrentTrip = activeTripRef.current && String(activeTripRef.current.id) === String(data.viaje_id);
      const isAssignedDriver = data.chofer_id && String(data.chofer_id) === String(chofer.id);
      if (isCurrentTrip || isAssignedDriver) {
        setActiveTrip(null);
        setIncomingRide(null);
        setConfirmadoJubilado(false);
        setEnEspera(false);
        setMinutosEspera(0);
        setIsOnline(true); // Vuelve automáticamente a LIBRE
        if (data.cancelado_por !== 'chofer') {
          alert('⚠️ El viaje fue cancelado. Tu estado volvió automáticamente a LIBRE.');
        }
      }
    });

    return () => {
      socket.off('new_ride_request');
      socket.off('driver_status_changed');
      socket.off('ride_cancelled');
    };
  }, [chofer]);

  // Monitoreo de pestaña/pantalla activa en Web (desbloqueo o cambio de pestaña)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        if (chofer && locationRef.current) {
          const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
          socket.emit('update_location', {
            chofer_id: chofer.id || 'sim-1',
            dni: chofer.dni || '31861718',
            movil: chofer.numero_movil || '14',
            lat: locationRef.current.latitude,
            lng: locationRef.current.longitude,
            isOnline: !ocupado,
            estado: ocupado ? 'ocupado' : 'libre',
            foto_url: chofer.foto_url || null
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [chofer]);

  // Heartbeat periódico (cada 12 segundos) para mantener vivo el socket con la ubicación real
  useEffect(() => {
    if (!isOnline && !activeTrip && !viajeTelefonicoActivo) return;
    const heartbeat = setInterval(() => {
      if (chofer && locationRef.current) {
        const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
        socket.emit('update_location', {
          chofer_id: chofer.id || 'sim-1',
          dni: chofer.dni || '31861718',
          movil: chofer.numero_movil || '14',
          lat: locationRef.current.latitude,
          lng: locationRef.current.longitude,
          isOnline: !ocupado,
          estado: ocupado ? 'ocupado' : 'libre',
          foto_url: chofer.foto_url || null
        });
      }
    }, 12000);
    return () => clearInterval(heartbeat);
  }, [chofer, isOnline, activeTrip, viajeTelefonicoActivo]);

  useEffect(() => {
    let watchId = null;

    if (isOnline || activeTrip || viajeTelefonicoActivo) {
      const ocupadoActual = Boolean(activeTrip || viajeTelefonicoActivo);

      // Si ya vino ubicación real del login, emitirla enseguida
      if (locationRef.current) {
        socket.emit('update_location', {
          chofer_id: chofer.id || 'sim-1',
          dni: chofer.dni || '31861718',
          movil: chofer.numero_movil || '14',
          lat: locationRef.current.latitude,
          lng: locationRef.current.longitude,
          isOnline: !ocupadoActual,
          estado: ocupadoActual ? 'ocupado' : 'libre',
          foto_url: chofer.foto_url || null
        });
      }

      if ('geolocation' in navigator) {
        // 1. Obtener posición exacta inmediatamente con alta precisión (GPS real)
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coords = { latitude, longitude };
            locationRef.current = coords;
            setLocation(coords);
            mapCenterRef.current = coords;
            setMapCenter(coords);
            const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
            socket.emit('update_location', {
              chofer_id: chofer.id || 'sim-1',
              dni: chofer.dni || '31861718',
              movil: chofer.numero_movil || '14',
              lat: latitude,
              lng: longitude,
              isOnline: !ocupado,
              estado: ocupado ? 'ocupado' : 'libre',
              foto_url: chofer.foto_url || null
            });
          },
          (err) => console.warn('Error en getCurrentPosition inicial:', err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );

        // 2. Mantener seguimiento continuo con alta precisión
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const coords = { latitude, longitude };
            locationRef.current = coords;
            setLocation(coords);

            // Estabilizar el mapa web: sólo recentramos el iframe si el chofer se movió más de 200m
            // para evitar que el iframe de Google Maps se recargue y titile con cada micro-pulso de GPS
            if (!activeTripRef.current && mapCenterRef.current) {
              const dist = calcularDistanciaMetros(
                mapCenterRef.current.latitude,
                mapCenterRef.current.longitude,
                latitude,
                longitude
              );
              if (dist >= 200) {
                mapCenterRef.current = coords;
                setMapCenter(coords);
              }
            }

            const ocupado = Boolean(activeTripRef.current || viajeTelefonicoRef.current);
            socket.emit('update_location', {
              chofer_id: chofer.id || 'sim-1',
              dni: chofer.dni || '31861718',
              movil: chofer.numero_movil || '14',
              lat: latitude,
              lng: longitude,
              isOnline: !ocupado,
              estado: ocupado ? 'ocupado' : 'libre',
              foto_url: chofer.foto_url || null
            });
          },
          (error) => {
            console.warn('Error obteniendo ubicación', error);
            if (error.code === error.PERMISSION_DENIED) {
              alert('Permiso de GPS denegado. Actívalo en tu navegador para trabajar.');
            }
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
      } else {
        alert("Tu navegador no soporta GPS.");
      }
    } else {
      socket.emit('update_location', {
        chofer_id: chofer.id || 'sim-1',
        dni: chofer.dni || '31861718',
        movil: chofer.numero_movil || '14',
        lat: locationRef.current ? locationRef.current.latitude : null,
        lng: locationRef.current ? locationRef.current.longitude : null,
        isOnline: false,
        estado: 'inactivo'
      });
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    }

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, activeTrip, viajeTelefonicoActivo, chofer]);

  const cerrarSesion = async () => {
    try {
      await fetch(`${API_URL}/api/choferes/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chofer_id: chofer.id,
          dni: chofer.dni,
          numero_movil: chofer.numero_movil
        })
      });
    } catch (e) {
      console.error('Error en logout HTTP:', e);
    }
    try {
      if (socket) {
        socket.emit('manual_disconnect', {
          chofer_id: chofer.id,
          dni: chofer.dni,
          numero_movil: chofer.numero_movil
        });
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('chofer_user');
    }
    navigation.replace('Login');
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerStyle: {
        backgroundColor: '#0b1320',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      },
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Image 
            source={require('../../assets/logo-alberdi.png')} 
            style={{ width: 32, height: 32, borderRadius: 16 }} 
            resizeMode="cover"
          />
          <View>
            <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 15, letterSpacing: -0.2 }}>
              Taxis Alberdi
            </Text>
            <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 10, letterSpacing: 0.3 }}>
              Móvil #{chofer?.numero_movil || '14'} • Chofer
            </Text>
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, gap: 6 }}>
          <TouchableOpacity 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 10, 
              backgroundColor: 'rgba(30, 41, 59, 0.85)', 
              borderRadius: 16, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.12)',
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4,
              cursor: 'pointer'
            }} 
            onPress={() => navigation.navigate('Resumen', { chofer })}
          >
            <Text style={{ fontSize: 12 }}>📊</Text>
            <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 11 }}>Resumen</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 8, 
              backgroundColor: 'rgba(239, 68, 68, 0.18)', 
              borderRadius: 16, 
              borderWidth: 1, 
              borderColor: 'rgba(239, 68, 68, 0.35)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer'
            }} 
            onPress={cerrarSesion}
          >
            <Text style={{ fontSize: 11 }}>🚪</Text>
            <Text style={{ color: '#f87171', fontWeight: '700', fontSize: 11 }}>Salir</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, chofer, theme]);

  const aceptarViaje = async () => {
    if (!chofer.id || !incomingRide) return;

    try {
      const response = await fetch(`${API_URL}/api/viajes/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: incomingRide.id,
          chofer_id: chofer.id
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('¡Viaje Aceptado! Dirígete al punto de partida.');
        setActiveTrip({
          ...data.viaje,
          origen_direccion: incomingRide.origen_direccion || (data.viaje && data.viaje.origen_direccion)
        });
        setConfirmadoJubilado(false);
        setIsOnline(false); // Automáticamente pasa a ocupado
      } else {
        alert('Error al aceptar el viaje: ' + data.error);
      }
    } catch (error) {
      alert('Error de conexión');
    }
    setIncomingRide(null);
  };

  const rechazarViaje = async () => {
    if (incomingRide && incomingRide.id && chofer.id) {
      try {
        await fetch(`${API_URL}/api/viajes/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viaje_id: incomingRide.id,
            chofer_id: chofer.id
          })
        });
      } catch (e) {
        console.error('Error al rechazar:', e);
      }
    }
    setIncomingRide(null);
  };

  const empezarRecorrido = async () => {
    if (!activeTrip) return;
    try {
      const response = await fetch(`${API_URL}/api/viajes/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: activeTrip.id,
          chofer_id: chofer.id
        })
      });
      const data = await response.json();
      if (data.success) {
        setActiveTrip({ ...activeTrip, estado: 'en_viaje' });
      } else {
        alert('Error al empezar el recorrido');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleToggleEspera = () => {
    if (!enEspera) {
      setEnEspera(true);
      const intervalId = setInterval(() => {
        setMinutosEspera(prev => {
          const nuevosMinutos = prev + 1;
          socket.emit('toggle_espera', {
            viaje_id: activeTrip.id,
            pasajero_id: activeTrip.usuario_id,
            en_espera: true,
            minutos: nuevosMinutos
          });
          return nuevosMinutos;
        });
      }, 60000); // 1 minuto
      setEsperaIntervalId(intervalId);
      socket.emit('toggle_espera', {
        viaje_id: activeTrip.id,
        pasajero_id: activeTrip.usuario_id,
        en_espera: true,
        minutos: minutosEspera
      });
    } else {
      setEnEspera(false);
      if (esperaIntervalId) {
        clearInterval(esperaIntervalId);
        setEsperaIntervalId(null);
      }
      socket.emit('toggle_espera', {
        viaje_id: activeTrip.id,
        pasajero_id: activeTrip.usuario_id,
        en_espera: false,
        minutos: minutosEspera
      });
    }
  };

  const handleFinishTrip = async () => {
    if (!activeTrip) return;
    try {
      if (esperaIntervalId) clearInterval(esperaIntervalId);
      const response = await fetch(`${API_URL}/api/viajes/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: activeTrip.id,
          chofer_id: chofer.id || chofer.dni,
          fin_lat: location ? location.latitude : -33.046,
          fin_lng: location ? location.longitude : -61.169,
          espera_minutos: minutosEspera
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Viaje Finalizado.\nDistancia: ${data.viaje.distancia_km.toFixed(2)} km\nMonto a Cobrar: $${data.viaje.monto_calculado}\nComisión Base: $${data.viaje.comision_admin}\n\nTu estado volvió automáticamente a LIBRE.`);
      }
    } catch (err) {
      console.error('Error al finalizar viaje:', err);
    }
    setActiveTrip(null);
    setEnEspera(false);
    setMinutosEspera(0);
    setEsperaIntervalId(null);
    setIsOnline(true); // Pasa automáticamente a LIBRE
    cargarRecaudacionHoy();
  };

  const cancelarViajeActivo = async () => {
    if (!activeTrip) return;
    if (!window.confirm('¿Estás seguro de que deseas cancelar este viaje? Volverás automáticamente al estado LIBRE.')) return;
    try {
      if (esperaIntervalId) clearInterval(esperaIntervalId);
      await fetch(`${API_URL}/api/viajes/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: activeTrip.id,
          chofer_id: chofer.id,
          cancelado_por: 'chofer'
        })
      });
    } catch (e) {
      console.error('Error al cancelar viaje:', e);
    }
    setActiveTrip(null);
    setConfirmadoJubilado(false);
    setEnEspera(false);
    setMinutosEspera(0);
    setEsperaIntervalId(null);
    setIsOnline(true); // Vuelve automáticamente a LIBRE
    alert('Viaje cancelado. Tu estado volvió automáticamente a LIBRE.');
  };

  const finalizarViajeTelefonico = async () => {
    setViajeTelefonicoActivo(false);
    setIsOnline(true);

    const updatePayload = {
      chofer_id: chofer.id || 'sim-1',
      dni: chofer.dni || '31861718',
      numero_movil: chofer.numero_movil || '14',
      estado: 'libre',
      origen: 'chofer_self'
    };

    // Notificar al operador e inversores por Socket y API
    socket.emit('operator_set_driver_status', updatePayload);
    if (locationRef.current) {
      socket.emit('update_location', {
        chofer_id: chofer.id || 'sim-1',
        dni: chofer.dni || '31861718',
        movil: chofer.numero_movil || '14',
        lat: locationRef.current.latitude,
        lng: locationRef.current.longitude,
        isOnline: true,
        estado: 'libre',
        foto_url: chofer.foto_url || null
      });
    }

    try {
      await fetch(`${API_URL}/api/choferes/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
    } catch (e) {
      console.log('Error al actualizar estado:', e);
    }

    alert('✅ Viaje telefónico finalizado.\nYa te encuentras LIBRE para recibir solicitudes.');
  };

  const handleRequestManualClose = async () => {
    if (!activeTrip) return;
    try {
      const response = await fetch(`${API_URL}/api/viajes/request-manual-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viaje_id: activeTrip.id })
      });
      const data = await response.json();
      if (data.success) {
        alert('Solicitud enviada. Esperando que el operador fije el monto...');
        setActiveTrip({ ...activeTrip, requiere_cierre_manual: true });
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const mapEmbedUrl = useMemo(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (activeTrip && guidedRoute) {
      const oLat = guidedRoute.origenLat || mapCenter?.latitude || -33.044167;
      const oLng = guidedRoute.origenLng || mapCenter?.longitude || -61.168056;
      return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${oLat},${oLng}&destination=${guidedRoute.destinoLat},${guidedRoute.destinoLng}&mode=driving`;
    }
    const cLat = mapCenter?.latitude || -33.044167;
    const cLng = mapCenter?.longitude || -61.168056;
    return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${cLat},${cLng}&zoom=16&maptype=roadmap`;
  }, [
    Boolean(activeTrip),
    activeTrip?.id,
    activeTrip?.estado,
    guidedRoute?.origenLat,
    guidedRoute?.origenLng,
    guidedRoute?.destinoLat,
    guidedRoute?.destinoLng,
    mapCenter?.latitude,
    mapCenter?.longitude
  ]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.mapPlaceholder, { backgroundColor: theme.cardBg, position: 'relative', overflow: 'hidden' }]}>
        <iframe 
          title="Mapa de Casilda"
          src={mapEmbedUrl}
          style={{ width: '100%', height: '100%', border: 0 }}
        />

        {/* Marcador visual de Mi Taxi sobre el mapa web */}
        <View style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: [{ translateX: -60 }, { translateY: -45 }],
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 20
        }}>
          <View style={{
            backgroundColor: '#10b981',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: '#ffffff',
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 5
          }}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>🚕</Text>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>
              Móvil #{chofer.numero_movil || '14'}
            </Text>
          </View>
          <View style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#10b981',
            borderWidth: 3,
            borderColor: '#ffffff',
            marginTop: 3,
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 6
          }} />
        </View>

        {/* Botón flotante para pedir / actualizar ubicación en PC */}
        <TouchableOpacity
          onPress={solicitarUbicacionWeb}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            backgroundColor: '#1e293b',
            borderColor: '#3b82f6',
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 4,
            zIndex: 50
          }}
        >
          <Text style={{ fontSize: 14, marginRight: 4 }}>📍</Text>
          <Text style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: 12 }}>Mi Ubicación</Text>
        </TouchableOpacity>
      </View>
      
      {/* Notificación de Nuevo Viaje */}
      {incomingRide && (
        <View style={styles.notificationOverlay}>
          <View style={[styles.notificationCard, { backgroundColor: theme.cardBg, borderColor: theme.accent }]}>
            <Text style={[styles.notificationTitle, { color: theme.accent }]}>🚕 ¡NUEVO VIAJE!</Text>
            {incomingRide.chofer_destinado_id && (
              <View style={{ backgroundColor: '#6366f1', padding: 8, borderRadius: 8, marginBottom: 12, width: '100%', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>⭐ ¡El pasajero te eligió especialmente a ti!</Text>
              </View>
            )}
            {incomingRide.pasajero_nombre && (
              <Text style={[styles.notificationText, { color: '#ffffff', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }]}>
                👤 Pasajero: {incomingRide.pasajero_nombre}
              </Text>
            )}

            <View style={{
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderWidth: 1,
              borderColor: '#38bdf8',
              borderRadius: 12,
              padding: 12,
              marginVertical: 8,
              width: '100%',
              alignItems: 'center'
            }}>
              <Text style={{ color: '#38bdf8', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>
                📍 Domicilio de Recogida
              </Text>
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>
                {incomingRide.origen_direccion || 'Ubicación seleccionada en Casilda'}
              </Text>
            </View>
            {incomingRide.es_jubilado && (
              <View style={{ backgroundColor: '#10b981', padding: 8, borderRadius: 8, marginVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>¡ATENCIÓN: PASAJERO JUBILADO!</Text>
                <Text style={{ color: 'white', fontSize: 13, textAlign: 'center', marginTop: 3 }}>Aplica Tarifa con Descuento</Text>
              </View>
            )}
            
            <View style={styles.notificationActions}>
              <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#ef4444'}]} onPress={rechazarViaje}>
                <Text style={styles.btnText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#10b981'}]} onPress={aceptarViaje}>
                <Text style={styles.btnText}>¡ACEPTAR!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Banner Superior de Navegación GPS Guiada Paso a Paso (cuando hay viaje activo) o HUD de Estado */}
      {activeTrip && navStatus ? (
        <View style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          maxWidth: 640,
          alignSelf: 'center',
          width: '94%',
          backgroundColor: '#065f46',
          borderRadius: 18,
          borderWidth: 2,
          borderColor: '#10b981',
          padding: 14,
          zIndex: 120,
          boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: 'rgba(6, 78, 59, 0.9)',
              borderWidth: 1.5,
              borderColor: '#34d399',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26, color: '#fff', fontWeight: '900' }}>{navStatus.icon}</Text>
              <Text style={{ fontSize: 10, color: '#a7f3d0', fontWeight: '800' }}>
                {formatearDistancia(navStatus.distToNextTurnMeters)}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ecfdf5', fontSize: 16, fontWeight: '900', lineHeight: 21 }}>
                {navStatus.mainInstruction}
              </Text>
              <Text style={{ color: '#a7f3d0', fontSize: 12, fontWeight: '600', marginTop: 3 }} numberOfLines={2}>
                {navStatus.subInstruction}
              </Text>
            </View>
          </View>

          <View style={{
            marginTop: 10,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: 'rgba(167, 243, 208, 0.25)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <Text style={{ color: '#d1fae5', fontSize: 12, fontWeight: '800' }}>
              📍 Falta: {formatearDistancia(navStatus.remainingTotalMeters)} • ⏱️ ~{navStatus.etaMinutes} min
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  const nuevo = !vozActiva;
                  setVozActiva(nuevo);
                  if (nuevo && navStatus.speechText) {
                    hablarIndicacion(navStatus.speechText);
                  }
                }}
                style={{
                  backgroundColor: vozActiva ? 'rgba(16, 185, 129, 0.35)' : 'rgba(15, 23, 42, 0.6)',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#34d399',
                  cursor: 'pointer',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                  {vozActiva ? '🔊 Voz Activa' : '🔇 Voz Silenciada'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => abrirNavegacionVozGoogleMaps(guidedRoute?.destinoLat, guidedRoute?.destinoLng)}
                style={{
                  backgroundColor: '#0284c7',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#38bdf8',
                  cursor: 'pointer',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>🧭 Abrir Voz GPS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={[
          styles.header, 
          { 
            backgroundColor: 'rgba(15, 23, 42, 0.94)', 
            borderColor: viajeTelefonicoActivo 
              ? '#f59e0b' 
              : (activeTrip ? '#ef4444' : '#10b981'),
            boxShadow: viajeTelefonicoActivo 
              ? '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(245, 158, 11, 0.35)' 
              : (activeTrip 
                  ? '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.35)' 
                  : '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.35)')
          }
        ]}>
          <View style={[
            styles.statusIndicator, 
            { 
              backgroundColor: viajeTelefonicoActivo ? '#f59e0b' : (activeTrip ? '#ef4444' : '#10b981'),
              boxShadow: viajeTelefonicoActivo ? '0 0 8px #f59e0b' : (activeTrip ? '0 0 8px #ef4444' : '0 0 8px #10b981')
            }
          ]} />
          <Text style={[styles.statusText, { color: '#f8fafc' }]}>
            {viajeTelefonicoActivo 
              ? 'OCUPADO • VIAJE TELEFÓNICO EN CURSO' 
              : (activeTrip ? 'OCUPADO • EN VIAJE ACTIVO' : 'EN LÍNEA • LIBRE (AUTOMÁTICO)')}
          </Text>
        </View>
      )}

      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, paddingBottom: 40 }]}>
        {/* Barra superior estilo bottom-sheet */}
        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 12 }} />

        {/* Tarjeta Ejecutiva de Resumen del Turno */}
        <View style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <View>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Recaudación de Hoy
            </Text>
            <Text style={{ color: '#10b981', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
              ${recaudacionHoy.toLocaleString('es-AR')}
            </Text>
          </View>
          <View style={{
            backgroundColor: (activeTrip || viajeTelefonicoActivo) ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.15)',
            borderWidth: 1,
            borderColor: (activeTrip || viajeTelefonicoActivo) ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            alignItems: 'flex-end'
          }}>
            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
              Móvil #{chofer.numero_movil || '14'}
            </Text>
            <Text style={{ color: (activeTrip || viajeTelefonicoActivo) ? '#f87171' : '#34d399', fontSize: 11, fontWeight: '800' }}>
              {(activeTrip || viajeTelefonicoActivo) ? '● Ocupado (En Viaje)' : '● Libre (Automático)'}
            </Text>
          </View>
        </View>
        
        {viajeTelefonicoActivo ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              borderColor: '#f59e0b',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              width: '100%',
              marginBottom: 14,
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 26, marginBottom: 4 }}>📞</Text>
              <Text style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>
                VIAJE TELEFÓNICO ASIGNADO
              </Text>
              <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 2 }}>
                Asignado por Operador desde la Base
              </Text>
              
              <View style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 8,
                paddingVertical: 4,
                paddingHorizontal: 10,
                marginTop: 8
              }}>
                <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>
                  ✓ 0% Comisión (Sin retención de app)
                </Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                La aplicación no recibirá solicitudes hasta que finalices este viaje.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#10b981', width: '100%', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.45)' }]}
              onPress={finalizarViajeTelefonico}
            >
              <Text style={styles.buttonText}>✓ Finalizar Viaje y Ponerme Libre</Text>
            </TouchableOpacity>
          </View>
        ) : activeTrip && activeTrip.estado !== 'en_viaje' ? (
          <>
            {activeTrip.es_jubilado && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: 14, borderRadius: 14, marginBottom: 12, borderColor: '#10b981', borderWidth: 1.5 }}>
                <Text style={{ color: '#10b981', fontWeight: 'bold', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
                  🛡️ Este viaje aplica Tarifa Jubilado
                </Text>
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: confirmadoJubilado ? '#10b981' : 'transparent', borderWidth: 1.5, borderColor: '#10b981', paddingVertical: 10 }]}
                  onPress={() => setConfirmadoJubilado(!confirmadoJubilado)}
                >
                  <Text style={[styles.buttonText, { color: confirmadoJubilado ? 'white' : '#10b981', fontSize: 14 }]}>
                    {confirmadoJubilado ? '✓ Identidad Confirmada' : 'Tocar para Confirmar DNI'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              borderWidth: 1,
              borderRadius: 12,
              padding: 10,
              marginBottom: 10,
              width: '100%',
              alignItems: 'center'
            }}>
              <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>
                📍 En camino al domicilio del pasajero
              </Text>
              <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                Al llegar y subir el pasajero, presiona el botón para iniciar el viaje al destino.
              </Text>
            </View>

            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: (activeTrip.es_jubilado && !confirmadoJubilado) ? '#64748b' : '#10b981',
                  boxShadow: (activeTrip.es_jubilado && !confirmadoJubilado) ? 'none' : '0 4px 20px rgba(16, 185, 129, 0.45)'
                }
              ]}
              onPress={empezarRecorrido}
              disabled={activeTrip.es_jubilado && !confirmadoJubilado}
            >
              <Text style={styles.buttonText}>🟢 Pasajero a Bordo (Iniciar Viaje)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: 'rgba(239, 68, 68, 0.16)',
                  borderColor: 'rgba(239, 68, 68, 0.45)',
                  borderWidth: 1.5,
                  marginTop: 10,
                  paddingVertical: 12
                }
              ]}
              onPress={cancelarViajeActivo}
            >
              <Text style={[styles.buttonText, { color: '#f87171', fontSize: 14 }]}>✕ Cancelar Viaje (Volver a Libre)</Text>
            </TouchableOpacity>
          </>
        ) : activeTrip && activeTrip.estado === 'en_viaje' ? (
          <View>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: enEspera ? '#f59e0b' : '#3b82f6', marginBottom: 12, boxShadow: enEspera ? '0 4px 20px rgba(245, 158, 11, 0.4)' : '0 4px 20px rgba(59, 130, 246, 0.4)' }]}
              onPress={handleToggleEspera}
            >
              <Text style={styles.buttonText}>
                {enEspera ? `⏸️ Pausar Espera (${minutosEspera} min)` : `⏳ Iniciar Espera (${minutosEspera} min)`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: '#ef4444',
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                }
              ]}
              onPress={handleFinishTrip}
              disabled={activeTrip && activeTrip.requiere_cierre_manual}
            >
              <Text style={styles.buttonText}>
                {activeTrip.requiere_cierre_manual ? 'Esperando al operador...' : '🏁 Finalizar Viaje (Volver a Libre)'}
              </Text>
            </TouchableOpacity>

            {!activeTrip.requiere_cierre_manual && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: 'rgba(100, 116, 139, 0.6)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, marginTop: 10 }]}
                onPress={handleRequestManualClose}
              >
                <Text style={[styles.buttonText, { fontSize: 13, color: '#cbd5e1' }]}>⚠️ Cerrar por Falla GPS (Operador)</Text>
              </TouchableOpacity>
            )}

            {!activeTrip.requiere_cierre_manual && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, marginTop: 8, paddingVertical: 11 }]}
                onPress={cancelarViajeActivo}
              >
                <Text style={[styles.buttonText, { fontSize: 13, color: '#f87171' }]}>✕ Cancelar Viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.35)',
            borderWidth: 1.5,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: 'center'
          }}>
            <Text style={{ color: '#34d399', fontWeight: '900', fontSize: 14, letterSpacing: 0.3, textAlign: 'center' }}>
              🟢 MÓVIL LIBRE • RECEPCIÓN AUTOMÁTICA ACTIVA
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 17 }}>
              Pasarás a Ocupado automáticamente al aceptar un viaje o recibir uno de la Base, y volverás a Libre al finalizarlo o cancelarlo.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const darkTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  accent: '#10b981', // Verde Esmeralda Neón Oficial
};

const lightTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  accent: '#10b981',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    zIndex: 100,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(16, 185, 129, 0.45)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
    elevation: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    cursor: 'pointer',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  /* Estilos para el Pop-up del Viaje */
  notificationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  notificationCard: {
    padding: 28,
    borderRadius: 24,
    width: '88%',
    maxWidth: 420,
    alignItems: 'center',
    boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 25px rgba(16, 185, 129, 0.3)',
    elevation: 15,
    borderWidth: 1.5,
  },
  notificationTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  notificationText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 21,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    cursor: 'pointer',
  },
  btnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  }
});
