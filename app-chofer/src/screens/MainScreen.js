import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import MapView, { UrlTile, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://taxis-alberdi-backend.onrender.com';

export default function MainScreen({ route, navigation }) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [location, setLocation] = useState(null);
  const [socket, setSocket] = useState(null);
  const [incomingRide, setIncomingRide] = useState(null);
  
  // En React Native (sin web) simularemos un chofer si no viene por params
  const chofer = route?.params?.chofer || { id: 'sim-native', dni: 'sim' };

  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('new_ride_request', (viaje) => {
      // Check if online before setting incoming ride
      setIncomingRide(prev => {
        // Can't check state directly inside without dependency, but we can set it
        return viaje;
      });
    });

    return () => {
      newSocket.off('new_ride_request');
      newSocket.disconnect();
    };
  }, []);

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
            onPress={() => navigation.replace('Login')}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, chofer, theme]);

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

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setLocation({ latitude, longitude });
            if (socket && chofer) {
              socket.emit('update_location', {
                chofer_id: chofer.id,
                dni: chofer.dni,
                isOnline: isOnline,
                lat: latitude,
                lng: longitude,
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
        setActiveTrip(data.viaje);
        setIsOnline(false); // Pasa a ocupado
      } else {
        Alert.alert('Error', 'Error al aceptar el viaje: ' + data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
    setIncomingRide(null);
  };

  const rechazarViaje = () => {
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

  const handleToggleStatus = async () => {
    if (!isOnline && activeTrip && activeTrip.estado === 'en_viaje') {
      try {
        const response = await fetch(`${SOCKET_URL}/api/viajes/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viaje_id: activeTrip.id,
            chofer_id: chofer.id,
            fin_lat: location ? location.latitude : -33.046,
            fin_lng: location ? location.longitude : -61.169
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
    }
    setIsOnline(!isOnline);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -33.044167, 
          longitude: -61.168056,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        region={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : undefined}
        mapType="none"
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Mi Ubicación"
            pinColor="blue"
          />
        )}
      </MapView>

      {/* Notificación de Nuevo Viaje */}
      {incomingRide && isOnline && (
        <View style={styles.notificationOverlay}>
          <View style={[styles.notificationCard, { backgroundColor: theme.cardBg, borderColor: theme.accent }]}>
            <Text style={[styles.notificationTitle, { color: theme.accent }]}>🚕 ¡NUEVO VIAJE!</Text>
            <Text style={[styles.notificationText, { color: theme.text }]}>ID Viaje: #{incomingRide.id || 'N/A'}</Text>
            <Text style={[styles.notificationText, { color: theme.text }]}>
              Se requiere un móvil en las coordenadas: {incomingRide.origen_lat}, {incomingRide.origen_lng}
            </Text>
            
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
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#3b82f6' }]}
            onPress={empezarRecorrido}
          >
            <Text style={styles.buttonText}>Empezar Recorrido</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: isOnline ? '#ef4444' : (activeTrip ? '#ef4444' : '#10b981') }]}
            onPress={handleToggleStatus}
          >
            <Text style={styles.buttonText}>
              {activeTrip ? 'Finalizar Viaje' : (isOnline ? 'Pasar a Ocupado / Fuera de servicio' : 'Pasar a Libre (Comenzar a recibir viajes)')}
            </Text>
          </TouchableOpacity>
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
  map: {
    ...StyleSheet.absoluteFillObject,
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
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginRight: 10,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center'
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
    color: '#fff',
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
