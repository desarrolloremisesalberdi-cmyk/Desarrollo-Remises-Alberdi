import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, Image, TextInput, ActivityIndicator, Vibration, Alert } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { io } from 'socket.io-client';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route, navigation }) {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  const [choferAsignado, setChoferAsignado] = useState(null);

  const [origenTexto, setOrigenTexto] = useState('');
  const [destinoTexto, setDestinoTexto] = useState('');
  
  // Recibir usuario
  const user = route?.params?.user || { id: 1, nombre: 'Pasajero' };

  // Fórmula de Haversine para calcular distancia en km
  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  const geocodeAddress = async (address) => {
    const query = encodeURIComponent(`${address}, Casilda, Santa Fe, Argentina`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  };

  const pedirTaxi = async () => {
    if (!origenTexto || !destinoTexto) {
      Alert.alert('Por favor', 'Ingresa dónde estás y a dónde vas');
      return;
    }
    
    setSolicitando(true);
    
    try {
      const coordsOrigen = await geocodeAddress(origenTexto);
      const coordsDestino = await geocodeAddress(destinoTexto);
      
      if (!coordsOrigen || !coordsDestino) {
        Alert.alert('Error', 'No se pudieron encontrar las calles. Intenta ser más específico.');
        setSolicitando(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/viajes/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          origen_lat: coordsOrigen.lat,
          origen_lng: coordsOrigen.lng,
          destino_lat: coordsDestino.lat,
          destino_lng: coordsDestino.lng
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setEstadoViaje('Buscando móvil cercano...');
      } else {
        Alert.alert('Error', 'No se pudo solicitar el viaje');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSolicitando(false);
    }
  };

  useEffect(() => {
    socket.on('ride_accepted', (data) => {
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`¡${data.chofer.nombre} está en camino!\nMóvil #${data.chofer.numero_movil}`);
        setChoferAsignado(data.chofer);
        Vibration.vibrate(500);
      }
    });

    socket.on('ride_started', (data) => {
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`🚘 ¡En viaje! Que disfrutes tu recorrido.`);
        Vibration.vibrate([0, 200, 100, 200]);
      }
    });

    socket.on('ride_finished', (data) => {
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`✅ Viaje finalizado.\nDistancia: ${data.distancia.toFixed(2)} km\n\n💰 Total a pagar: $${data.monto}`);
        Vibration.vibrate(1000);
      }
    });

    return () => {
      socket.off('ride_accepted');
      socket.off('ride_started');
      socket.off('ride_finished');
    };
  }, [user.id]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 15, padding: 8, backgroundColor: '#ef4444', borderRadius: 6 }} 
          onPress={() => navigation.replace('Login')}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      )
    });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Mapa usando OpenStreetMap para ser 100% gratuito */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -33.044167, // Coordenadas de Casilda, Santa Fe
          longitude: -61.168056,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        mapType="none" // Para que no cargue Google Maps/Apple Maps por defecto
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
      </MapView>

      {estadoViaje && (
        <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {choferAsignado && choferAsignado.foto_url && (
            <Image 
              source={{ uri: choferAsignado.foto_url }} 
              style={{ width: 60, height: 60, borderRadius: 30, alignSelf: 'center', marginBottom: 10, borderWidth: 2, borderColor: theme.accent }}
            />
          )}
          <Text style={[styles.statusText, { color: theme.accent }]}>{estadoViaje}</Text>
        </View>
      )}
      
      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        {!estadoViaje && (
          <View style={{ marginBottom: 15 }}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="¿Dónde estás? (Ej: Lisandro 1500)"
              placeholderTextColor="#888"
              value={origenTexto}
              onChangeText={setOrigenTexto}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
              placeholder="¿A dónde vas? (Ej: Sarmiento 2000)"
              placeholderTextColor="#888"
              value={destinoTexto}
              onChangeText={setDestinoTexto}
            />
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.accent, marginTop: 10 }]} 
              onPress={pedirTaxi}
              disabled={solicitando}
            >
              {solicitando ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pedir Taxi Ahora</Text>}
            </TouchableOpacity>
          </View>
        )}

        {estadoViaje && (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: estadoViaje.includes('finalizado') ? '#3b82f6' : '#10b981'}]} 
            onPress={() => {
              if (estadoViaje.includes('finalizado')) {
                setEstadoViaje(null);
                setChoferAsignado(null);
                setOrigenTexto('');
                setDestinoTexto('');
              }
            }}
          >
            <Text style={styles.buttonText}>
              {estadoViaje.includes('finalizado') ? 'Pedir otro viaje' : 'Taxi Solicitado ✓'}
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
  accent: '#10b981', // Verde Esmeralda (Cliente)
};

const lightTheme = {
  bg: '#f1f5f9',
  cardBg: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(0, 0, 0, 0.1)',
  text: '#0f172a',
  accent: '#10b981',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 25,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    borderTopWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  statusCard: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 15,
  },
  estimateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  estimateText: {
    fontSize: 15,
    fontWeight: '600',
  },
  estimatePrice: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
