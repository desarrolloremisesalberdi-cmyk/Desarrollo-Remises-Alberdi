import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';

export default function MainScreen({ route, navigation }) {
  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  
  // En React Native (sin web) simularemos un chofer si no viene por params
  const chofer = route?.params?.chofer || { id: 'sim-native' };

  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

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

  const handleToggleStatus = async () => {
    if (!isOnline && activeTrip) {
      // Simulación en Native. Debería venir de tu backend.
      // (Aquí luego agregaremos fetch() real cuando integremos Socket.IO en native)
      alert("Viaje Finalizado (Simulado en Native)");
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
        mapType="none"
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
      </MapView>
      
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
        <Text style={[styles.statusText, { color: theme.text }]}>{isOnline ? 'ESTÁS LIBRE (VERDE)' : 'ESTÁS OCUPADO/INACTIVO (ROJO)'}</Text>
      </View>

      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Recaudación Hoy: $0</Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: isOnline ? '#ef4444' : '#10b981' }]}
          onPress={handleToggleStatus}
        >
          <Text style={styles.buttonText}>{isOnline ? 'Pasar a Ocupado / Fuera de servicio' : 'Pasar a Libre (Comenzar a recibir viajes)'}</Text>
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
  }
});
