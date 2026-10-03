import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

export default function MainScreen({ route, navigation }) {
  const [isOnline, setIsOnline] = useState(false); 
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

  useEffect(() => {
    // Escuchar solicitudes de viaje nuevas
    socket.on('new_ride_request', (viaje) => {
      setIncomingRide(prev => viaje);
    });

    return () => {
      socket.off('new_ride_request');
    };
  }, []);

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
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ marginRight: 10, padding: 8, backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border, borderRadius: 6 }} 
            onPress={() => navigation.navigate('Resumen', { chofer })}
          >
            <Text style={{ color: theme.text, fontWeight: 'bold' }}>Resumen</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ marginRight: 15, padding: 8, backgroundColor: '#ef4444', borderRadius: 6 }} 
            onPress={() => {
              socket.emit('manual_disconnect', { chofer_id: chofer.id || chofer.dni });
              if (window.localStorage) window.localStorage.removeItem('chofer_user');
              navigation.replace('Login');
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar Sesión</Text>
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

  const rechazarViaje = () => {
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

      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
        <Text style={[styles.statusText, { color: theme.text }]}>{isOnline ? 'ESTÁS LIBRE (VERDE)' : 'ESTÁS OCUPADO/INACTIVO (ROJO)'}</Text>
      </View>

      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Recaudación Hoy: $0</Text>
        
        {activeTrip && activeTrip.estado !== 'en_viaje' ? (
          <>
            {activeTrip.es_jubilado && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 10, marginBottom: 15, borderColor: '#10b981', borderWidth: 1 }}>
                <Text style={{ color: '#10b981', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Este viaje aplica Tarifa Jubilado</Text>
                <TouchableOpacity 
                  style={[styles.button, { backgroundColor: confirmadoJubilado ? '#10b981' : 'transparent', borderWidth: 2, borderColor: '#10b981', marginTop: 0 }]}
                  onPress={() => setConfirmadoJubilado(!confirmadoJubilado)}
                >
                  <Text style={[styles.buttonText, { color: confirmadoJubilado ? 'white' : '#10b981' }]}>
                    {confirmadoJubilado ? '✓ Identidad Confirmada' : 'Tocar para Confirmar DNI'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: (activeTrip.es_jubilado && !confirmadoJubilado) ? '#94a3b8' : '#3b82f6' }]}
              onPress={empezarRecorrido}
              disabled={activeTrip.es_jubilado && !confirmadoJubilado}
            >
              <Text style={styles.buttonText}>Empezar Recorrido</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View>
            {activeTrip && activeTrip.estado === 'en_viaje' && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: enEspera ? '#f59e0b' : '#3b82f6', marginBottom: 15 }]}
                onPress={handleToggleEspera}
              >
                <Text style={styles.buttonText}>
                  {enEspera ? `Pausar Espera (${minutosEspera} min)` : `Iniciar Espera (${minutosEspera} min)`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: isOnline ? '#ef4444' : (activeTrip ? '#ef4444' : '#10b981') }]}
              onPress={handleToggleStatus}
              disabled={activeTrip && activeTrip.requiere_cierre_manual}
            >
              <Text style={styles.buttonText}>
                {activeTrip 
                  ? (activeTrip.requiere_cierre_manual ? 'Esperando al operador...' : 'Finalizar Viaje') 
                  : (isOnline ? 'Pasar a Ocupado / Fuera de servicio' : 'Pasar a Libre (Comenzar a recibir viajes)')}
              </Text>
            </TouchableOpacity>

            {activeTrip && activeTrip.estado === 'en_viaje' && !activeTrip.requiere_cierre_manual && (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#64748b', marginTop: 10 }]}
                onPress={handleRequestManualClose}
              >
                <Text style={styles.buttonText}>Cerrar por Falla GPS (Operador)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const darkTheme = {
  bg: '#0f172a',
  cardBg: 'rgba(30, 41, 59, 0.95)',
  border: 'rgba(255, 255, 255, 0.1)',
  text: '#f8fafc',
  accent: '#f59e0b', // Ámbar (Chofer)
};

const lightTheme = {
  bg: '#f1f5f9',
  cardBg: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#0f172a',
  accent: '#f59e0b',
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
    top: 50,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 25,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    borderTopWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
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
    padding: 35,
    borderRadius: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
  },
  notificationTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 15,
  },
  notificationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 25,
    gap: 15,
  },
  btnAction: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  btnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  }
});
