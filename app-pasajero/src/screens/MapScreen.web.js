import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route, navigation }) {
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  
  // Recibir el usuario desde el Login (si existe)
  const user = route?.params?.user || { id: null, nombre: 'Invitado' };

  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    socket.on('ride_accepted', (data) => {
      // Si el viaje aceptado corresponde a este pasajero
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`¡El chofer ${data.chofer.nombre} ${data.chofer.apellido} está en camino!\nMóvil #${data.chofer.numero_movil} - ${data.chofer.vehiculo_modelo} (Patente: ${data.chofer.vehiculo_patente})`);
      }
    });

    return () => {
      socket.off('ride_accepted');
    };
  }, [user.id]);

  const pedirTaxi = async () => {
    if (!user.id) {
      alert('Error: No estás logueado en la base de datos.');
      return;
    }
    
    setSolicitando(true);
    
    try {
      const response = await fetch(`${API_URL}/api/viajes/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          origen_lat: -33.044167,
          origen_lng: -61.168056,
          destino_lat: -33.05,
          destino_lng: -61.17
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
  const handleLogout = () => {
    localStorage.removeItem('pasajero_user');
    navigation.replace('Login');
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
            <Text style={[styles.statusText, { color: theme.accent }]}>{estadoViaje}</Text>
          </View>
        )}
        
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={handleLogout}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>¿A dónde vas, {user.nombre}?</Text>
        <TouchableOpacity 
          style={[styles.button, estadoViaje ? { backgroundColor: '#10b981'} : { backgroundColor: theme.accent }]} 
          onPress={pedirTaxi}
          disabled={solicitando || estadoViaje}
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
  logoutBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
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
  }
});
