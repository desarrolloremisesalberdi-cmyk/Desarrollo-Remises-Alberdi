import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, Image, TextInput, ActivityIndicator, Vibration, Alert, Modal, ScrollView } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { io } from 'socket.io-client';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route, navigation }) {
  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  const [choferAsignado, setChoferAsignado] = useState(null);
  const [mensajeEspera, setMensajeEspera] = useState(null);
  
  const [modalLargaDistancia, setModalLargaDistancia] = useState(false);
  const [destinosFijos, setDestinosFijos] = useState([]);
  const [tarifas, setTarifas] = useState(null);
  const [minutosEsperaSimulados, setMinutosEsperaSimulados] = useState('');
  
  const [coordsOrigenSim, setCoordsOrigenSim] = useState(null);
  const [coordsDestinoSim, setCoordsDestinoSim] = useState(null);
  
  const [modalCostos, setModalCostos] = useState(false);

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

  const calcularCostoSimulado = () => {
    const origen = coordsOrigenSim || coordsOrigen;
    const destino = coordsDestinoSim || coordsDestino;
    if (!tarifas || !origen || !destino) return 0;
    
    const CASILDA_LAT = -33.044167;
    const CASILDA_LNG = -61.168056;
    const distDesdeCasilda = calcularDistancia(origen.lat, origen.lng, CASILDA_LAT, CASILDA_LNG);
    const distViaje = calcularDistancia(origen.lat, origen.lng, destino.lat, destino.lng) * 1.3;
    
    const bajada = parseFloat(tarifas.bajada_bandera_diurna) || 0;
    const espera = parseInt(minutosEsperaSimulados) || 0;
    const costoEspera = (espera / 60) * (parseFloat(tarifas.precio_espera_hora) || 0);
    
    let costoDistancia = 0;
    if (distDesdeCasilda > 15 || distViaje > 15) {
      const precioKmExtra = parseFloat(tarifas.precio_km_extra) || 1100;
      costoDistancia = precioKmExtra * distViaje;
    } else {
      const precio100 = parseFloat(tarifas.precio_100m_diurna) || 0;
      costoDistancia = precio100 * (distViaje * 10);
    }
    
    return Math.round(bajada + costoDistancia + costoEspera);
  };

  // Google Places Autocomplete handle
  const [coordsOrigen, setCoordsOrigen] = useState(null);
  const [coordsDestino, setCoordsDestino] = useState(null);

  const pedirTaxi = async () => {
    if (!coordsOrigen || !coordsDestino) {
      Alert.alert('Por favor', 'Busca y selecciona un origen y destino en la lista');
      return;
    }
    
    setSolicitando(true);
    
    try {

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

  const pedirLargaDistancia = async (destinoFijo) => {
    if (!coordsOrigen) {
      Alert.alert('Error', 'Por favor, selecciona tu punto de partida (¿Dónde estás?) antes de continuar.');
      return;
    }
    setModalLargaDistancia(false);
    setSolicitando(true);
    try {
      const response = await fetch(`${API_URL}/api/viajes/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: user.id,
          origen_lat: coordsOrigen.lat,
          origen_lng: coordsOrigen.lng,
          destino_lat: 0,
          destino_lng: 0,
          destino_fijo_id: destinoFijo.id,
          costo_fijo: destinoFijo.precio
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEstadoViaje('Buscando móvil cercano (Larga Distancia)...');
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
    const fetchDestinosFijos = async () => {
      try {
        const response = await fetch(`${API_URL}/api/destinos_fijos`);
        const data = await response.json();
        if (data.success) setDestinosFijos(data.destinos);
      } catch (e) {
        console.log(e);
      }
    };
    fetchDestinosFijos();

    const fetchTarifas = async () => {
      try {
        const response = await fetch(`${API_URL}/api/tarifas`);
        const data = await response.json();
        if (data.success) setTarifas(data.tarifas);
      } catch (e) {
        console.log(e);
      }
    };
    fetchTarifas();

    socket.on('ride_accepted', (data) => {
      if (data.pasajero_id === user.id) {
        setEstadoViaje(`¡${data.chofer.nombre} está en camino!\nMóvil #${data.chofer.numero_movil}`);
        setChoferAsignado(data.chofer);
        Vibration.vibrate(500);
        
        let requierePagoAnticipado = false;
        if (data.viaje && data.viaje.costo_fijo) {
          requierePagoAnticipado = true;
        } else if (data.viaje && data.viaje.origen_lat && data.viaje.origen_lng) {
          const CASILDA_LAT = -33.044167;
          const CASILDA_LNG = -61.168056;
          const dist = calcularDistancia(data.viaje.origen_lat, data.viaje.origen_lng, CASILDA_LAT, CASILDA_LNG);
          if (dist > 15) { // Más de 15km de Casilda
            requierePagoAnticipado = true;
          }
        }

        if (requierePagoAnticipado && data.chofer.datos_pago) {
          Alert.alert(
            'Pago Anticipado Requerido',
            `Como tu viaje es de larga distancia o fuera de la ciudad, se requiere pago anticipado.\nPor favor transfiere al Alias del chofer: ${data.chofer.datos_pago} y envía el comprobante por WhatsApp al operador.`
          );
        }
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
        setMensajeEspera(null);
        Vibration.vibrate(1000);
      }
    });

    socket.on('toggle_espera', (data) => {
      if (data.pasajero_id === user.id) {
        if (data.en_espera) {
          setMensajeEspera(`El chofer está en espera... (${data.minutos} min)`);
        } else {
          setMensajeEspera(null);
        }
      }
    });

    return () => {
      socket.off('ride_accepted');
      socket.off('ride_started');
      socket.off('ride_finished');
      socket.off('toggle_espera');
    };
  }, [user.id]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 15 }}>
          <TouchableOpacity 
            style={{ marginRight: 10, padding: 8, backgroundColor: '#3b82f6', borderRadius: 6 }} 
            onPress={() => setModalCostos(true)}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Costos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ padding: 8, backgroundColor: '#ef4444', borderRadius: 6 }} 
            onPress={() => navigation.replace('Login')}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Mapa Nativo (Google Maps / Apple Maps) */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -33.044167,
          longitude: -61.168056,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {coordsOrigen && <Marker coordinate={{ latitude: coordsOrigen.lat, longitude: coordsOrigen.lng }} title="Origen" pinColor="blue" />}
        {coordsDestino && <Marker coordinate={{ latitude: coordsDestino.lat, longitude: coordsDestino.lng }} title="Destino" pinColor="red" />}
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
          {mensajeEspera && (
            <Text style={{ marginTop: 10, color: '#f59e0b', fontWeight: 'bold', textAlign: 'center' }}>
              ⏳ {mensajeEspera}
            </Text>
          )}
        </View>
      )}
      
      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        {!estadoViaje && (
          <View style={{ marginBottom: 15, zIndex: 10 }}>
            <View style={{ zIndex: 20, marginBottom: 10 }}>
              <GooglePlacesAutocomplete
                placeholder="¿Dónde estás?"
                fetchDetails={true}
                onPress={(data, details = null) => {
                  setOrigenTexto(data.description);
                  setCoordsOrigen({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                }}
                query={{
                  key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                  language: 'es',
                  components: 'country:ar',
                }}
                styles={googlePlacesStyles}
              />
            </View>
            <View style={{ zIndex: 10, marginBottom: 10 }}>
              <GooglePlacesAutocomplete
                placeholder="¿A dónde vas?"
                fetchDetails={true}
                onPress={(data, details = null) => {
                  setDestinoTexto(data.description);
                  setCoordsDestino({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                }}
                query={{
                  key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                  language: 'es',
                  components: 'country:ar',
                }}
                styles={googlePlacesStyles}
              />
            </View>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: theme.accent, marginTop: 10 }]} 
              onPress={pedirTaxi}
              disabled={solicitando}
            >
              {solicitando ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pedir Taxi Ahora</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#4f46e5', marginTop: 10 }]} 
              onPress={() => setModalLargaDistancia(true)}
              disabled={solicitando}
            >
              <Text style={styles.buttonText}>Simular Costos / Larga Distancia</Text>
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

      <Modal
        visible={modalLargaDistancia}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalLargaDistancia(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: theme.cardBg, borderRadius: 12, padding: 20, maxHeight: '90%' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 15, textAlign: 'center' }}>Simulador / Destinos</Text>
            
            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 10, marginBottom: 20 }}>
              <Text style={{ color: theme.text, fontWeight: 'bold', marginBottom: 10 }}>Simular un viaje personalizado</Text>
              
              <View style={{ zIndex: 30, marginBottom: 10 }}>
                <GooglePlacesAutocomplete
                  placeholder="Origen de simulación"
                  fetchDetails={true}
                  onPress={(data, details = null) => {
                    setCoordsOrigenSim({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                  }}
                  query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: 'es', components: 'country:ar' }}
                  requestUrl={{ url: 'https://desarrollo-remises-alberdi.onrender.com/api/maps', useOnPlatform: 'native' }}
                  styles={{...googlePlacesStyles, textInput: {...googlePlacesStyles.textInput, height: 40}}}
                />
              </View>
              <View style={{ zIndex: 20, marginBottom: 10 }}>
                <GooglePlacesAutocomplete
                  placeholder="Destino de simulación"
                  fetchDetails={true}
                  onPress={(data, details = null) => {
                    setCoordsDestinoSim({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                  }}
                  query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: 'es', components: 'country:ar' }}
                  requestUrl={{ url: 'https://desarrollo-remises-alberdi.onrender.com/api/maps', useOnPlatform: 'native' }}
                  styles={{...googlePlacesStyles, textInput: {...googlePlacesStyles.textInput, height: 40}}}
                />
              </View>

              {(!coordsOrigenSim && !coordsOrigen) || (!coordsDestinoSim && !coordsDestino) ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 5 }}>Ingresa un origen y un destino para simular.</Text>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: theme.text, fontSize: 13, marginBottom: 10 }}>
                    Distancia aprox: {(calcularDistancia(
                      (coordsOrigenSim || coordsOrigen).lat, 
                      (coordsOrigenSim || coordsOrigen).lng, 
                      (coordsDestinoSim || coordsDestino).lat, 
                      (coordsDestinoSim || coordsDestino).lng
                    ) * 1.3).toFixed(1)} km
                  </Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: '#fff', color: '#000', marginBottom: 10, height: 40 }]} 
                    placeholder="Espera estimada (min) ej: 15" 
                    keyboardType="numeric" 
                    value={minutosEsperaSimulados} 
                    onChangeText={setMinutosEsperaSimulados} 
                  />
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
                    Costo Estimado: ${calcularCostoSimulado()}
                  </Text>
                  <Text style={{ color: 'gray', fontSize: 11, textAlign: 'center', marginTop: 5 }}>*El costo final puede variar por la ruta real tomada.</Text>
                </View>
              )}
            </View>

            <Text style={{ color: theme.text, marginBottom: 10, fontWeight: 'bold', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 15 }}>
              O seleccione un destino fijo (Costo Congelado):
            </Text>
            <ScrollView>
              {destinosFijos.map((destino) => (
                <TouchableOpacity 
                  key={destino.id} 
                  style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => pedirLargaDistancia(destino)}
                >
                  <Text style={{ color: theme.text, fontSize: 16 }}>{destino.nombre}</Text>
                  <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 16 }}>${destino.precio}</Text>
                </TouchableOpacity>
              ))}
              {destinosFijos.length === 0 && (
                <Text style={{ color: theme.text, textAlign: 'center', marginTop: 20 }}>No hay destinos disponibles</Text>
              )}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#ef4444', marginTop: 20 }]} 
              onPress={() => setModalLargaDistancia(false)}
            >
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Tarifas Informativo */}
      <Modal visible={modalCostos} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 500, backgroundColor: theme.cardBg, borderRadius: 20, padding: 25, maxHeight: '90%' }}>
            <Text style={[styles.title, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>Tarifas Actuales</Text>
            
            <ScrollView style={{ maxHeight: 400 }}>
              {tarifas ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>Horario Diurno</Text>
                  <Text style={{ color: theme.text }}>Bajada de bandera: ${tarifas.bajada_bandera_diurna}</Text>
                  <Text style={{ color: theme.text }}>Cada 100 metros: ${tarifas.precio_100m_diurna}</Text>
                  
                  <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>Horario Nocturno / Feriados</Text>
                  <Text style={{ color: theme.text }}>Bajada de bandera: ${tarifas.bajada_bandera_nocturna}</Text>
                  <Text style={{ color: theme.text }}>Cada 100 metros: ${tarifas.precio_100m_nocturna}</Text>
                  
                  <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>Jubilados y Pensionados</Text>
                  <Text style={{ color: theme.text }}>Bajada de bandera: ${tarifas.bajada_bandera_jubilados}</Text>
                  <Text style={{ color: theme.text }}>Cada 100 metros: ${tarifas.precio_100m_jubilados}</Text>
                  
                  <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }}>Otros Costos</Text>
                  <Text style={{ color: theme.text }}>Hora de Espera: ${tarifas.precio_espera_hora} (se fracciona cada 10 min)</Text>
                  <Text style={{ color: theme.text }}>Kilómetro extra (fuera de ciudad): ${tarifas.precio_km_extra || 1100}</Text>
                  
                  {destinosFijos && destinosFijos.length > 0 && (
                    <>
                      <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 15, marginBottom: 5 }}>Destinos Fijos (Larga Distancia)</Text>
                      {destinosFijos.map(d => (
                        <Text key={d.id} style={{ color: theme.text }}>
                          • {d.nombre_destino}: ${d.precio_fijo}
                        </Text>
                      ))}
                    </>
                  )}
                </View>
              ) : (
                <Text style={{ color: theme.text, textAlign: 'center' }}>Cargando tarifas...</Text>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#3b82f6', marginTop: 15 }]} 
              onPress={() => setModalCostos(false)}
            >
              <Text style={styles.buttonText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

const googlePlacesStyles = {
  textInputContainer: {
    backgroundColor: 'rgba(0,0,0,0)',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  textInput: {
    marginLeft: 0,
    marginRight: 0,
    height: 48,
    color: '#000',
    fontSize: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 15,
  },
  predefinedPlacesDescription: {
    color: '#1faadb',
  },
  listView: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    elevation: 3,
  },
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
