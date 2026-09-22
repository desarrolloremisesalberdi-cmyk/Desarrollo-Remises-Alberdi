import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, ChevronRight, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Drivers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driversList, setDriversList] = useState([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    fetch('http://localhost:3000/api/choferes')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Normalizar datos para la vista
          const list = data.choferes.map(ch => ({
            id: ch.id,
            nombre: `${ch.nombre} ${ch.apellido}`,
            dni: ch.dni,
            movil: ch.numero_movil ? ch.numero_movil.toString().padStart(2, '0') : 'N/A',
            licencia_vencimiento: '2027-10-15', // Mock para la vista por ahora
            estado: ch.estado ? ch.estado.charAt(0).toUpperCase() + ch.estado.slice(1) : 'Desconocido',
            vehiculo: ch.vehiculo_modelo || 'Vehículo Genérico'
          }));
          setDriversList(list);
        }
      })
      .catch(err => console.error(err));
  }, []);

  // Filtramos por DNI o Número de Móvil
  const filteredDrivers = driversList.filter(driver => 
    driver.dni.includes(searchTerm) || driver.movil.includes(searchTerm)
  );

  // Función para determinar el estado de la licencia
  const checkLicenseStatus = (dateString) => {
    const expirationDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(expirationDate - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (expirationDate < today) {
      return { text: 'VENCIDA', color: 'red', icon: <AlertTriangle size={16} /> };
    } else if (diffDays <= 30) {
      return { text: 'POR VENCER (Menos de 30 días)', color: 'orange', icon: <AlertTriangle size={16} /> };
    }
    return { text: 'AL DÍA', color: 'green', icon: <CheckCircle size={16} /> };
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Gestión de Choferes</h1>
        <div style={{ display: 'flex', gap: '15px' }}>
          <div className="search-box">
            <Search size={20} color="#888" />
            <input 
              type="text" 
              placeholder="Buscar por DNI o Nº Móvil..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/nuevo-usuario')}>
            <UserPlus size={18} style={{marginRight: '8px'}} />
            Nuevo Chofer
          </button>
        </div>
      </header>

      <div className="drivers-layout">
        {/* Lista de Choferes */}
        <div className="drivers-list">
          {filteredDrivers.map(driver => (
            <div 
              key={driver.id} 
              className={`driver-card ${selectedDriver?.id === driver.id ? 'selected' : ''}`}
              onClick={() => setSelectedDriver(driver)}
            >
              <div className="driver-info-basic">
                <h3>Móvil #{driver.movil} - {driver.nombre}</h3>
                <p>DNI: {driver.dni}</p>
              </div>
              <ChevronRight color="#888" />
            </div>
          ))}
          {filteredDrivers.length === 0 && <p className="no-results">No se encontraron choferes.</p>}
        </div>

        {/* Detalle del Chofer Seleccionado */}
        <div className="driver-detail">
          {selectedDriver ? (
            <div className="detail-card">
              <h2>Ficha del Chofer: {selectedDriver.nombre}</h2>
              <hr />
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Móvil Asignado:</span>
                  <strong>#{selectedDriver.movil}</strong>
                </div>
                <div className="detail-item">
                  <span>DNI:</span>
                  <strong>{selectedDriver.dni}</strong>
                </div>
                <div className="detail-item">
                  <span>Estado en Sistema:</span>
                  <strong>{selectedDriver.estado}</strong>
                </div>
                <div className="detail-item">
                  <span>Vehículo:</span>
                  <strong>{selectedDriver.vehiculo}</strong>
                </div>
                
                <div className="detail-item license-status">
                  <span>Estado de Licencia:</span>
                  <div className={`badge badge-${checkLicenseStatus(selectedDriver.licencia_vencimiento).color}`}>
                    {checkLicenseStatus(selectedDriver.licencia_vencimiento).icon}
                    <strong style={{marginLeft: 5}}>{checkLicenseStatus(selectedDriver.licencia_vencimiento).text}</strong>
                  </div>
                  <p className="expiration-date">Vence el: {selectedDriver.licencia_vencimiento}</p>
                </div>
              </div>
              
              <div className="detail-actions">
                <button className="btn btn-primary">Editar Datos</button>
                <button className="btn btn-danger">Suspender Chofer</button>
              </div>
            </div>
          ) : (
            <div className="empty-selection">
              <p>Seleccioná un chofer de la lista para ver su información detallada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
