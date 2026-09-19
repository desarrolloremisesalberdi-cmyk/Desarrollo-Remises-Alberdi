import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { UserPlus, Car, Map as MapIcon, DollarSign } from 'lucide-react';
import Drivers from './pages/Drivers';
import NewUser from './pages/NewUser';
import Finances from './pages/Finances';

function DashboardMap() {
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
          <Marker position={[-33.045, -61.168]}>
            <Popup>Auto Libre (Verde) <br/> Móvil #14</Popup>
          </Marker>
          <Marker position={[-33.041, -61.170]}>
            <Popup>Auto Ocupado (Rojo) <br/> Móvil #03</Popup>
          </Marker>
        </MapContainer>
      </div>
      
      <div className="stats">
        <div className="card green">Autos Libres: 1</div>
        <div className="card red">Autos Ocupados: 1</div>
        <div className="card gray">Autos Desconectados: 15</div>
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
          <li><Link to="/nuevo-usuario" className={location.pathname === '/nuevo-usuario' ? 'active' : ''}><UserPlus /> Nuevo Usuario</Link></li>
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
