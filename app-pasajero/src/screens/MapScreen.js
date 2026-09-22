import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';

export default function MapScreen({ route, navigation }) {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);

  const pedirTaxi = () => {
    setSolicitando(true);
    setTimeout(() => {
      setEstadoViaje('¡Un chofer aceptó tu viaje y está en camino!');
      setSolicitando(false);
    }, 3000);
  };

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
          <Text style={[styles.statusText, { color: theme.accent }]}>{estadoViaje}</Text>
        </View>
      )}
      
      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>¿A dónde vas?</Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={pedirTaxi}
          disabled={solicitando}
        >
          <Text style={styles.buttonText}>{solicitando ? 'Solicitando...' : 'Pedir Taxi Ahora'}</Text>
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
  }
});
