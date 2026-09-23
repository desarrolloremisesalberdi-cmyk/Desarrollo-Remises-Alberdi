import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, TextInput, ActivityIndicator } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route, navigation }) {
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  const [choferAsignado, setChoferAsignado] = useState(null);
  
  const [origenTexto, setOrigenTexto] = useState('');
  const [destinoTexto, setDestinoTexto] = useState('');
  const [calculando, setCalculando] = useState(false);
  const [datosViaje, setDatosViaje] = useState(null);

  // Recibir el usuario desde el Login (si existe)
  const user = route?.params?.user || { id: null, nombre: 'Invitado' };

  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    socket.on('ride_accepted', (data) => {
      // Si el viaje aceptado corresponde a este pasajero
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`¡El chofer ${data.chofer.nombre} ${data.chofer.apellido} está en camino!\nMóvil #${data.chofer.numero_movil} - ${data.chofer.vehiculo_modelo} (Patente: ${data.chofer.vehiculo_patente})`);
        setChoferAsignado(data.chofer);
        try {
          const audio = new window.Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play();
        } catch (e) {
          console.log('Audio error:', e);
        }
      }
    });

    return () => {
      socket.off('ride_accepted');
    };
  }, [user.id]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 15, padding: 8, backgroundColor: '#ef4444', borderRadius: 6 }} 
          onPress={() => {
            if(window.localStorage) window.localStorage.removeItem('pasajero_user');
            navigation.replace('Login');
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      )
    });
  }, [navigation]);

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
    // Agregamos Casilda por defecto para mayor precisión
    const query = encodeURIComponent(`${address}, Casilda, Santa Fe, Argentina`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  };

  const calcularViaje = async () => {
    if (!origenTexto || !destinoTexto) {
      alert('Por favor ingresa origen y destino');
      return;
    }
    setCalculando(true);
    try {
      const coordsOrigen = await geocodeAddress(origenTexto);
      const coordsDestino = await geocodeAddress(destinoTexto);
      
      if (!coordsOrigen || !coordsDestino) {
        alert('No se pudieron encontrar las calles. Intenta ser más específico.');
        setCalculando(false);
        return;
      }
      
      const dist = calcularDistancia(coordsOrigen.lat, coordsOrigen.lng, coordsDestino.lat, coordsDestino.lng);
      // Precio mock: $500 bajada + $50 por cada 100 metros ($500 por km)
      const precio = 500 + (dist * 500);
      
      setDatosViaje({
        origen: coordsOrigen,
        destino: coordsDestino,
        distancia: dist.toFixed(2),
        precio: precio.toFixed(0)
      });
    } catch (e) {
      alert('Error calculando ruta');
    }
    setCalculando(false);
  };

  const pedirTaxi = async () => {
    if (!user.id) {
      alert('Error: No estás logueado en la base de datos.');
      return;
    }
    if (!datosViaje) {
      alert('Primero calcula el viaje.');
      return;
    }
    
    setSolicitando(true);
    
    try {
      const response = await fetch(`${API_URL}/api/viajes/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          origen_lat: datosViaje.origen.lat,
          origen_lng: datosViaje.origen.lng,
          destino_lat: datosViaje.destino.lat,
          destino_lng: datosViaje.destino.lng
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setEstadoViaje('¡Viaje solicitado! Esperando a que un chofer acepte...');
        // También enviamos un aviso extra directo por socket
        socket.emit('request_ride_direct', data.viaje);
      } else {
        alert('Error al solicitar viaje');
      }
    } catch (error) {
      alert('Error de conexión con el servidor');
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.mapPlaceholder, { backgroundColor: theme.cardBg }]}>
        <iframe 
          title="Mapa de Casilda"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-61.19,-33.06,-61.14,-33.02&layer=mapnik"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
        {estadoViaje && (
          <View style={[styles.statusCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {choferAsignado && choferAsignado.foto_url && (
              <img 
                src={choferAsignado.foto_url} 
                alt="Chofer" 
                style={{ width: 60, height: 60, borderRadius: '50%', alignSelf: 'center', marginBottom: 10, borderWidth: 2, borderColor: theme.accent }}
              />
            )}
            <Text style={[styles.statusText, { color: theme.accent }]}>{estadoViaje}</Text>
          </View>
        )}
      </View>
      
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
            
            {datosViaje && (
              <View style={styles.estimateContainer}>
                <Text style={[styles.estimateText, { color: theme.text }]}>Distancia: {datosViaje.distancia} km</Text>
                <Text style={[styles.estimatePrice, { color: theme.accent }]}>Costo Est: ${datosViaje.precio}</Text>
              </View>
            )}
            
            {!datosViaje ? (
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: '#3b82f6', marginBottom: 10 }]} 
                onPress={calcularViaje}
                disabled={calculando}
              >
                {calculando ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Calcular Costo</Text>}
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, estadoViaje ? { backgroundColor: '#10b981'} : (!datosViaje ? {backgroundColor: '#ccc'} : { backgroundColor: theme.accent })]} 
          onPress={pedirTaxi}
          disabled={solicitando || estadoViaje || !datosViaje}
        >
          <Text style={styles.buttonText}>
            {solicitando ? 'Buscando...' : estadoViaje ? 'Taxi Solicitado ✓' : 'Pedir Taxi Ahora'}
          </Text>
        </TouchableOpacity>
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
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#10b981',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
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
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -0.5,
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
