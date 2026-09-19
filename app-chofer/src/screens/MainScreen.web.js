import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000';
const socket = io(API_URL);

export default function MainScreen({ route }) {
  const [isOnline, setIsOnline] = useState(true); // Lo ponemos true por defecto para pruebas
  const [incomingRide, setIncomingRide] = useState(null);

  // Recibimos los datos del chofer por parámetros de navegación
  const chofer = route?.params?.chofer || { id: null, nombre: 'Prueba' };

  useEffect(() => {
    // Escuchar solicitudes de viaje nuevas
    socket.on('new_ride_request', (viaje) => {
      // Solo notificar si el chofer está online
      if (isOnline) {
        setIncomingRide(viaje);
      }
    });

    return () => {
      socket.off('new_ride_request');
    };
  }, [isOnline]);

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

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>🗺️ El mapa del chofer está disponible en la app nativa (Celular).</Text>
      </View>
      
      {/* Notificación de Nuevo Viaje */}
      {incomingRide && (
        <View style={styles.notificationOverlay}>
          <View style={styles.notificationCard}>
            <Text style={styles.notificationTitle}>🚕 ¡NUEVO VIAJE!</Text>
            <Text style={styles.notificationText}>ID Viaje: #{incomingRide.id || 'N/A'}</Text>
            <Text style={styles.notificationText}>
              Se requiere un móvil en las coordenadas: {incomingRide.origen_lat}, {incomingRide.origen_lng}
            </Text>
            
            <View style={styles.notificationActions}>
              <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#dc3545'}]} onPress={rechazarViaje}>
                <Text style={styles.btnText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, {backgroundColor: '#28a745'}]} onPress={aceptarViaje}>
                <Text style={styles.btnText}>¡ACEPTAR!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#28a745' : '#dc3545' }]} />
        <Text style={styles.statusText}>{isOnline ? 'ESTÁS LIBRE (VERDE)' : 'ESTÁS OCUPADO/INACTIVO (ROJO)'}</Text>
      </View>

      <View style={styles.bottomCard}>
        <Text style={styles.title}>Recaudación Hoy: $0</Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: isOnline ? '#dc3545' : '#28a745' }]}
          onPress={() => setIsOnline(!isOnline)}
        >
          <Text style={styles.buttonText}>{isOnline ? 'Pasar a Ocupado / Fuera de servicio' : 'Pasar a Libre (Comenzar a recibir viajes)'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#e9ecef',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    borderColor: 'rgba(0,0,0,0.05)',
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
    color: '#374151',
    letterSpacing: 0.3,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'white',
    padding: 25,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827',
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
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  notificationCard: {
    backgroundColor: 'white',
    padding: 35,
    borderRadius: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  notificationTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 15,
  },
  notificationText: {
    fontSize: 16,
    color: '#4b5563',
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
