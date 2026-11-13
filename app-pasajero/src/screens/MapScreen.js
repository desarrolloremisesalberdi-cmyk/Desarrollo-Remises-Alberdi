import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme, Image, TextInput, ActivityIndicator, Vibration, Alert, Modal, ScrollView, Linking } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

export default function MapScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const isDarkMode = true; // Siempre oscuro
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [solicitando, setSolicitando] = useState(false);
  const [estadoViaje, setEstadoViaje] = useState(null);
  const [choferAsignado, setChoferAsignado] = useState(null);
  const [viajeId, setViajeId] = useState(null);
  const [mensajeEspera, setMensajeEspera] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  
  const [modalLargaDistancia, setModalLargaDistancia] = useState(false);
  const [destinosFijos, setDestinosFijos] = useState([]);
  const [tarifas, setTarifas] = useState(null);
  const [minutosEsperaSimulados, setMinutosEsperaSimulados] = useState('');
  
  const [coordsOrigenSim, setCoordsOrigenSim] = useState(null);
  const [coordsDestinoSim, setCoordsDestinoSim] = useState(null);
  
  const [modalCostos, setModalCostos] = useState(false);
  const [tabCostos, setTabCostos] = useState('simulador'); // 'simulador' | 'tarifas'
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historialViajes, setHistorialViajes] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Selección de chofer
  const [modalSeleccionChofer, setModalSeleccionChofer] = useState(false);
  const [choferesCercanos, setChoferesCercanos] = useState([]);
  const [cargandoChoferes, setCargandoChoferes] = useState(false);
  const [choferEsperado, setChoferEsperado] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(30);
  const countdownIntervalRef = React.useRef(null);

  const [origenTexto, setOrigenTexto] = useState('');
  const [destinoTexto, setDestinoTexto] = useState('');

  // Calificación del chofer con 5 estrellas
  const [modalCalificacion, setModalCalificacion] = useState(false);
  const [tripToRate, setTripToRate] = useState(null);
  const [estrellas, setEstrellas] = useState(5);
  const [comentarioCalificacion, setComentarioCalificacion] = useState('');
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState([]);
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);

  const ETIQUETAS_CALIFICACION = [
    '✨ Auto impecable',
    '⏱️ Muy puntual',
    '🛡️ Manejo seguro',
    '🤝 Chofer muy amable',
    '❄️ Aire acondicionado',
    '🎵 Buena música'
  ];
  
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
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [usandoUbicacionActual, setUsandoUbicacionActual] = useState(false);
  const origenRef = React.useRef(null);

  const obtenerUbicacionActual = async () => {
    setObteniendoUbicacion(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso de GPS', 'Por favor permite el acceso a tu ubicación en los ajustes del dispositivo para solicitar desde tu posición actual.');
        setObteniendoUbicacion(false);
        return;
      }

      let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setCoordsOrigen({ lat: latitude, lng: longitude });
      setUsandoUbicacionActual(true);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 1000);
      }

      let direccionTexto = 'Mi ubicación actual';
      try {
        let rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (rev && rev.length > 0) {
          const item = rev[0];
          const calle = item.street || '';
          const numero = item.streetNumber || '';
          const ciudad = item.city || item.subregion || 'Casilda';
          direccionTexto = `${calle} ${numero}, ${ciudad}`.trim();
          if (direccionTexto.startsWith(',')) direccionTexto = direccionTexto.substring(1).trim();
          if (!direccionTexto || direccionTexto === ',') direccionTexto = 'Mi ubicación actual';
        }
      } catch (e) {
        console.log('Error reverseGeocodeAsync:', e);
      }

      setOrigenTexto(direccionTexto);
      if (origenRef.current) {
        origenRef.current.setAddressText(direccionTexto);
      }
    } catch (e) {
      console.warn('Error GPS:', e);
      Alert.alert('Error', 'No pudimos obtener tu ubicación actual. Ingresa tu punto de partida manualmente.');
    } finally {
      setObteniendoUbicacion(false);
    }
  };

  const iniciarPedidoTaxi = async () => {
    if (!coordsOrigen) {
      Alert.alert('Punto de partida requerido', 'Por favor selecciona tu origen o presiona "📍 Usar mi ubicación actual"');
      return;
    }
    if (!coordsDestino) {
      Alert.alert('Destino requerido', 'Por favor busca y selecciona tu destino en "¿A dónde vas?"');
      return;
    }
    
    setCargandoChoferes(true);
    setModalSeleccionChofer(true);
    try {
      let listaChoferes = [];

      // 1. Intentar el endpoint de choferes cercanos
      try {
        const res = await fetch(`${API_URL}/api/choferes/cercanos?lat=${coordsOrigen.lat}&lng=${coordsOrigen.lng}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.choferes) && data.choferes.length > 0) {
            listaChoferes = data.choferes;
          }
        }
      } catch (err) {
        console.log('Endpoint /api/choferes/cercanos no disponible');
      }

      // 2. Fallback: consultar /api/choferes y calcular cercanía en cliente
      if (listaChoferes.length === 0) {
        const resAll = await fetch(`${API_URL}/api/choferes`);
        if (resAll.ok) {
          const dataAll = await resAll.json();
          if (dataAll.success && Array.isArray(dataAll.choferes)) {
            const originLat = coordsOrigen && coordsOrigen.lat ? parseFloat(coordsOrigen.lat) : -33.044167;
            const originLng = coordsOrigen && coordsOrigen.lng ? parseFloat(coordsOrigen.lng) : -61.168056;

            const onlineDrivers = dataAll.choferes.filter(ch => 
              (ch.is_online || ch.estado === 'libre') && 
              ch.estado !== 'ocupado' && !ch.suspendido
            );

            listaChoferes = onlineDrivers.map(ch => {
              const chLat = ch.lat != null ? parseFloat(ch.lat) : -33.044167;
              const chLng = ch.lng != null ? parseFloat(ch.lng) : -61.168056;
              const dist = calcularDistancia(originLat, originLng, chLat, chLng);
              const etaMin = Math.max(1, Math.round(dist * 2.5 + 1));
              return {
                ...ch,
                distancia_km: parseFloat(dist.toFixed(1)),
                distancia_metros: Math.round(dist * 1000),
                eta_minutos: etaMin
              };
            });

            listaChoferes.sort((a, b) => a.distancia_km - b.distancia_km);
            listaChoferes = listaChoferes.slice(0, 5);
          }
        }
      }

      setChoferesCercanos(listaChoferes);
    } catch (e) {
      console.error('Error al buscar choferes:', e);
      setChoferesCercanos([]);
    } finally {
      setCargandoChoferes(false);
    }
  };

  const confirmarPedidoTaxi = async (choferDestinado = null) => {
    setModalSeleccionChofer(false);
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
          destino_lng: coordsDestino.lng,
          chofer_destinado_id: choferDestinado ? choferDestinado.id : null
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        if (data.viaje && data.viaje.id) {
          setViajeId(data.viaje.id);
        }
        if (choferDestinado) {
          setChoferEsperado(choferDestinado);
          let sec = 30;
          setSegundosRestantes(30);
          setEstadoViaje(`⏳ Solicitando a Móvil #${choferDestinado.numero_movil} (${choferDestinado.nombre})...\nEsperando confirmación (${sec}s)`);
          
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = setInterval(() => {
            sec -= 1;
            setSegundosRestantes(sec);
            if (sec <= 0) {
              clearInterval(countdownIntervalRef.current);
            } else {
              setEstadoViaje(`⏳ Solicitando a Móvil #${choferDestinado.numero_movil} (${choferDestinado.nombre})...\nEsperando confirmación (${sec}s)`);
            }
          }, 1000);
        } else {
          setChoferEsperado(null);
          setEstadoViaje('Buscando móvil más cercano...');
        }
        socket.emit('request_ride_direct', data.viaje);
      } else {
        Alert.alert('Error', 'No se pudo solicitar el viaje');
        setSolicitando(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
      setSolicitando(false);
    }
  };

  const pedirLargaDistancia = async (destinoFijo) => {
    if (!coordsOrigen) {
      Alert.alert('Error', 'Por favor, selecciona tu punto de partida (¿Dónde estás?) antes de continuar.');
      return;
    }
    setModalCostos(false);
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
        if (data.viaje && data.viaje.id) {
          setViajeId(data.viaje.id);
        }
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

  const compartirViajeWhatsApp = () => {
    if (!choferAsignado) {
      Alert.alert('Atención', 'Aún no tienes un chofer asignado para compartir');
      return;
    }

    const movilNum = choferAsignado.numero_movil || 'Taxi';
    const nombreChofer = `${choferAsignado.nombre || ''} ${choferAsignado.apellido || ''}`.trim() || 'Chofer Alberdi';
    const vehiculo = `${choferAsignado.vehiculo_modelo || 'Vehículo oficial'} ${choferAsignado.vehiculo_color ? `(${choferAsignado.vehiculo_color})` : ''}`.trim();
    const patente = choferAsignado.vehiculo_patente || 'En trámite';
    const origen = origenTexto || 'Punto de partida';
    const destino = destinoTexto || 'A convenir';

    const currentViajeId = viajeId || 'activo';
    const trackingUrl = `https://desarrollo-remises-alberdi.onrender.com/track/${currentViajeId}?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}`;

    const textoMensaje = 
      `🛡️ *Seguimiento de Seguridad - Radio Taxi Alberdi* 🚖\n\n` +
      `Hola! Te comparto los datos de mi taxi para que puedas seguir mi viaje:\n\n` +
      `👤 *Chofer:* ${nombreChofer}\n` +
      `🚖 *Móvil:* #${movilNum}\n` +
      `🚗 *Vehículo:* ${vehiculo}\n` +
      `🔢 *Patente:* ${patente}\n` +
      `📍 *Desde:* ${origen}\n` +
      `🏁 *Hacia:* ${destino}\n\n` +
      `🗺️ *Sigue mi viaje en vivo aquí:*\n${trackingUrl}`;

    const urlApp = `whatsapp://send?text=${encodeURIComponent(textoMensaje)}`;
    const urlWeb = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoMensaje)}`;

    Linking.canOpenURL(urlApp).then(supported => {
      if (supported) {
        Linking.openURL(urlApp);
      } else {
        Linking.openURL(urlWeb);
      }
    }).catch(() => {
      Linking.openURL(urlWeb);
    });
  };

  const handlePayment = async (metodo) => {
    if (!paymentData) return;
    const choferFinal = choferAsignado;
    const vId = paymentData.viaje_id || viajeId;
    const montoFinal = paymentData.monto;
    try {
      const response = await fetch(`${API_URL}/api/viajes/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: paymentData.viaje_id,
          metodo_pago: metodo
        }),
      });
      const data = await response.json();
      if (data.success) {
        setPaymentData(null);
        setEstadoViaje(null);
        setSolicitando(false);
        
        if (choferFinal) {
          setTripToRate({
            viaje_id: vId,
            chofer: choferFinal,
            monto: montoFinal,
            origen: origenTexto,
            destino: destinoTexto
          });
          setEstrellas(5);
          setComentarioCalificacion('');
          setEtiquetasSeleccionadas([]);
          setModalCalificacion(true);
        } else {
          Alert.alert('Viaje Finalizado', 'Gracias por viajar con Taxis Alberdi.');
        }
      } else {
        Alert.alert('Error', 'No se pudo registrar el pago');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const enviarCalificacion = async () => {
    if (!tripToRate || !tripToRate.chofer) {
      setModalCalificacion(false);
      return;
    }

    setEnviandoCalificacion(true);
    try {
      await fetch(`${API_URL}/api/viajes/calificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: tripToRate.viaje_id,
          chofer_id: tripToRate.chofer.id,
          usuario_id: user.id,
          estrellas: estrellas,
          comentario: comentarioCalificacion,
          etiquetas: etiquetasSeleccionadas
        })
      });
      Alert.alert('Calificación', '⭐ ¡Muchas gracias por tu calificación!\nTu opinión ayuda a mantener la máxima calidad de Taxis Alberdi.');
    } catch (err) {
      console.log('Error enviando calificacion:', err);
      Alert.alert('Calificación', '¡Gracias por calificar tu viaje!');
    } finally {
      setEnviandoCalificacion(false);
      setModalCalificacion(false);
      setChoferAsignado(null);
      setTripToRate(null);
    }
  };

  const fetchHistorial = async () => {
    if (!user.id) return;
    setLoadingHistorial(true);
    setModalHistorial(true);
    try {
      const response = await fetch(`${API_URL}/api/viajes/pasajero/${user.id}`);
      const data = await response.json();
      if (data.success) {
        setHistorialViajes(data.viajes);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingHistorial(false);
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
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setChoferEsperado(null);
        if (data.viaje_id || (data.viaje && data.viaje.id)) {
          setViajeId(data.viaje_id || data.viaje.id);
        }
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
        setPaymentData({
          viaje_id: data.viaje_id,
          monto: data.monto,
          datos_pago: data.datos_pago || 'No especificado'
        });
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

    socket.on('ride_driver_timeout', (data) => {
      if (data.pasajero_id === user.id) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setEstadoViaje(null);
        setSolicitando(false);
        setChoferEsperado(null);
        Alert.alert(
          'Chofer no disponible',
          `El Móvil #${data.numero_movil} (${data.nombre_chofer}) no respondió a tiempo.\n¿Deseas elegir otro chofer de la lista o el más rápido?`,
          [
            { text: 'Elegir otro chofer', onPress: () => iniciarPedidoTaxi() },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      }
    });

    socket.on('ride_driver_rejected', (data) => {
      if (data.pasajero_id === user.id) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setEstadoViaje(null);
        setSolicitando(false);
        setChoferEsperado(null);
        Alert.alert(
          'Móvil Ocupado',
          `El Móvil #${data.numero_movil} no puede tomar el viaje en este momento.\n¿Deseas elegir a otro chofer o asignar el más rápido?`,
          [
            { text: 'Elegir otro chofer', onPress: () => iniciarPedidoTaxi() },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
      }
    });

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      socket.off('ride_accepted');
      socket.off('ride_started');
      socket.off('ride_finished');
      socket.off('toggle_espera');
      socket.off('ride_driver_timeout');
      socket.off('ride_driver_rejected');
    };
  }, [user.id]);

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
              Oficial
            </Text>
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, gap: 5 }}>
          <TouchableOpacity 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 9, 
              backgroundColor: 'rgba(30, 41, 59, 0.85)', 
              borderRadius: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.12)',
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4
            }} 
            onPress={fetchHistorial}
          >
            <Text style={{ fontSize: 12 }}>📜</Text>
            <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 11 }}>Historial</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 9, 
              backgroundColor: 'rgba(16, 185, 129, 0.18)', 
              borderRadius: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(16, 185, 129, 0.5)',
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4
            }} 
            onPress={() => setModalCostos(true)}
          >
            <Text style={{ fontSize: 12 }}>💲</Text>
            <Text style={{ color: '#34d399', fontWeight: '700', fontSize: 11 }}>Costos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              paddingVertical: 6, 
              paddingHorizontal: 8, 
              backgroundColor: 'rgba(239, 68, 68, 0.18)', 
              borderRadius: 20, 
              borderWidth: 1, 
              borderColor: 'rgba(239, 68, 68, 0.35)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3
            }} 
            onPress={() => navigation.replace('Login')}
          >
            <Text style={{ fontSize: 11 }}>🚪</Text>
            <Text style={{ color: '#f87171', fontWeight: '700', fontSize: 11 }}>Salir</Text>
          </TouchableOpacity>
        </View>
      )
    });
  }, [navigation, user.id]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Mapa Nativo (Google Maps) */}
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
          {choferAsignado && !estadoViaje.includes('finalizado') && (
            <TouchableOpacity
              style={{
                marginTop: 14,
                backgroundColor: '#25D366',
                paddingVertical: 11,
                paddingHorizontal: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                shadowColor: '#25D366',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4
              }}
              onPress={compartirViajeWhatsApp}
            >
              <Text style={{ fontSize: 18 }}>🛡️</Text>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                Compartir mi viaje por WhatsApp
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={[styles.bottomCard, { backgroundColor: theme.cardBg, paddingBottom: Math.max(insets.bottom + 20, 48) }]}>
        {/* Barra superior estilizada tipo bottom-sheet */}
        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 }} />

        {!estadoViaje && (
          <View style={{ marginBottom: 10, zIndex: 10 }}>
            {/* Botón Principal: Usar Mi Ubicación Actual (Dark Glassmorphism) */}
            <TouchableOpacity 
              style={{ 
                backgroundColor: usandoUbicacionActual ? 'rgba(16, 185, 129, 0.16)' : 'rgba(2, 132, 199, 0.14)', 
                borderColor: usandoUbicacionActual ? '#10b981' : 'rgba(56, 189, 248, 0.45)', 
                borderWidth: 1.5,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 14,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 9,
              }} 
              onPress={obtenerUbicacionActual}
              disabled={obteniendoUbicacion}
            >
              {obteniendoUbicacion ? (
                <ActivityIndicator color="#10b981" size="small" />
              ) : (
                <>
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: usandoUbicacionActual ? '#10b981' : '#0284c7',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>{usandoUbicacionActual ? '✓' : '📍'}</Text>
                  </View>
                  <Text style={{
                    color: usandoUbicacionActual ? '#34d399' : '#38bdf8',
                    fontWeight: '800',
                    fontSize: 14,
                    letterSpacing: 0.3
                  }}>
                    {usandoUbicacionActual ? 'Mi Ubicación GPS Fijada' : 'Usar Mi Ubicación Actual'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Contenedor Ejecutivo de Ruta (Origen & Destino conectados) */}
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              padding: 12,
              marginBottom: 14
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                {/* Conector vertical didáctico */}
                <View style={{ width: 22, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, marginRight: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />
                  <View style={{ flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 }} />
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#ef4444' }} />
                </View>

                {/* Inputs de Origen y Destino */}
                <View style={{ flex: 1 }}>
                  <View style={{ zIndex: 20, marginBottom: 10 }}>
                    <GooglePlacesAutocomplete
                      ref={origenRef}
                      placeholder="¿Dónde te buscamos?"
                      fetchDetails={true}
                      textInputProps={{
                        onChangeText: (text) => {
                          setOrigenTexto(text);
                          if (usandoUbicacionActual) setUsandoUbicacionActual(false);
                        },
                        placeholderTextColor: '#64748b'
                      }}
                      onPress={(data, details = null) => {
                        setUsandoUbicacionActual(false);
                        setOrigenTexto(data.description);
                        if (details?.geometry?.location) {
                          const lat = details.geometry.location.lat;
                          const lng = details.geometry.location.lng;
                          setCoordsOrigen({ lat, lng });
                          if (mapRef.current) {
                            mapRef.current.animateToRegion({
                              latitude: lat,
                              longitude: lng,
                              latitudeDelta: 0.015,
                              longitudeDelta: 0.015,
                            }, 1000);
                          }
                        }
                      }}
                      query={{
                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                        language: 'es',
                        components: 'country:ar',
                      }}
                      styles={googlePlacesStyles}
                    />
                  </View>

                  <View style={{ zIndex: 10 }}>
                    <GooglePlacesAutocomplete
                      placeholder="¿A dónde vas?"
                      fetchDetails={true}
                      textInputProps={{
                        placeholderTextColor: '#64748b'
                      }}
                      onPress={(data, details = null) => {
                        setDestinoTexto(data.description);
                        if (details?.geometry?.location) {
                          const destLat = details.geometry.location.lat;
                          const destLng = details.geometry.location.lng;
                          setCoordsDestino({ lat: destLat, lng: destLng });
                          if (mapRef.current) {
                            if (coordsOrigen) {
                              mapRef.current.fitToCoordinates([
                                { latitude: coordsOrigen.lat, longitude: coordsOrigen.lng },
                                { latitude: destLat, longitude: destLng }
                              ], {
                                edgePadding: { top: 120, right: 60, bottom: 380, left: 60 },
                                animated: true,
                              });
                            } else {
                              mapRef.current.animateToRegion({
                                latitude: destLat,
                                longitude: destLng,
                                latitudeDelta: 0.015,
                                longitudeDelta: 0.015,
                              }, 1000);
                            }
                          }
                        }
                      }}
                      query={{
                        key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                        language: 'es',
                        components: 'country:ar',
                      }}
                      styles={googlePlacesStyles}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Botón Principal: Pedir Taxi Alberdi */}
            <TouchableOpacity 
              style={{
                backgroundColor: '#10b981',
                borderRadius: 16,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 12,
                elevation: 6
              }} 
              onPress={iniciarPedidoTaxi}
              disabled={solicitando}
            >
              {solicitando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>🚖</Text>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.8 }}>
                    PEDIR TAXI ALBERDI
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {estadoViaje && (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: estadoViaje.includes('finalizado') ? '#3b82f6' : '#10b981'}]} 
            onPress={() => {
              if (estadoViaje.includes('finalizado')) {
                if (choferAsignado) {
                  setTripToRate({
                    viaje_id: viajeId,
                    chofer: choferAsignado,
                    origen: origenTexto,
                    destino: destinoTexto
                  });
                  setEstrellas(5);
                  setComentarioCalificacion('');
                  setEtiquetasSeleccionadas([]);
                  setModalCalificacion(true);
                }
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

      {/* Modal de Selección de Chofer o Más Rápido */}
      <Modal visible={modalSeleccionChofer} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 15 }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: theme.cardBg, borderRadius: 24, padding: 22, maxHeight: '90%', borderWidth: 1, borderColor: theme.border }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>🚖 Elige tu Chofer</Text>
                <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Selecciona un móvil cercano o el más rápido</Text>
              </View>
              <TouchableOpacity 
                style={{ padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }}
                onPress={() => setModalSeleccionChofer(false)}
              >
                <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 6 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Opción 1: Asignar el más rápido */}
            <TouchableOpacity 
              style={{
                backgroundColor: '#10b981',
                padding: 16,
                borderRadius: 16,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              onPress={() => confirmarPedidoTaxi(null)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                </View>
                <View>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Asignar el más rápido</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>Despacha al primer móvil libre disponible</Text>
                </View>
              </View>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>PEDIR ➔</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <Text style={{ color: '#94a3b8', fontSize: 12, marginHorizontal: 10, fontWeight: '600', textTransform: 'uppercase' }}>
                O elige quién te lleva
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </View>

            {cargandoChoferes ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 13 }}>Buscando móviles libres cercanos...</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320, marginVertical: 5 }}>
                {choferesCercanos.length > 0 ? (
                  choferesCercanos.map((ch) => (
                    <View 
                      key={ch.id}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <Image 
                          source={{ uri: ch.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ch.nombre || 'Chofer')}&background=3b82f6&color=fff` }} 
                          style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#3b82f6' }}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
                              {ch.nombre} {ch.apellido}
                            </Text>
                            <View style={{ backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Móvil #{ch.numero_movil || 'S/N'}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.4)', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '800' }}>
                                ⭐ {ch.calificacion_promedio ? Number(ch.calificacion_promedio).toFixed(1) : '5.0'}
                              </Text>
                              {ch.total_calificaciones > 0 && (
                                <Text style={{ color: '#94a3b8', fontSize: 10, marginLeft: 3 }}>
                                  ({ch.total_calificaciones})
                                </Text>
                              )}
                            </View>
                            <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>
                              📍 a {ch.distancia_km} km (~{ch.eta_minutos} min)
                            </Text>
                          </View>
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                            {ch.vehiculo_modelo || 'Taxi'} {ch.vehiculo_color ? `(${ch.vehiculo_color})` : ''} • {ch.vehiculo_patente || ''}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={{
                          backgroundColor: '#3b82f6',
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          marginLeft: 10
                        }}
                        onPress={() => confirmarPedidoTaxi(ch)}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Elegir</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 25, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>⏳</Text>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 15, textAlign: 'center' }}>
                      No hay choferes libres en este momento
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                      Puedes solicitar con "El más rápido" para que lo tome el próximo móvil que quede libre.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#334155', marginTop: 12 }]} 
              onPress={() => setModalSeleccionChofer(false)}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Modal Unificado: Costos y Simulador */}
      <Modal visible={modalCostos} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '92%', maxWidth: 520, backgroundColor: theme.cardBg, borderRadius: 20, padding: 22, maxHeight: '90%' }}>
            
            {/* Tabs de Selección */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginBottom: 18 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: tabCostos === 'simulador' ? '#3b82f6' : 'transparent',
                }}
                onPress={() => setTabCostos('simulador')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  🧮 Simulador de Costos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: tabCostos === 'tarifas' ? '#3b82f6' : 'transparent',
                }}
                onPress={() => setTabCostos('tarifas')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  📋 Cuadro de Tarifas
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {tabCostos === 'simulador' ? (
                <View>
                  <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.3)', borderWidth: 1, padding: 15, borderRadius: 14, marginBottom: 16 }}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', marginBottom: 12, fontSize: 15 }}>
                      Calcular costo estimado de viaje
                    </Text>
                    
                    <View style={{ zIndex: 30, marginBottom: 10 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Punto de partida (simulación):</Text>
                      <GooglePlacesAutocomplete
                        placeholder="Origen de simulación"
                        fetchDetails={true}
                        onPress={(data, details = null) => {
                          setCoordsOrigenSim({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                        }}
                        query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: 'es', components: 'country:ar' }}
                        styles={{...googlePlacesStyles, textInput: {...googlePlacesStyles.textInput, height: 42}}}
                      />
                    </View>

                    <View style={{ zIndex: 20, marginBottom: 10 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Destino (simulación):</Text>
                      <GooglePlacesAutocomplete
                        placeholder="Destino de simulación"
                        fetchDetails={true}
                        onPress={(data, details = null) => {
                          setCoordsDestinoSim({ lat: details.geometry.location.lat, lng: details.geometry.location.lng });
                        }}
                        query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: 'es', components: 'country:ar' }}
                        styles={{...googlePlacesStyles, textInput: {...googlePlacesStyles.textInput, height: 42}}}
                      />
                    </View>
                    
                    {(!coordsOrigenSim && !coordsOrigen) || (!coordsDestinoSim && !coordsDestino) ? (
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 5, fontStyle: 'italic', textAlign: 'center' }}>
                        Ingresa un origen y un destino arriba para ver el cálculo.
                      </Text>
                    ) : (
                      <View style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10 }}>
                        <Text style={{ color: theme.text, fontSize: 13, marginBottom: 8 }}>
                          Distancia calculada: {(calcularDistancia(
                            (coordsOrigenSim || coordsOrigen).lat, 
                            (coordsOrigenSim || coordsOrigen).lng, 
                            (coordsDestinoSim || coordsDestino).lat, 
                            (coordsDestinoSim || coordsDestino).lng
                          ) * 1.3).toFixed(1)} km
                        </Text>
                        <TextInput 
                          style={[styles.input, { backgroundColor: '#fff', color: '#000', marginBottom: 10, height: 40, borderRadius: 8, paddingHorizontal: 10 }]} 
                          placeholder="Minutos de espera estimados (opcional)" 
                          keyboardType="numeric" 
                          value={minutosEsperaSimulados} 
                          onChangeText={setMinutosEsperaSimulados} 
                        />
                        <View style={{ alignItems: 'center', marginVertical: 6 }}>
                          <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 24 }}>
                            ${calcularCostoSimulado()}
                          </Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Costo estimado total</Text>
                        </View>
                        <Text style={{ color: 'gray', fontSize: 11, textAlign: 'center', marginTop: 4 }}>*Tarifa de referencia. Puede variar según el recorrido y horario real.</Text>
                      </View>
                    )}
                  </View>

                  {destinosFijos && destinosFijos.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: theme.text, marginBottom: 10, fontWeight: 'bold', fontSize: 14 }}>
                        Destinos Fijos / Larga Distancia:
                      </Text>
                      {destinosFijos.map((destino) => (
                        <TouchableOpacity 
                          key={destino.id} 
                          style={{ 
                            padding: 14, 
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            borderRadius: 10,
                            marginBottom: 8,
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: theme.border,
                          }}
                          onPress={() => {
                            setModalCostos(false);
                            pedirLargaDistancia(destino);
                          }}
                        >
                          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>{destino.nombre_destino || destino.nombre}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 16 }}>${destino.precio_fijo || destino.precio}</Text>
                            <Text style={{ color: '#3b82f6', fontSize: 12 }}>Pedir ➔</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  {tarifas ? (
                    <View style={{ gap: 14 }}>
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>☀️ Tarifa Diurna (6:00 a 22:00)</Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Bajada de bandera: <Text style={{ fontWeight: 'bold' }}>${tarifas.bajada_bandera_diurna}</Text></Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Cada 100 metros: <Text style={{ fontWeight: 'bold' }}>${tarifas.precio_100m_diurna}</Text></Text>
                      </View>
                      
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ color: '#a855f7', fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>🌙 Tarifa Nocturna y Feriados (22:00 a 6:00)</Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Bajada de bandera: <Text style={{ fontWeight: 'bold' }}>${tarifas.bajada_bandera_nocturna}</Text></Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Cada 100 metros: <Text style={{ fontWeight: 'bold' }}>${tarifas.precio_100m_nocturna}</Text></Text>
                      </View>
                      
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#10b981' }}>
                        <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>👴 Jubilados y Pensionados (Tarifa Social)</Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Bajada de bandera: <Text style={{ fontWeight: 'bold' }}>${tarifas.bajada_bandera_jubilados}</Text></Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Cada 100 metros: <Text style={{ fontWeight: 'bold' }}>${tarifas.precio_100m_jubilados}</Text></Text>
                      </View>
                      
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: 15, marginBottom: 6 }}>⏱️ Adicionales</Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Hora de Espera: <Text style={{ fontWeight: 'bold' }}>${tarifas.precio_espera_hora}</Text> (fraccionada cada 10 min)</Text>
                        <Text style={{ color: theme.text, fontSize: 14 }}>• Km extra fuera de la ciudad: <Text style={{ fontWeight: 'bold' }}>${tarifas.precio_km_extra || 1100}</Text></Text>
                      </View>
                    </View>
                  ) : (
                    <ActivityIndicator size="large" color="#3b82f6" />
                  )}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#334155', marginTop: 16 }]} 
              onPress={() => setModalCostos(false)}
            >
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={!!paymentData} transparent={true} animationType="slide">
        <View style={{flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)'}}>
          <View style={{margin: 20, backgroundColor: theme.cardBg, borderRadius: 12, padding: 20, alignItems: 'center'}}>
            <Text style={{fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 10}}>Viaje Finalizado</Text>
            <Text style={{fontSize: 18, color: theme.text, marginBottom: 20}}>Monto a pagar: <Text style={{fontWeight: 'bold', color: '#10b981'}}>${paymentData?.monto}</Text></Text>
            
            <Text style={{fontSize: 16, color: theme.text, marginBottom: 15, textAlign: 'center'}}>Por favor, selecciona tu método de pago:</Text>
            
            <View style={{width: '100%', marginBottom: 20}}>
              <View style={{backgroundColor: '#1f2937', padding: 15, borderRadius: 8, marginBottom: 10}}>
                <Text style={{color: '#9ca3af', fontSize: 14, marginBottom: 5}}>Opción 1: Transferencia</Text>
                <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10}}>Alias / CBU: {paymentData?.datos_pago}</Text>
                <TouchableOpacity 
                  style={{backgroundColor: '#3b82f6', padding: 12, borderRadius: 6, alignItems: 'center'}}
                  onPress={() => handlePayment('transferencia')}
                >
                  <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Ya transferí</Text>
                </TouchableOpacity>
              </View>

              <View style={{backgroundColor: '#1f2937', padding: 15, borderRadius: 8}}>
                <Text style={{color: '#9ca3af', fontSize: 14, marginBottom: 5}}>Opción 2: Efectivo</Text>
                <TouchableOpacity 
                  style={{backgroundColor: '#10b981', padding: 12, borderRadius: 6, alignItems: 'center'}}
                  onPress={() => handlePayment('efectivo')}
                >
                  <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>Pago en Efectivo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Historial Modal */}
      <Modal visible={modalHistorial} transparent={true} animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 500, backgroundColor: theme.cardBg, borderRadius: 20, padding: 25, maxHeight: '90%' }}>
            <Text style={[styles.title, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>Mi Historial de Viajes</Text>
            
            {loadingHistorial ? (
              <ActivityIndicator size="large" color={theme.accent} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {historialViajes.length === 0 ? (
                  <Text style={{ color: theme.placeholder, textAlign: 'center', marginTop: 20 }}>No tienes viajes registrados aún.</Text>
                ) : (
                  historialViajes.map(viaje => (
                    <View key={viaje.id} style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 10 }}>
                      <Text style={{ color: theme.text, fontWeight: 'bold' }}>{new Date(viaje.fecha || viaje.hora_fin).toLocaleString()}</Text>
                      <Text style={{ color: theme.text, marginTop: 5 }}>Chofer: {viaje.chofer_nombre} {viaje.chofer_apellido}</Text>
                      <Text style={{ color: theme.text }}>Vehículo: {viaje.vehiculo_modelo} - {viaje.vehiculo_patente}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        <Text style={{ color: theme.text }}>Monto:</Text>
                        <Text style={{ color: '#10b981', fontWeight: 'bold' }}>${viaje.monto_calculado}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#ef4444', marginTop: 20 }]} 
              onPress={() => setModalHistorial(false)}
            >
              <Text style={styles.buttonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Calificación con 5 Estrellas */}
      <Modal visible={modalCalificacion} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{
            width: '100%',
            maxWidth: 460,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1.5,
            borderColor: 'rgba(16, 185, 129, 0.45)',
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 15,
            maxHeight: '92%'
          }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Encabezado */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Image 
                  source={require('../../assets/logo-alberdi.png')} 
                  style={{ width: 44, height: 44, borderRadius: 22, marginBottom: 8 }} 
                  resizeMode="cover"
                />
                <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 }}>
                  ¿Cómo estuvo tu viaje?
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 3 }}>
                  Tu evaluación ayuda a mantener la calidad de Radio Taxis Alberdi
                </Text>
              </View>

              {/* Ficha del Chofer */}
              {tripToRate?.chofer && (
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  {tripToRate.chofer.foto_url ? (
                    <Image 
                      source={{ uri: tripToRate.chofer.foto_url }} 
                      style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#10b981', marginBottom: 8 }}
                    />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 2, borderColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 24 }}>🚖</Text>
                    </View>
                  )}
                  <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '800' }}>
                    {tripToRate.chofer.nombre} {tripToRate.chofer.apellido}
                  </Text>
                  <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                    Móvil #{tripToRate.chofer.numero_movil || 'S/N'} • {tripToRate.chofer.vehiculo_modelo || 'Taxi Alberdi'}
                  </Text>
                  {tripToRate.chofer.vehiculo_patente && (
                    <Text style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>
                      Patente: {tripToRate.chofer.vehiculo_patente}
                    </Text>
                  )}
                </View>
              )}

              {/* Selector interactivo de 5 estrellas */}
              <View style={{ alignItems: 'center', marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => setEstrellas(star)}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ 
                        fontSize: 40, 
                        color: star <= estrellas ? '#fbbf24' : 'rgba(255, 255, 255, 0.18)',
                        textShadowColor: star <= estrellas ? 'rgba(251, 191, 36, 0.65)' : 'transparent',
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 10
                      }}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Descriptor del nivel de estrellas */}
                <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(251, 191, 36, 0.12)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                  <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '800', textAlign: 'center' }}>
                    {estrellas === 5 && '¡Excelente servicio! ⭐⭐⭐⭐⭐'}
                    {estrellas === 4 && 'Muy buen viaje ⭐⭐⭐⭐'}
                    {estrellas === 3 && 'Buen servicio ⭐⭐⭐'}
                    {estrellas === 2 && 'Regular ⭐⭐'}
                    {estrellas === 1 && 'Mala experiencia ⭐'}
                  </Text>
                </View>
              </View>

              {/* Etiquetas rápidas destacadas */}
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                ¿Qué te gustó del servicio? (Opcional)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {ETIQUETAS_CALIFICACION.map((tag) => {
                  const selected = etiquetasSeleccionadas.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => {
                        if (selected) {
                          setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(t => t !== tag));
                        } else {
                          setEtiquetasSeleccionadas([...etiquetasSeleccionadas, tag]);
                        }
                      }}
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        backgroundColor: selected ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                        borderWidth: 1,
                        borderColor: selected ? '#10b981' : 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <Text style={{ color: selected ? '#34d399' : '#cbd5e1', fontSize: 12, fontWeight: selected ? '700' : '500' }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Comentario opcional */}
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Comentario adicional
              </Text>
              <TextInput
                placeholder="Escribe tu opinión o sugerencia aquí (opcional)..."
                placeholderTextColor="#64748b"
                value={comentarioCalificacion}
                onChangeText={setComentarioCalificacion}
                multiline={true}
                numberOfLines={3}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  borderRadius: 14,
                  padding: 12,
                  color: '#f8fafc',
                  fontSize: 13,
                  minHeight: 65,
                  textAlignVertical: 'top',
                  marginBottom: 18
                }}
              />

              {/* Botones de acción */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                  elevation: 6
                }}
                onPress={enviarCalificacion}
                disabled={enviandoCalificacion}
              >
                {enviandoCalificacion ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }}>
                    ⭐ Enviar Calificación
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: 'transparent',
                  paddingVertical: 10,
                  alignItems: 'center'
                }}
                onPress={() => {
                  setModalCalificacion(false);
                  setChoferAsignado(null);
                  setTripToRate(null);
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>
                  Omitir por ahora
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
  placeholder: '#94a3b8',
  accent: '#10b981', // Verde Esmeralda Neón Oficial
};

const lightTheme = {
  bg: '#0b1320',
  cardBg: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#f8fafc',
  placeholder: '#94a3b8',
  accent: '#10b981',
};

const googlePlacesStyles = {
  textInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  textInput: {
    marginLeft: 0,
    marginRight: 0,
    height: 46,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
  },
  predefinedPlacesDescription: {
    color: '#38bdf8',
  },
  listView: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 8,
    zIndex: 9999,
  },
  row: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  description: {
    color: '#f8fafc',
    fontSize: 13,
  },
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
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
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
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  statusCard: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1.5,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: 440,
    width: '92%',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
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
