import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { io } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { UserPlus, Car, Map as MapIcon, DollarSign } from 'lucide-react';
import Drivers from './pages/Drivers';
import NewUser from './pages/NewUser';
import Finances from './pages/Finances';


const socket = io('https://taxis-alberdi-backend.onrender.com');

function DashboardMap() {
  const [activeDrivers, setActiveDrivers] = useState({});

  useEffect(() => {
    // 1. Cargar el historial o estado actual desde la base de datos (Backend local)
    fetch('https://taxis-alberdi-backend.onrender.com/api/choferes/activos')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const dict = {};
          data.choferes.forEach(ch => {
            // Re-mapeamos para que coincida con el formato del socket
            dict[ch.id || ch.dni] = {
              chofer_id: ch.id || ch.dni,
              dni: ch.dni,
              movil: ch.numero_movil,
              lat: ch.lat,
              lng: ch.lng,
              isOnline: ch.is_online
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
        [data.chofer_id]: data
      }));
    });

    return () => {
      socket.off('driver_location');
    };
  }, []);

  // Calcular totales
  const driversList = Object.values(activeDrivers);
  const autosLibres = driversList.filter(d => d.isOnline).length;
  const autosOcupados = driversList.filter(d => !d.isOnline).length;
  const autosDesconectados = 15 - (autosLibres + autosOcupados); // Asumiendo 15 flota total

  return (
    <main className="content">
      <header>
        <h1>Mapa en Vivo (Casilda)</h1>
      </header>
      
      <div className="map-wrapper">
        <MapContainer center={[-33.044167, -61.168056]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {driversList.map(driver => (
            <Marker key={driver.chofer_id} position={[driver.lat, driver.lng]}>
              <Popup>
                Móvil #{driver.movil} <br/> 
                {driver.isOnline ? 'Auto Libre (Verde)' : 'Auto Ocupado (Rojo)'} <br/>
                DNI: {driver.dni}
              </Popup>
            </Marker>
          ))}
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

function Layout({ children }) {
  const location = useLocation();
  return (
    <div className="dashboard">
      <nav className="sidebar">
        <h2>Operador Alberdi</h2>
        <ul>
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}><MapIcon /> Mapa en Vivo</Link></li>
          <li><Link to="/choferes" className={location.pathname === '/choferes' ? 'active' : ''}><Car /> Choferes</Link></li>
          <li><Link to="/finanzas" className={location.pathname === '/finanzas' ? 'active' : ''}><DollarSign /> Finanzas</Link></li>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
