import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route }) {
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  
  // Recibir el usuario desde el Login (si existe)
  const user = route?.params?.user || { id: null, nombre: 'Invitado' };

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
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <iframe 
          title="Mapa de Casilda"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-61.19,-33.06,-61.14,-33.02&layer=mapnik"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
        {estadoViaje && (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{estadoViaje}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.bottomCard}>
        <Text style={styles.title}>¿A dónde vas, {user.nombre}?</Text>
        <TouchableOpacity 
          style={[styles.button, estadoViaje ? { backgroundColor: '#28a745'} : {}]} 
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    fontWeight: '500',
  },
  statusCard: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 22, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#39ff14',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
  },
  statusText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#39ff14',
    textAlign: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(20, 20, 22, 0.95)',
    padding: 25,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#39ff14',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(57, 255, 20, 0.2)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    color: '#fff',
  },
  subtitle: {
    fontSize: 15,
    color: '#ccc',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#39ff14',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#39ff14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});
