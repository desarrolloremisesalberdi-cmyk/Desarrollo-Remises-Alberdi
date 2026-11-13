import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, Alert, AppState, Image, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function MainScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [isOnline, setIsOnline] = useState(false);
  const [viajeTelefonicoActivo, setViajeTelefonicoActivo] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [location, setLocation] = useState(null);
  const [socket, setSocket] = useState(null);
  const [incomingRide, setIncomingRide] = useState(null);
  const [confirmadoJubilado, setConfirmadoJubilado] = useState(false);
  
  const [enEspera, setEnEspera] = useState(false);
  const [minutosEspera, setMinutosEspera] = useState(0);
  const [esperaIntervalId, setEsperaIntervalId] = useState(null);

  // Estados para comprobante de pago anticipado
  const [comprobanteRecibido, setComprobanteRecibido] = useState(null);
  const [comprobanteAprobado, setComprobanteAprobado] = useState(false);
  const [validandoComprobante, setValidandoComprobante] = useState(false);
  const [modalVerComprobante, setModalVerComprobante] = useState(false);
  
  // En React Native (sin web) simularemos un chofer si no viene por params
  const chofer = route?.params?.chofer || { id: 'sim-native', dni: 'sim' };

  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;

  const locationRef = useRef(location);
  const isOnlineRef = useRef(isOnline);
  const activeTripRef = useRef(activeTrip);

  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { activeTripRef.current = activeTrip; }, [activeTrip]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket chofer conectado');
      if (chofer && (isOnlineRef.current || activeTripRef.current)) {
        newSocket.emit('update_location', {
          chofer_id: chofer.id || chofer.dni,
          dni: chofer.dni,
          movil: chofer.numero_movil,
          isOnline: isOnlineRef.current,
          lat: locationRef.current ? locationRef.current.latitude : -33.044167,
          lng: locationRef.current ? locationRef.current.longitude : -61.168056,
          foto_url: chofer.foto_url || null
        });
      }
    });
    
    newSocket.on('new_ride_request', (viaje) => {
      if (viajeTelefonicoActivo) {
        return; // Ocupado en viaje telefónico
      }
      // Si el viaje tiene chofer_destinado_id y no es este chofer, ignorar
      if (viaje.chofer_destinado_id && viaje.chofer_destinado_id !== chofer.id) {
        return;
      }
      setIncomingRide(viaje);
    });

    newSocket.on('driver_status_changed', (data) => {
      const matchesChofer = 
        (data.chofer_id && String(data.chofer_id) === String(chofer.id)) ||
        (data.dni && String(data.dni) === String(chofer.dni)) ||
        (data.numero_movil && String(data.numero_movil) === String(chofer.numero_movil));

      if (matchesChofer) {
        if (data.estado === 'ocupado') {
          setIsOnline(false);
          if (data.origen === 'base_telefonica') {
            setViajeTelefonicoActivo(true);
            Alert.alert(
              '📞 VIAJE TELEFÓNICO ASIGNADO',
              'La Base te ha asignado un viaje tomado por llamada telefónica.\n\nTu estado ahora es OCUPADO.\nEste viaje NO rinde comisión a la app (0% Comisión).\nAl completar el viaje, presiona "Finalizar Viaje y Ponerme Libre".'
            );
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

    newSocket.on('comprobante_recibido', (data) => {
      setComprobanteRecibido(data.comprobante_url);
      setComprobanteAprobado(false);
      Vibration.vibrate([0, 300, 150, 300]);
      Alert.alert(
        '📄 Comprobante Recibido',
        'El pasajero ha adjuntado el comprobante de transferencia. Por favor revísalo en tu pantalla y valídalo.'
      );
    });

    return () => {
      newSocket.off('new_ride_request');
      newSocket.off('driver_status_changed');
      newSocket.off('comprobante_recibido');
      newSocket.disconnect();
    };
  }, [viajeTelefonicoActivo, chofer]);

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
              gap: 4
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
              gap: 3
            }} 
            onPress={() => {
              if (socket) socket.emit('manual_disconnect', { chofer_id: chofer.id || chofer.dni });
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

  // Monitoreo de ciclo de vida del dispositivo (Bloqueo / Segundo Plano / Desbloqueo)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Al desbloquear o abrir la app desde segundo plano
        if (socket) {
          if (!socket.connected) socket.connect();
          if (chofer && (isOnlineRef.current || activeTripRef.current)) {
            socket.emit('update_location', {
              chofer_id: chofer.id || chofer.dni,
              dni: chofer.dni,
              movil: chofer.numero_movil,
              isOnline: isOnlineRef.current,
              lat: locationRef.current ? locationRef.current.latitude : -33.044167,
              lng: locationRef.current ? locationRef.current.longitude : -61.168056,
              foto_url: chofer.foto_url || null
            });
          }
        }
      }
    });
    return () => sub.remove();
  }, [socket, chofer]);

  // Heartbeat periódico (cada 12 segundos) para mantener vivo el socket y la posición
  useEffect(() => {
    if (!isOnline && !activeTrip) return;
    const heartbeat = setInterval(() => {
      if (socket && chofer) {
        socket.emit('update_location', {
          chofer_id: chofer.id || chofer.dni,
          dni: chofer.dni,
          movil: chofer.numero_movil,
          isOnline: isOnlineRef.current,
          lat: locationRef.current ? locationRef.current.latitude : -33.044167,
          lng: locationRef.current ? locationRef.current.longitude : -61.168056,
          foto_url: chofer.foto_url || null
        });
      }
    }, 12000);
    return () => clearInterval(heartbeat);
  }, [socket, chofer, isOnline, activeTrip]);

  // Obtener ubicación inicial inmediatamente al cargar la pantalla
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (currentLoc && currentLoc.coords) {
            setLocation(currentLoc.coords);
            if (mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: currentLoc.coords.latitude,
                longitude: currentLoc.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }, 800);
            }
          }
        }
      } catch (err) {
        console.log('Error obteniendo ubicacion inicial:', err);
      }
    })();
  }, []);

  useEffect(() => {
    let subscription = null;
    
    (async () => {
      if (isOnline || activeTrip) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Error', 'Se requiere permiso de ubicación para trabajar');
          setIsOnline(false);
          return;
        }

        // Send immediate pulse before waiting for GPS lock
        if (socket && chofer) {
          socket.emit('update_location', {
            chofer_id: chofer.id,
            dni: chofer.dni,
            movil: chofer.numero_movil,
            isOnline: true,
            lat: location ? location.latitude : -33.044167,
            lng: location ? location.longitude : -61.168056,
            foto_url: chofer.foto_url || null
          });
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
            showsBackgroundLocationIndicator: true
          },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setLocation({ latitude, longitude });
            if (mapRef.current) {
              mapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }, 600);
            }
            if (socket && chofer) {
              socket.emit('update_location', {
                chofer_id: chofer.id,
                dni: chofer.dni,
                isOnline: isOnline,
                lat: latitude,
                lng: longitude,
                foto_url: chofer.foto_url || null
              });
            }
          }
        );
      } else {
        if (subscription) {
          subscription.remove();
        }
        if (socket && chofer) {
          socket.emit('update_location', {
            chofer_id: chofer.id,
            dni: chofer.dni,
            isOnline: false,
            lat: location ? location.latitude : -33.044167,
            lng: location ? location.longitude : -61.168056,
            foto_url: chofer.foto_url || null
          });
        }
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isOnline, activeTrip, socket]);

  // Si no está online, limpiamos la notificación
  useEffect(() => {
    if (!isOnline && incomingRide) {
      setIncomingRide(null);
    }
  }, [isOnline, incomingRide]);

  const responderComprobante = async (estado) => {
    if (!activeTrip) return;
    setValidandoComprobante(true);
    try {
      const res = await fetch(`${SOCKET_URL}/api/viajes/validar-comprobante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: activeTrip.id,
          chofer_id: chofer.id,
          estado
        })
      });
      const data = await res.json();
      if (data.success) {
        if (estado === 'aprobado') {
          setComprobanteAprobado(true);
          Alert.alert('✅ Comprobante Aprobado', 'Se notificó al pasajero. Ya puedes salir a buscarlo.');
        } else {
          setComprobanteAprobado(false);
          setComprobanteRecibido(null);
          Alert.alert('❌ Comprobante Rechazado', 'Se notificó al pasajero para que adjunte un comprobante válido.');
        }
      } else {
        Alert.alert('Error', data.error || 'No se pudo validar el comprobante');
      }
    } catch (e) {
      console.error('Error al responder comprobante:', e);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setValidandoComprobante(false);
    }
  };

  const aceptarViaje = async () => {
    if (!chofer.id || !incomingRide) return;

    try {
      const response = await fetch(`${SOCKET_URL}/api/viajes/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: incomingRide.id,
          chofer_id: chofer.id
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Éxito', '¡Viaje Aceptado! Dirígete al punto de partida.');
        setActiveTrip({
          ...data.viaje,
          metodo_pago: incomingRide.metodo_pago || data.viaje.metodo_pago,
          es_fuera_de_casilda: incomingRide.es_fuera_de_casilda || data.viaje.es_fuera_de_casilda,
          origen_direccion: incomingRide.origen_direccion || data.viaje.origen_direccion
        });
        setComprobanteRecibido(incomingRide.comprobante_url || null);
        setComprobanteAprobado(false);
        setConfirmadoJubilado(false); // Resetear confirmación
        setIsOnline(false); // Pasa a ocupado
      } else {
        Alert.alert('Error', 'Error al aceptar el viaje: ' + data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
    setIncomingRide(null);
  };

  const rechazarViaje = async () => {
    if (incomingRide && incomingRide.id && chofer.id) {
      try {
        await fetch(`${SOCKET_URL}/api/viajes/reject`, {
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
      const response = await fetch(`${SOCKET_URL}/api/viajes/start`, {
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
        Alert.alert('Error', 'No se pudo empezar el recorrido');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión');
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
            pasajero_id: activeTrip.usuario_id, // we might need this to filter on client
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
      try {
        if (esperaIntervalId) clearInterval(esperaIntervalId);
        const response = await fetch(`${SOCKET_URL}/api/viajes/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viaje_id: activeTrip.id,
            chofer_id: chofer.id,
            fin_lat: location ? location.latitude : -33.046,
            fin_lng: location ? location.longitude : -61.169,
            espera_minutos: minutosEspera
          })
        });
        const data = await response.json();
        if (data.success) {
          Alert.alert(
            'Viaje Finalizado', 
            `Distancia: ${data.viaje.distancia_km.toFixed(2)} km\nMonto a Cobrar: $${data.viaje.monto_calculado}\nComisión Base: $${data.viaje.comision_admin}`
          );
        }
      } catch (err) {
        console.error('Error al finalizar viaje:', err);
      }
      setActiveTrip(null);
      setEnEspera(false);
      setMinutosEspera(0);
      setEsperaIntervalId(null);
    }
    setIsOnline(!isOnline);
  };

  const finalizarViajeTelefonico = async () => {
    setViajeTelefonicoActivo(false);
    setIsOnline(true);

    const updatePayload = {
      chofer_id: chofer.id || 'sim-native',
      dni: chofer.dni || 'sim',
      numero_movil: chofer.numero_movil || '14',
      estado: 'libre',
      origen: 'chofer_self'
    };

    if (socket) {
      socket.emit('operator_set_driver_status', updatePayload);
      socket.emit('update_location', {
        chofer_id: chofer.id,
        dni: chofer.dni,
        isOnline: true,
        lat: location ? location.latitude : -33.044167,
        lng: location ? location.longitude : -61.168056,
        foto_url: chofer.foto_url || null
      });
    }

    try {
      await fetch(`${SOCKET_URL}/api/choferes/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
    } catch (e) {
      console.log('Error al actualizar estado:', e);
    }

    Alert.alert('✅ Viaje Finalizado', 'Viaje telefónico concluido con éxito.\nYa te encuentras LIBRE para nuevos viajes.');
  };

  const handleRequestManualClose = async () => {
    if (!activeTrip) return;
    try {
      const response = await fetch(`${SOCKET_URL}/api/viajes/request-manual-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viaje_id: activeTrip.id })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Solicitud enviada', 'Esperando que el operador fije el monto...');
        setActiveTrip({ ...activeTrip, requiere_cierre_manual: true });
      } else {
        Alert.alert('Error', data.error || 'No se pudo solicitar el cierre manual');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleRideFinished = (data) => {
      if (activeTrip && activeTrip.id === data.viaje_id) {
        Alert.alert('Viaje Finalizado (Operador)', `Monto fijado: $${data.monto}`);
        setActiveTrip(null);
        setEnEspera(false);
        setMinutosEspera(0);
        if (esperaIntervalId) clearInterval(esperaIntervalId);
        setEsperaIntervalId(null);
        setIsOnline(true);
      }
    };
    socket.on('ride_finished', handleRideFinished);
    return () => socket.off('ride_finished', handleRideFinished);
  }, [socket, activeTrip, esperaIntervalId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: -33.044167, 
          longitude: -61.168056,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Mi Taxi Alberdi"
            description={`Móvil #${chofer.numero_movil || '14'}`}
          />
        )}
      </MapView>

      {/* Notificación de Nuevo Viaje */}
      {incomingRide && isOnline && (
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
            {incomingRide.origen_direccion ? (
              <Text style={[styles.notificationText, { color: '#38bdf8', fontWeight: 'bold' }]}>
                📍 Origen: {incomingRide.origen_direccion}
              </Text>
            ) : null}
            <Text style={[styles.notificationText, { color: theme.text }]}>
              Coordenadas: {incomingRide.origen_lat}, {incomingRide.origen_lng}
            </Text>

            {/* Aviso especial para Viaje Fuera de Casilda / Pago */}
            {incomingRide.es_fuera_de_casilda && (
              <View style={{
                backgroundColor: incomingRide.metodo_pago === 'transferencia' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(234, 179, 8, 0.18)',
                borderWidth: 1.5,
                borderColor: incomingRide.metodo_pago === 'transferencia' ? '#10b981' : '#eab308',
                padding: 10,
                borderRadius: 12,
                marginVertical: 8,
                width: '100%',
                alignItems: 'center'
              }}>
                <Text style={{
                  color: incomingRide.metodo_pago === 'transferencia' ? '#34d399' : '#facc15',
                  fontWeight: '800',
                  fontSize: 13,
                  textAlign: 'center'
                }}>
                  {incomingRide.metodo_pago === 'transferencia'
                    ? '💳 VIAJE INTERURBANO: PAGO POR TRANSFERENCIA'
                    : '💵 VIAJE INTERURBANO: PAGO EN EFECTIVO'}
                </Text>
                <Text style={{ color: '#e2e8f0', fontSize: 11, textAlign: 'center', marginTop: 3 }}>
                  {incomingRide.metodo_pago === 'transferencia'
                    ? 'El pasajero adjuntará el comprobante en su app para que lo verifiques antes de salir.'
                    : 'El pasajero confirmó su espera en el lugar y abonará en mano.'}
                </Text>
              </View>
            )}

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
          shadowColor: viajeTelefonicoActivo ? '#f59e0b' : (isOnline ? '#10b981' : '#ef4444'),
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 8,
        }
      ]}>
        <View style={[
          styles.statusIndicator, 
          { 
            backgroundColor: viajeTelefonicoActivo ? '#f59e0b' : (isOnline ? '#10b981' : '#ef4444'),
            shadowColor: isOnline ? '#10b981' : '#ef4444',
            shadowOpacity: 0.8,
            shadowRadius: 6,
            elevation: 4,
          }
        ]} />
        <Text style={[styles.statusText, { color: '#f8fafc' }]}>
          {viajeTelefonicoActivo 
            ? 'VIAJE TELEFÓNICO EN CURSO' 
            : (isOnline ? 'EN LÍNEA • DISPONIBLE PARA VIAJES' : 'FUERA DE SERVICIO • EN PAUSA')}
        </Text>
      </View>

      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, paddingBottom: Math.max(insets.bottom + 20, 48) }]}>
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
              style={[styles.button, { backgroundColor: '#10b981', width: '100%', shadowColor: '#10b981', shadowOpacity: 0.45, elevation: 6 }]}
              onPress={finalizarViajeTelefonico}
            >
              <Text style={styles.buttonText}>✓ Finalizar Viaje y Ponerme Libre</Text>
            </TouchableOpacity>
          </View>
        ) : activeTrip && activeTrip.estado !== 'en_viaje' ? (
          <>
            {/* Control de Comprobante / Pago Anticipado */}
            {activeTrip.metodo_pago === 'transferencia' && (
              <View style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderWidth: 1.5,
                borderColor: comprobanteAprobado ? '#10b981' : (comprobanteRecibido ? '#eab308' : 'rgba(56, 189, 248, 0.4)'),
                padding: 14,
                borderRadius: 16,
                marginBottom: 12,
                gap: 10
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#38bdf8', fontWeight: '800', fontSize: 13 }}>
                    💳 COMPROBANTE DE TRANSFERENCIA
                  </Text>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: comprobanteAprobado ? 'rgba(16, 185, 129, 0.2)' : (comprobanteRecibido ? 'rgba(234, 179, 8, 0.2)' : 'rgba(56, 189, 248, 0.15)')
                  }}>
                    <Text style={{
                      color: comprobanteAprobado ? '#10b981' : (comprobanteRecibido ? '#facc15' : '#38bdf8'),
                      fontWeight: '800',
                      fontSize: 11
                    }}>
                      {comprobanteAprobado ? '✓ Aprobado' : (comprobanteRecibido ? '📄 Recibido' : 'Esperando')}
                    </Text>
                  </View>
                </View>

                {comprobanteRecibido ? (
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity 
                      style={{ width: '100%', alignItems: 'center' }}
                      onPress={() => setModalVerComprobante(true)}
                    >
                      <Image 
                        source={{ uri: comprobanteRecibido }} 
                        style={{ width: '100%', height: 110, borderRadius: 10, resizeMode: 'cover' }} 
                      />
                      <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                        🔍 Toca para ampliar comprobante
                      </Text>
                    </TouchableOpacity>

                    {comprobanteAprobado ? (
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: 10, width: '100%' }}>
                        <Text style={{ color: '#34d399', fontWeight: '800', textAlign: 'center', fontSize: 13 }}>
                          ✓ Pago Verificado con Éxito
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                          onPress={() => responderComprobante('rechazado')}
                          disabled={validandoComprobante}
                        >
                          <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 13 }}>✕ Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 2, backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                          onPress={() => responderComprobante('aprobado')}
                          disabled={validandoComprobante}
                        >
                          {validandoComprobante ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>✅ Validar y Salir</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                    <Text style={{ color: '#facc15', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                      ⏳ El pasajero está realizando la transferencia y adjuntará la captura en la app...
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeTrip.metodo_pago === 'efectivo' && activeTrip.es_fuera_de_casilda && (
              <View style={{
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(56, 189, 248, 0.35)',
                padding: 10,
                borderRadius: 12,
                marginBottom: 10
              }}>
                <Text style={{ color: '#38bdf8', fontWeight: '800', fontSize: 12, textAlign: 'center' }}>
                  💵 PAGO EN EFECTIVO (FUERA DE CASILDA)
                </Text>
                <Text style={{ color: '#cbd5e1', fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                  El pasajero confirmó su espera en el lugar y abonará en mano.
                </Text>
              </View>
            )}

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
                  shadowColor: '#3b82f6',
                  shadowOpacity: 0.45,
                  elevation: 5
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
                style={[styles.button, { backgroundColor: enEspera ? '#f59e0b' : '#3b82f6', marginBottom: 12, shadowColor: enEspera ? '#f59e0b' : '#3b82f6', shadowOpacity: 0.4, elevation: 5 }]}
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
                  shadowColor: isOnline ? '#ef4444' : (activeTrip ? '#ef4444' : '#10b981'),
                  shadowOpacity: 0.45,
                  elevation: 6
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

      {/* Modal para ver Comprobante en Grande */}
      <Modal visible={modalVerComprobante} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#0f172a', borderRadius: 20, padding: 18, alignItems: 'center', borderWidth: 1.5, borderColor: '#10b981' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 }}>
              <Text style={{ color: '#f8fafc', fontWeight: '800', fontSize: 16 }}>📄 Comprobante de Transferencia</Text>
              <TouchableOpacity 
                style={{ padding: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)' }}
                onPress={() => setModalVerComprobante(false)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: 'bold', paddingHorizontal: 6 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {comprobanteRecibido && (
              <Image 
                source={{ uri: comprobanteRecibido }} 
                style={{ width: '100%', height: 380, borderRadius: 12, resizeMode: 'contain' }} 
              />
            )}

            <TouchableOpacity 
              style={{ marginTop: 16, backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center' }}
              onPress={() => setModalVerComprobante(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Cerrar Vista</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  map: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingTop: 14,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(16, 185, 129, 0.45)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
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
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1.5,
    borderColor: '#10b981',
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
  },
  btnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  }
});
