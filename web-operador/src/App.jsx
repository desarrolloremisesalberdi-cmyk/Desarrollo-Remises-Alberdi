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
    // 1. Cargar todos los choferes para tener la base real de desconectados
    fetch('https://desarrollo-remises-alberdi.onrender.com/api/choferes')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const dict = {};
          data.choferes.forEach(ch => {
            dict[ch.id || ch.dni] = {
              chofer_id: ch.id || ch.dni,
              dni: ch.dni,
              movil: ch.numero_movil,
              lat: ch.lat,
              lng: ch.lng,
              isOnline: ch.is_online,
              estado: ch.estado,
              foto_url: ch.foto_url
            };
          });
          setActiveDrivers(dict);
        }
      })
      .catch(err => console.error("Error cargando choferes:", err));

    // 2. Escuchar pulsos en tiempo real
    socket.on('driver_location', (data) => {
      setActiveDrivers((prev) => ({
        ...prev,
        [data.chofer_id]: {
          ...prev[data.chofer_id], // Preserve other static info like estado
          ...data
        }
      }));
    });

    return () => {
      socket.off('driver_location');
    };
  }, []);

  // Calcular totales reales
  const driversList = Object.values(activeDrivers);
  const autosLibres = driversList.filter(d => d.isOnline).length;
  const autosOcupados = driversList.filter(d => d.estado === 'ocupado').length;
  const autosDesconectados = driversList.length - autosLibres - autosOcupados;

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
          {driversList.filter(d => d.lat != null && d.lng != null && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng))).map(driver => {
            const borderColor = driver.isOnline ? '#10b981' : '#ef4444';
            const imageUrl = driver.foto_url || `https://ui-avatars.com/api/?name=C&background=333&color=fff`;
            const iconHtml = `
              <div style="
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                border: 3px solid ${borderColor}; 
                background-image: url('${imageUrl}'); 
                background-size: cover; 
                background-position: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
              "></div>
            `;
            const customIcon = L.divIcon({
              className: 'custom-driver-icon',
              html: iconHtml,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            });

            return (
              <Marker key={driver.chofer_id} position={[driver.lat, driver.lng]} icon={customIcon}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <img src={imageUrl} alt="Chofer" style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: 5 }} />
                    <br />
                    <strong>Móvil #{driver.movil}</strong><br/>
                    {driver.isOnline ? 'Auto Libre (Verde)' : 'Auto Ocupado (Rojo)'} <br/>
                    DNI: {driver.dni}
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
import { Settings as SettingsIcon } from 'lucide-react';

function Layout({ children }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`dashboard ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar">
        <div style={{ textAlign: 'center', cursor: 'pointer', padding: '10px 0' }} onClick={() => setIsCollapsed(!isCollapsed)}>
          <img src="/logo.jpg" alt="Logo" style={{ width: isCollapsed ? '40px' : '150px', transition: 'width 0.3s', borderRadius: '8px' }} />
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
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardMap />} />
          <Route path="/choferes" element={<Drivers />} />
          <Route path="/nuevo-usuario" element={<NewUser />} />
          <Route path="/finanzas" element={<Finances />} />
          <Route path="/configuracion" element={<Configuration />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
