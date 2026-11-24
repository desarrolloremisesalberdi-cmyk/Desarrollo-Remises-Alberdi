import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { UserPlus, Car, Map as MapIcon, DollarSign } from 'lucide-react';
import Drivers from './pages/Drivers';
import NewUser from './pages/NewUser';
import Finances from './pages/Finances';


const socket = io('https://desarrollo-remises-alberdi.onrender.com');

function DashboardMap() {
  const [activeDrivers, setActiveDrivers] = useState({});

  useEffect(() => {
    const cargarChoferes = () => {
      fetch('https://desarrollo-remises-alberdi.onrender.com/api/choferes')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.choferes)) {
            setActiveDrivers((prev) => {
              const dict = { ...prev };
              data.choferes.forEach(ch => {
                const key = String(ch.id || ch.dni);
                const existing = dict[key] || {};
                dict[key] = {
                  ...existing,
                  chofer_id: ch.id || ch.dni,
                  dni: ch.dni,
                  movil: ch.numero_movil,
                  nombre: `${ch.nombre || ''} ${ch.apellido || ''}`.trim(),
                  lat: ch.lat != null ? ch.lat : existing.lat,
                  lng: ch.lng != null ? ch.lng : existing.lng,
                  isOnline: Boolean(ch.is_online),
                  estado: ch.estado || (ch.is_online ? 'libre' : 'inactivo'),
                  foto_url: ch.foto_url || existing.foto_url
                };
              });
              return dict;
            });
          }
        })
        .catch(err => console.error("Error cargando choferes:", err));
    };

    // 1. Cargar al iniciar, al reconectar socket y sincronizar cada 15 segundos entre todas las PCs abiertas
    cargarChoferes();
    const syncInterval = setInterval(cargarChoferes, 15000);
    socket.on('connect', cargarChoferes);

    // 2. Escuchar pulsos en tiempo real
    socket.on('driver_location', (data) => {
      setActiveDrivers((prev) => {
        const targetKey = Object.keys(prev).find((k) => {
          const d = prev[k];
          return (
            String(k) === String(data.chofer_id) ||
            (data.dni && String(d.dni) === String(data.dni)) ||
            (data.movil && String(d.movil) === String(data.movil))
          );
        }) || String(data.chofer_id);

        const oldDriver = prev[targetKey] || {};
        const oldEstado = oldDriver.estado || 'libre';
        const newEstado = data.estado
          ? data.estado
          : (data.isOnline ? 'libre' : (oldEstado === 'ocupado' ? 'ocupado' : 'inactivo'));
        
        return {
          ...prev,
          [targetKey]: {
            ...oldDriver, 
            ...data,
            chofer_id: oldDriver.chofer_id || data.chofer_id,
            dni: oldDriver.dni || data.dni,
            movil: oldDriver.movil || data.movil,
            foto_url: data.foto_url || oldDriver.foto_url,
            isOnline: true,
            estado: newEstado
          }
        };
      });
    });

    socket.on('driver_disconnected', (data) => {
      setActiveDrivers((prev) => {
        const targetKey = Object.keys(prev).find((k) => {
          const d = prev[k];
          return (
            String(k) === String(data.chofer_id) ||
            (data.chofer_id && String(d.chofer_id) === String(data.chofer_id)) ||
            (data.dni && String(d.dni) === String(data.dni)) ||
            (data.movil && String(d.movil) === String(data.movil)) ||
            (data.numero_movil && String(d.movil) === String(data.numero_movil))
          );
        });
        if (!targetKey || !prev[targetKey]) return prev;
        return {
          ...prev,
          [targetKey]: {
            ...prev[targetKey],
            isOnline: false,
            estado: 'inactivo'
          }
        };
      });
    });

    socket.on('driver_status_changed', (data) => {
      setActiveDrivers((prev) => {
        const targetKey = Object.keys(prev).find((k) => {
          const d = prev[k];
          return (
            String(k) === String(data.chofer_id) ||
            (data.chofer_id && String(d.chofer_id) === String(data.chofer_id)) ||
            (data.dni && String(d.dni) === String(data.dni)) ||
            (data.numero_movil && String(d.movil) === String(data.numero_movil)) ||
            (data.movil && String(d.movil) === String(data.movil))
          );
        });
        if (!targetKey || !prev[targetKey]) return prev;
        const isOffline = data.estado === 'inactivo' || data.isOnline === false;
        return {
          ...prev,
          [targetKey]: {
            ...prev[targetKey],
            estado: data.estado || (isOffline ? 'inactivo' : 'libre'),
            isOnline: isOffline ? false : (data.isOnline !== undefined ? data.isOnline : prev[targetKey].isOnline)
          }
        };
      });
    });

    return () => {
      clearInterval(syncInterval);
      socket.off('connect', cargarChoferes);
      socket.off('driver_location');
      socket.off('driver_disconnected');
      socket.off('driver_status_changed');
    };
  }, []);

  const handleToggleEstadoChofer = async (choferId, nuevoEstado, origen = 'base_telefonica') => {
    socket.emit('operator_set_driver_status', {
      chofer_id: choferId,
      estado: nuevoEstado,
      origen: origen
    });

    const isOnline = nuevoEstado === 'libre' || nuevoEstado === 'ocupado';

    setActiveDrivers((prev) => {
      if (!prev[choferId]) return prev;
      return {
        ...prev,
        [choferId]: {
          ...prev[choferId],
          estado: nuevoEstado,
          isOnline: isOnline
        }
      };
    });

    try {
      await fetch('https://desarrollo-remises-alberdi.onrender.com/api/choferes/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chofer_id: choferId, estado: nuevoEstado, origen: origen })
      });
    } catch (e) {
      console.log('Error llamando a set-status en backend:', e);
    }
  };

  const hasValidCoords = (d) =>
    d && d.lat != null && d.lng != null && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng));

  // Calcular totales reales (100% consistentes con los móviles visibles en el mapa)
  const driversList = Object.values(activeDrivers);
  const autosLibres = driversList.filter(d => d.isOnline && d.estado === 'libre' && hasValidCoords(d)).length;
  const autosOcupados = driversList.filter(d => d.isOnline && d.estado === 'ocupado' && hasValidCoords(d)).length;
  const autosDesconectados = driversList.filter(d => !d.isOnline || d.estado === 'inactivo' || !hasValidCoords(d)).length;

  // Filtrar choferes activos que deben dibujarse en el mapa
  const visibleDrivers = driversList.filter(d => hasValidCoords(d) && d.isOnline && (d.estado === 'libre' || d.estado === 'ocupado'));

  return (
    <main className="content">
      <header>
        <h1>Mapa en Vivo (Casilda)</h1>
      </header>
      
      <div className="map-wrapper">
        <MapContainer center={[-33.044167, -61.168056]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://www.google.com/intl/en-US_US/help/terms_maps.html">Google Maps</a>'
          />
          {visibleDrivers.map((driver, idx) => {
            const isLibre = driver.estado === 'libre';
            const borderColor = isLibre ? '#10b981' : '#ef4444';
            const statusText = isLibre ? 'Auto Libre (Verde)' : 'Auto Ocupado (Rojo)';

            // Si hay otro móvil en exactamente la misma coordenada (< 20m), desplazar levemente el marcador para que no se tapen
            const baseLat = parseFloat(driver.lat);
            const baseLng = parseFloat(driver.lng);
            const overlappingGroup = visibleDrivers.filter(
              other => Math.abs(parseFloat(other.lat) - baseLat) < 0.0002 && Math.abs(parseFloat(other.lng) - baseLng) < 0.0002
            );
            let displayLat = baseLat;
            let displayLng = baseLng;
            if (overlappingGroup.length > 1) {
              const posInGroup = overlappingGroup.findIndex(o => String(o.chofer_id) === String(driver.chofer_id));
              const angle = (posInGroup * (2 * Math.PI)) / overlappingGroup.length;
              displayLat = baseLat + Math.sin(angle) * 0.00032;
              displayLng = baseLng + Math.cos(angle) * 0.00032;
            }

            const imageUrl = driver.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.movil || 'M')}&background=1e293b&color=fff`;
            const iconHtml = `
              <div style="position: relative; width: 44px; height: 44px;">
                <div style="
                  width: 40px; 
                  height: 40px; 
                  border-radius: 50%; 
                  border: 3px solid ${borderColor}; 
                  background-image: url('${imageUrl}'); 
                  background-size: cover; 
                  background-position: center;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.45);
                "></div>
                <span style="
                  position: absolute;
                  bottom: -2px;
                  right: -4px;
                  background: ${borderColor};
                  color: #fff;
                  font-size: 10px;
                  font-weight: 900;
                  padding: 1px 5px;
                  border-radius: 8px;
                  border: 1.5px solid #0f172a;
                  line-height: 12px;
                ">#${driver.movil || '?'}</span>
              </div>
            `;
            const customIcon = L.divIcon({
              className: 'custom-driver-icon',
              html: iconHtml,
              iconSize: [44, 44],
              iconAnchor: [22, 22]
            });

            return (
              <Marker key={driver.chofer_id || idx} position={[displayLat, displayLng]} icon={customIcon}>
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '170px' }}>
                    <img src={imageUrl} alt="Chofer" style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: 5 }} />
                    <br />
                    <strong>Móvil #{driver.movil}</strong><br/>
                    <span style={{ fontWeight: 'bold', color: isLibre ? '#10b981' : '#ef4444' }}>{statusText}</span><br/>
                    <span style={{ fontSize: 12, color: '#666' }}>DNI: {driver.dni}</span>

                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {isLibre ? (
                        <button
                          onClick={() => handleToggleEstadoChofer(driver.chofer_id, 'ocupado', 'base_telefonica')}
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: 12
                          }}
                        >
                          📞 Asignar Viaje Telefónico
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleEstadoChofer(driver.chofer_id, 'libre', 'manual')}
                          style={{
                            backgroundColor: '#10b981',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: 12
                          }}
                        >
                          🟢 Poner Libre
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleEstadoChofer(driver.chofer_id, 'inactivo', 'manual')}
                        style={{
                          backgroundColor: '#334155',
                          color: '#f8fafc',
                          border: '1px solid #475569',
                          padding: '7px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: 12
                        }}
                      >
                        ⚪ Desconectar Chofer
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      
      <div className="stats">
        <div className="card green">Autos Libres: {autosLibres}</div>
        <div className="card red">Autos Ocupados: {autosOcupados}</div>
        <div className="card gray">Autos Desconectados: {autosDesconectados}</div>
      </div>
    </main>
  );
}

import Configuration from './pages/Configuration';
import PublicTracking from './pages/PublicTracking';
import { Settings as SettingsIcon } from 'lucide-react';

function Layout({ children }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [manualCloseRequest, setManualCloseRequest] = useState(null);
  const [montoManual, setMontoManual] = useState('');

  useEffect(() => {
    const handleManualClose = (data) => {
      setManualCloseRequest(data);
    };
    socket.on('manual_close_requested', handleManualClose);
    return () => socket.off('manual_close_requested', handleManualClose);
  }, []);

  const handleForceClose = async () => {
    if (!montoManual || isNaN(montoManual)) {
      alert("Ingrese un monto válido");
      return;
    }
    try {
      const response = await fetch('https://desarrollo-remises-alberdi.onrender.com/api/viajes/force-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viaje_id: manualCloseRequest.viaje_id,
          monto_manual: parseFloat(montoManual)
        })
      });
      const data = await response.json();
      if (data.success) {
        alert("Viaje cerrado exitosamente");
        setManualCloseRequest(null);
        setMontoManual('');
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Error de conexión");
    }
  };

  return (
    <div className={`dashboard ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {manualCloseRequest && (
        <div style={{
          position: 'fixed', top: 20, right: 20, backgroundColor: '#fff', 
          border: '2px solid #ef4444', padding: 20, zIndex: 10000,
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', width: 350
        }}>
          <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ Solicitud de Cierre Manual</h3>
          <p>El móvil solicita cierre manual por falla de GPS.</p>
          <p><strong>Chofer ID:</strong> {manualCloseRequest.chofer_id}</p>
          <div style={{ marginTop: 15 }}>
            <label>Monto a cobrar ($): </label>
            <input 
              type="number" 
              value={montoManual} 
              onChange={e => setMontoManual(e.target.value)} 
              style={{ padding: '8px', width: '100%', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
            <button 
              onClick={handleForceClose}
              style={{ flex: 1, backgroundColor: '#10b981', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              CERRAR VIAJE
            </button>
            <button 
              onClick={() => { setManualCloseRequest(null); setMontoManual(''); }}
              style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              IGNORAR
            </button>
          </div>
        </div>
      )}
      <nav className="sidebar">
        <div style={{ textAlign: 'center', cursor: 'pointer', padding: '10px 0' }} onClick={() => setIsCollapsed(!isCollapsed)}>
          <img src="/logo.png" alt="Logo" style={{ width: isCollapsed ? '40px' : '150px', transition: 'width 0.3s', borderRadius: '8px' }} />
        </div>
        <ul>
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}><MapIcon /> {!isCollapsed && "Mapa en Vivo"}</Link></li>
          <li><Link to="/choferes" className={location.pathname === '/choferes' ? 'active' : ''}><Car /> {!isCollapsed && "Choferes"}</Link></li>
          <li><Link to="/finanzas" className={location.pathname === '/finanzas' ? 'active' : ''}><DollarSign /> {!isCollapsed && "Finanzas"}</Link></li>
          <li><Link to="/configuracion" className={location.pathname === '/configuracion' ? 'active' : ''}><SettingsIcon /> {!isCollapsed && "Configuración"}</Link></li>
        </ul>
      </nav>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/track/:viajeId" element={<PublicTracking />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardMap />} />
              <Route path="/choferes" element={<Drivers />} />
              <Route path="/nuevo-usuario" element={<NewUser />} />
              <Route path="/finanzas" element={<Finances />} />
              <Route path="/configuracion" element={<Configuration />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
