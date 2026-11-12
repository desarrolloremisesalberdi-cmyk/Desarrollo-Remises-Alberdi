import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { Shield, Phone, MessageSquare, Car, MapPin, CheckCircle, Navigation, Clock, AlertCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const socket = io(API_URL);

// Icono personalizado para el Móvil / Taxi
const taxiIcon = new L.DivIcon({
  className: 'custom-taxi-div-icon',
  html: `<div style="
    background: #10b981;
    border: 3px solid #ffffff;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    font-size: 22px;
  ">🚖</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

// Icono personalizado para el Origen
const originIcon = new L.DivIcon({
  className: 'custom-origin-div-icon',
  html: `<div style="
    background: #3b82f6;
    border: 3px solid #ffffff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    font-size: 18px;
  ">📍</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Icono personalizado para el Destino
const destIcon = new L.DivIcon({
  className: 'custom-dest-div-icon',
  html: `<div style="
    background: #ef4444;
    border: 3px solid #ffffff;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    font-size: 18px;
  ">🏁</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Componente para recentrar el mapa cuando se mueve el chofer
function MapAutoCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
}

export default function PublicTracking() {
  const { viajeId } = useParams();
  const [searchParams] = useSearchParams();

  const origenParam = searchParams.get('origen') || '';
  const destinoParam = searchParams.get('destino') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viaje, setViaje] = useState(null);
  const [choferLoc, setChoferLoc] = useState(null);
  const [estadoViaje, setEstadoViaje] = useState('en_camino'); // en_camino, en_curso, finalizado

  // Cargar datos iniciales del viaje
  const fetchTripData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/viajes/${viajeId}/track`);
      const data = await res.json();
      if (data.success && data.viaje) {
        setViaje(data.viaje);
        setEstadoViaje(data.viaje.estado || 'en_camino');
        if (data.viaje.chofer && data.viaje.chofer.lat && data.viaje.chofer.lng) {
          setChoferLoc([parseFloat(data.viaje.chofer.lat), parseFloat(data.viaje.chofer.lng)]);
        }
      } else {
        // Si no se encuentra en DB pero tenemos params, fallback visual
        if (!viaje) {
          setError(data.error || 'Viaje no encontrado');
        }
      }
    } catch (e) {
      console.log('Error fetching tracking data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
    const interval = setInterval(fetchTripData, 5000);

    // Escuchar ubicación del chofer por sockets en tiempo real
    socket.on('driver_location', (data) => {
      if (viaje?.chofer?.id && (data.chofer_id === viaje.chofer.id || data.dni === viaje.chofer.dni)) {
        if (data.lat && data.lng) {
          setChoferLoc([parseFloat(data.lat), parseFloat(data.lng)]);
        }
      }
    });

    socket.on('ride_started', (data) => {
      if (data.viaje_id === viajeId || (viaje && data.pasajero_id === viaje.usuario_id)) {
        setEstadoViaje('en_curso');
      }
    });

    socket.on('ride_finished', (data) => {
      if (data.viaje_id === viajeId || (viaje && data.pasajero_id === viaje.usuario_id)) {
        setEstadoViaje('finalizado');
      }
    });

    return () => {
      clearInterval(interval);
      socket.off('driver_location');
      socket.off('ride_started');
      socket.off('ride_finished');
    };
  }, [viajeId, viaje?.chofer?.id]);

  const defaultCenter = choferLoc || 
    (viaje?.origen_lat ? [viaje.origen_lat, viaje.origen_lng] : [-33.044167, -61.168056]);

  const getStatusBadge = () => {
    switch (estadoViaje) {
      case 'solicitado':
      case 'en_camino':
        return {
          text: '🚖 Chofer en camino al punto de partida',
          bg: '#0284c7',
          color: '#fff'
        };
      case 'en_curso':
        return {
          text: '🚘 En viaje hacia el destino',
          bg: '#10b981',
          color: '#fff'
        };
      case 'finalizado':
        return {
          text: '✅ Viaje finalizado con éxito',
          bg: '#475569',
          color: '#fff'
        };
      default:
        return {
          text: '🚖 En seguimiento',
          bg: '#10b981',
          color: '#fff'
        };
    }
  };

  const statusBadge = getStatusBadge();
  const chofer = viaje?.chofer;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header Superior */}
      <header style={{
        background: '#1e293b',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
            src="/logo.png" 
            alt="Radio Taxis Alberdi" 
            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #10b981' }} 
          />
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
              Radio Taxis Alberdi
            </h1>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              Seguimiento Seguro en Tiempo Real
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(239, 68, 68, 0.15)',
          padding: '6px 12px',
          borderRadius: 20,
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            display: 'inline-block',
            boxShadow: '0 0 8px #ef4444'
          }} />
          <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.5px' }}>
            EN VIVO
          </span>
        </div>
      </header>

      {/* Contenedor Principal: Mapa y Tarjeta Flotante */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer
          center={defaultCenter}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {choferLoc && (
            <>
              <Marker position={choferLoc} icon={taxiIcon}>
                <Popup>
                  <div style={{ textAlign: 'center', color: '#000' }}>
                    <strong>Móvil #{chofer?.numero_movil || 'Taxi'}</strong>
                    <br />
                    {chofer ? `${chofer.nombre} ${chofer.apellido}` : 'En movimiento'}
                  </div>
                </Popup>
              </Marker>
              <MapAutoCenter center={choferLoc} />
            </>
          )}

          {viaje?.origen_lat && viaje?.origen_lng && (
            <Marker position={[viaje.origen_lat, viaje.origen_lng]} icon={originIcon}>
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>Punto de Partida</strong>
                  <br />
                  {origenParam || 'Origen del viaje'}
                </div>
              </Popup>
            </Marker>
          )}

          {viaje?.destino_lat && viaje?.destino_lng && (
            <Marker position={[viaje.destino_lat, viaje.destino_lng]} icon={destIcon}>
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>Destino</strong>
                  <br />
                  {destinoParam || viaje.destino_fijo_nombre || 'Destino final'}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Tarjeta Flotante Inferior de Información y Seguridad */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '16px',
          background: 'linear-gradient(to top, rgba(15, 23, 42, 0.98) 85%, rgba(15, 23, 42, 0))',
          pointerEvents: 'none'
        }}>
          <div style={{
            maxWidth: 520,
            margin: '0 auto',
            background: '#1e293b',
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            pointerEvents: 'auto'
          }}>
            
            {/* Badge de Estado del Viaje */}
            <div style={{
              background: statusBadge.bg,
              color: statusBadge.color,
              padding: '8px 14px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {statusBadge.text}
            </div>

            {/* Datos del Chofer y Vehículo */}
            {chofer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                paddingBottom: 14,
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: 14
              }}>
                <img
                  src={chofer.foto_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}
                  alt="Chofer"
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #10b981'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                      {chofer.nombre} {chofer.apellido}
                    </h2>
                    <span style={{
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6
                    }}>
                      MÓVIL #{chofer.numero_movil}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    🚗 {chofer.vehiculo_modelo} {chofer.vehiculo_color ? `· ${chofer.vehiculo_color}` : ''}
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, margin: '2px 0 0 0' }}>
                    Patente: <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>{chofer.vehiculo_patente}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                Buscando información del chofer asignado...
              </div>
            )}

            {/* Recorrido: Origen y Destino */}
            <div style={{ marginBottom: 14, fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#3b82f6', fontWeight: 800 }}>📍 Origen:</span>
                <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {origenParam || 'Punto fijado en mapa'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#ef4444', fontWeight: 800 }}>🏁 Destino:</span>
                <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {destinoParam || viaje?.destino_fijo_nombre || 'Destino acordado con chofer'}
                </span>
              </div>
            </div>

            {/* Botones de Seguridad y Contacto con Central */}
            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href="tel:03464422222"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Phone size={16} />
                Llamar a Central
              </a>
              <a
                href="https://api.whatsapp.com/send?phone=5493464555555&text=Hola%20Radio%20Taxi%20Alberdi,%20estoy%20siguiendo%20un%20viaje%20en%20vivo"
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px',
                  borderRadius: 12,
                  background: '#25D366',
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
              >
                <MessageSquare size={16} />
                WhatsApp Central
              </a>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                🛡️ Monitoreado activamente por la guardia de Radio Taxi Alberdi (Casilda)
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
