import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, useColorScheme, Image } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

export default function MainScreen({ route, navigation }) {
  const [isOnline, setIsOnline] = useState(false); 
  const [viajeTelefonicoActivo, setViajeTelefonicoActivo] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [location, setLocation] = useState(null);
  const [confirmadoJubilado, setConfirmadoJubilado] = useState(false);
  const [enEspera, setEnEspera] = useState(false);
  const [minutosEspera, setMinutosEspera] = useState(0);
  const [esperaIntervalId, setEsperaIntervalId] = useState(null);

  // Recibimos los datos del chofer por parámetros de navegación
  const chofer = route?.params?.chofer || { id: null, nombre: 'Prueba' };

  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  const locationRef = useRef(location);
  const isOnlineRef = useRef(isOnline);
  const activeTripRef = useRef(activeTrip);

  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);

  useEffect(() => {
    // Al reconectar socket (por pérdida temporal de señal o suspensión)
    socket.on('connect', () => {
      console.log('Socket chofer conectado en Web');
      if (chofer && (isOnlineRef.current || activeTripRef.current)) {
        socket.emit('update_location', {
          chofer_id: chofer.id || 'sim-1',
          dni: chofer.dni || '31861718',
          movil: chofer.numero_movil || '14',
          lat: locationRef.current ? locationRef.current.latitude : -33.045,
          lng: locationRef.current ? locationRef.current.longitude : -61.168,
          isOnline: isOnlineRef.current,
          foto_url: chofer.foto_url || null
        });
      }
    });

    // Escuchar solicitudes de viaje nuevas
    socket.on('new_ride_request', (viaje) => {
      if (viajeTelefonicoActivo) {
        return; // Chofer ocupado con viaje de base telefónica
      }
      if (viaje.chofer_destinado_id && viaje.chofer_destinado_id !== chofer.id) {
        return; // Asignado a otro chofer
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
            alert('📞 La Base te ha asignado un VIAJE TELEFÓNICO.\n\nTu estado ahora es OCUPADO.\nEste viaje NO rinde comisión a la app (0% Comisión).\nAl completar el viaje, presiona "Finalizar Viaje y Ponerme Libre".');
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

    return () => {
      socket.off('new_ride_request');
      socket.off('driver_status_changed');
    };
  }, [viajeTelefonicoActivo, chofer]);

  // Monitoreo de pestaña/pantalla activa en Web (desbloqueo o cambio de pestaña)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        if (chofer && (isOnlineRef.current || activeTripRef.current)) {
          socket.emit('update_location', {
            chofer_id: chofer.id || 'sim-1',
            dni: chofer.dni || '31861718',
            movil: chofer.numero_movil || '14',
            lat: locationRef.current ? locationRef.current.latitude : -33.045,
            lng: locationRef.current ? locationRef.current.longitude : -61.168,
            isOnline: isOnlineRef.current,
            foto_url: chofer.foto_url || null
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [chofer]);

  // Heartbeat periódico (cada 12 segundos) para mantener vivo el socket y evitar desconexión
  useEffect(() => {
    if (!isOnline && !activeTrip) return;
    const heartbeat = setInterval(() => {
      if (chofer) {
        socket.emit('update_location', {
          chofer_id: chofer.id || 'sim-1',
          dni: chofer.dni || '31861718',
          movil: chofer.numero_movil || '14',
          lat: locationRef.current ? locationRef.current.latitude : -33.045,
          lng: locationRef.current ? locationRef.current.longitude : -61.168,
          isOnline: isOnlineRef.current,
          foto_url: chofer.foto_url || null
        });
      }
    }, 12000);
    return () => clearInterval(heartbeat);
  }, [chofer, isOnline, activeTrip]);

  useEffect(() => {
    let watchId = null;

    if (isOnline || activeTrip) {
      // Send immediate update so operator sees the change instantly without waiting for GPS
      socket.emit('update_location', {
        chofer_id: chofer.id || 'sim-1',
        dni: chofer.dni || '31861718',
        movil: chofer.numero_movil || '14',
        lat: location ? location.latitude : -33.045,
        lng: location ? location.longitude : -61.168,
        isOnline: true,
        foto_url: chofer.foto_url || null
      });

      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ latitude, longitude });
            
            socket.emit('update_location', {
              chofer_id: chofer.id || 'sim-1',
              dni: chofer.dni || '31861718',
              movil: chofer.numero_movil || '14',
              lat: latitude,
              lng: longitude,
              isOnline: isOnline,
              foto_url: chofer.foto_url || null
            });
          },
          (error) => {
            console.warn('Error obteniendo ubicación', error);
            if (error.code === error.PERMISSION_DENIED) {
              alert('Permiso de GPS denegado. Actívalo en tu navegador para trabajar.');
              setIsOnline(false);
            }
            // Si es un error de timeout o accuracy, no apagamos el isOnline, intentará de nuevo.
          },
          { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
        );
      } else {
        alert("Tu navegador no soporta GPS.");
        setIsOnline(false);
      }
    } else {
      socket.emit('update_location', {
        chofer_id: chofer.id || 'sim-1',
        dni: chofer.dni || '31861718',
        movil: chofer.numero_movil || '14',
        lat: location ? location.latitude : -33.045,
        lng: location ? location.longitude : -61.168,
        isOnline: false
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
  }, [isOnline, activeTrip, chofer]);

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
            onPress={() => {
              socket.emit('manual_disconnect', { chofer_id: chofer.id || chofer.dni });
              if (window.localStorage) window.localStorage.removeItem('chofer_user');
              navigation.replace('Login');
            }}
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
        setActiveTrip(data.viaje);
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

  const handleToggleStatus = async () => {
    if (!isOnline && activeTrip && activeTrip.estado === 'en_viaje') {
      // El chofer estaba ocupado y pasa a libre -> Finaliza el viaje
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
          alert(`Viaje Finalizado.\nDistancia: ${data.viaje.distancia_km.toFixed(2)} km\nMonto a Cobrar: $${data.viaje.monto_calculado}\nComisión Base: $${data.viaje.comision_admin}`);
        }
      } catch (err) {
        console.error('Error al finalizar viaje:', err);
      }
      setActiveTrip(null);
    }
    setIsOnline(!isOnline);
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
    socket.emit('update_location', {
      chofer_id: chofer.id || 'sim-1',
      dni: chofer.dni || '31861718',
      movil: chofer.numero_movil || '14',
      lat: location ? location.latitude : -33.045,
      lng: location ? location.longitude : -61.168,
      isOnline: true,
      foto_url: chofer.foto_url || null
    });

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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.mapPlaceholder, { backgroundColor: theme.cardBg }]}>
        <iframe 
          title="Mapa de Casilda"
          src={`https://www.google.com/maps/embed/v1/view?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&center=-33.044167,-61.168056&zoom=14&maptype=roadmap`}
          style={{ width: '100%', height: '100%', border: 0 }}
        />
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
            <Text style={[styles.notificationText, { color: theme.text }]}>ID Viaje: #{incomingRide.id || 'N/A'}</Text>
            {incomingRide.pasajero_nombre && (
              <Text style={[styles.notificationText, { color: theme.text, fontWeight: 'bold' }]}>Pasajero: {incomingRide.pasajero_nombre}</Text>
            )}
            <Text style={[styles.notificationText, { color: theme.text }]}>
              Se requiere un móvil en las coordenadas: {incomingRide.origen_lat}, {incomingRide.origen_lng}
            </Text>
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

      {/* HUD Superior de Estado del Chofer (Glassmorphism) */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: 'rgba(15, 23, 42, 0.94)', 
          borderColor: viajeTelefonicoActivo 
            ? '#f59e0b' 
            : (isOnline ? '#10b981' : 'rgba(239, 68, 68, 0.6)'),
          boxShadow: viajeTelefonicoActivo 
            ? '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(245, 158, 11, 0.35)' 
            : (isOnline 
                ? '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(16, 185, 129, 0.35)' 
                : '0 6px 20px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.25)')
        }
      ]}>
        <View style={[
          styles.statusIndicator, 
          { 
            backgroundColor: viajeTelefonicoActivo ? '#f59e0b' : (isOnline ? '#10b981' : '#ef4444'),
            boxShadow: viajeTelefonicoActivo ? '0 0 8px #f59e0b' : (isOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444')
          }
        ]} />
        <Text style={[styles.statusText, { color: '#f8fafc' }]}>
          {viajeTelefonicoActivo 
            ? '📞 VIAJE TELEFÓNICO EN CURSO' 
            : (isOnline ? '🟢 EN LÍNEA • DISPONIBLE PARA VIAJES' : '🔴 FUERA DE SERVICIO • EN PAUSA')}
        </Text>
      </View>

      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg }]}>
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
              $0
            </Text>
          </View>
          <View style={{
            backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
            borderWidth: 1,
            borderColor: isOnline ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            alignItems: 'flex-end'
          }}>
            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
              Móvil #{chofer.numero_movil || '14'}
            </Text>
            <Text style={{ color: isOnline ? '#34d399' : '#f87171', fontSize: 11, fontWeight: '800' }}>
              {isOnline ? '● Conectado' : '○ En Pausa'}
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
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: (activeTrip.es_jubilado && !confirmadoJubilado) ? '#64748b' : '#3b82f6',
                  boxShadow: (activeTrip.es_jubilado && !confirmadoJubilado) ? 'none' : '0 4px 20px rgba(59, 130, 246, 0.45)'
                }
              ]}
              onPress={empezarRecorrido}
              disabled={activeTrip.es_jubilado && !confirmadoJubilado}
            >
              <Text style={styles.buttonText}>🚀 Empezar Recorrido</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View>
            {activeTrip && activeTrip.estado === 'en_viaje' && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: enEspera ? '#f59e0b' : '#3b82f6', marginBottom: 12, boxShadow: enEspera ? '0 4px 20px rgba(245, 158, 11, 0.4)' : '0 4px 20px rgba(59, 130, 246, 0.4)' }]}
                onPress={handleToggleEspera}
              >
                <Text style={styles.buttonText}>
                  {enEspera ? `⏸️ Pausar Espera (${minutosEspera} min)` : `⏳ Iniciar Espera (${minutosEspera} min)`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: isOnline ? '#ef4444' : (activeTrip ? '#ef4444' : '#10b981'),
                  boxShadow: isOnline 
                    ? '0 4px 20px rgba(239, 68, 68, 0.4)' 
                    : (activeTrip ? '0 4px 20px rgba(239, 68, 68, 0.4)' : '0 4px 22px rgba(16, 185, 129, 0.45)')
                }
              ]}
              onPress={handleToggleStatus}
              disabled={activeTrip && activeTrip.requiere_cierre_manual}
            >
              <Text style={styles.buttonText}>
                {activeTrip 
                  ? (activeTrip.requiere_cierre_manual ? 'Esperando al operador...' : '🏁 Finalizar Viaje') 
                  : (isOnline ? '⏸️ Pasar a Ocupado / Pausar Turno' : '⚡ Pasar a Libre (Comenzar Turno)')}
              </Text>
            </TouchableOpacity>

            {activeTrip && activeTrip.estado === 'en_viaje' && !activeTrip.requiere_cierre_manual && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: 'rgba(100, 116, 139, 0.6)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, marginTop: 10 }]}
                onPress={handleRequestManualClose}
              >
                <Text style={[styles.buttonText, { fontSize: 13, color: '#cbd5e1' }]}>⚠️ Cerrar por Falla GPS (Operador)</Text>
              </TouchableOpacity>
            )}
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
