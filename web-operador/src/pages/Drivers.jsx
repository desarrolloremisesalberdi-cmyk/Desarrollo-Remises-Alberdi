import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, ChevronRight, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Drivers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driversList, setDriversList] = useState([]);
  const [editingDriver, setEditingDriver] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    fetch('https://desarrollo-remises-alberdi.onrender.com/api/choferes')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Normalizar datos para la vista
          const list = data.choferes.map(ch => ({
            ...ch, // Mantener datos crudos
            id: ch.id,
            nombreCompleto: `${ch.nombre} ${ch.apellido}`,
            dni: ch.dni,
            movilStr: ch.numero_movil ? ch.numero_movil.toString().padStart(2, '0') : 'N/A',
            licencia_vencimiento_str: ch.licencia_vencimiento ? new Date(ch.licencia_vencimiento).toISOString().split('T')[0] : '2099-12-31',
            estado_str: ch.estado ? ch.estado.charAt(0).toUpperCase() + ch.estado.slice(1) : 'Desconocido',
            vehiculo_str: ch.vehiculo_modelo || 'Vehículo Genérico',
            suspendido: ch.suspendido || false
          }));
          setDriversList(list);
        }
      })
      .catch(err => console.error(err));
  }, []);

  // Filtramos por DNI o Número de Móvil
  const filteredDrivers = driversList.filter(driver => 
    (driver.dni && driver.dni.includes(searchTerm)) || (driver.movilStr && driver.movilStr.includes(searchTerm))
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

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://desarrollo-remises-alberdi.onrender.com/api/choferes/${editingDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDriver)
      });
      const data = await res.json();
      if (data.success) {
        // Actualizar la lista
        const updatedList = driversList.map(d => {
          if (d.id === editingDriver.id) {
            return {
              ...data.chofer,
              nombreCompleto: `${data.chofer.nombre} ${data.chofer.apellido}`,
              dni: data.chofer.dni,
              movilStr: data.chofer.numero_movil ? data.chofer.numero_movil.toString().padStart(2, '0') : 'N/A',
              licencia_vencimiento_str: data.chofer.licencia_vencimiento ? new Date(data.chofer.licencia_vencimiento).toISOString().split('T')[0] : '2099-12-31',
              estado_str: data.chofer.estado ? data.chofer.estado.charAt(0).toUpperCase() + data.chofer.estado.slice(1) : 'Desconocido',
              vehiculo_str: data.chofer.vehiculo_modelo || 'Vehículo Genérico',
              suspendido: data.chofer.suspendido || false
            };
          }
          return d;
        });
        setDriversList(updatedList);
        setSelectedDriver(updatedList.find(d => d.id === editingDriver.id));
        setEditingDriver(null);
      } else {
        alert(data.error || 'Error al actualizar');
      }
    } catch (error) {
      alert('Error de red');
    }
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
                <h3>Móvil #{driver.movilStr} - {driver.nombreCompleto}</h3>
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
              <h2>Ficha del Chofer: {selectedDriver.nombreCompleto}</h2>
              <hr />
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Móvil Asignado:</span>
                  <strong>#{selectedDriver.movilStr}</strong>
                </div>
                <div className="detail-item">
                  <span>DNI:</span>
                  <strong>{selectedDriver.dni}</strong>
                </div>
                <div className="detail-item">
                  <span>Estado en Sistema:</span>
                  <strong>{selectedDriver.estado_str}</strong>
                </div>
                <div className="detail-item">
                  <span>Vehículo:</span>
                  <strong>{selectedDriver.vehiculo_str} (Patente: {selectedDriver.vehiculo_patente})</strong>
                </div>
                <div className="detail-item">
                  <span>Alias / CBU:</span>
                  <strong>{selectedDriver.datos_pago || 'No especificado'}</strong>
                </div>
                
                <div className="detail-item license-status" style={{ gridColumn: '1 / -1' }}>
                  <span>Estado de Licencia:</span>
                  <div className={`badge badge-${checkLicenseStatus(selectedDriver.licencia_vencimiento_str).color}`}>
                    {checkLicenseStatus(selectedDriver.licencia_vencimiento_str).icon}
                    <strong style={{marginLeft: 5}}>{checkLicenseStatus(selectedDriver.licencia_vencimiento_str).text}</strong>
                  </div>
                  <p className="expiration-date">Vence el: {selectedDriver.licencia_vencimiento_str}</p>
                </div>
              </div>
              
              <div className="detail-actions">
                <button className="btn btn-primary" onClick={() => setEditingDriver({
                  id: selectedDriver.id,
                  nombre: selectedDriver.nombre || '',
                  apellido: selectedDriver.apellido || '',
                  dni: selectedDriver.dni || '',
                  numero_movil: selectedDriver.numero_movil || '',
                  vehiculo_modelo: selectedDriver.vehiculo_modelo || '',
                  vehiculo_patente: selectedDriver.vehiculo_patente || '',
                  vencimiento_carnet: selectedDriver.licencia_vencimiento_str || '',
                  datos_pago: selectedDriver.datos_pago || ''
                })}>Editar Datos</button>
                <button 
                  className={`btn ${selectedDriver.suspendido ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => {
                    const confirmMsg = selectedDriver.suspendido 
                      ? `¿Estás seguro de que quieres habilitar a ${selectedDriver.nombre}?`
                      : `¿Estás seguro de que quieres suspender a ${selectedDriver.nombre}? No podrá iniciar sesión.`;
                    
                    if (window.confirm(confirmMsg)) {
                      fetch('https://desarrollo-remises-alberdi.onrender.com/api/choferes/toggle-suspend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: selectedDriver.id, suspendido: !selectedDriver.suspendido })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
                          // Update local state
                          setDriversList(prev => prev.map(d => 
                            d.id === selectedDriver.id ? { ...d, suspendido: !selectedDriver.suspendido } : d
                          ));
                          setSelectedDriver({ ...selectedDriver, suspendido: !selectedDriver.suspendido });
                        } else {
                          alert(data.error);
                        }
                      });
                    }
                  }}
                >
                  {selectedDriver.suspendido ? 'Habilitar Chofer' : 'Suspender Chofer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-selection">
              <p>Seleccioná un chofer de la lista para ver su información detallada.</p>
            </div>
          )}
        </div>
      </div>

      {editingDriver && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#1f2937', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>Editar Chofer</h2>
            <form onSubmit={handleUpdateDriver} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={editingDriver.nombre} onChange={e => setEditingDriver({...editingDriver, nombre: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input type="text" value={editingDriver.apellido} onChange={e => setEditingDriver({...editingDriver, apellido: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>DNI</label>
                <input type="text" value={editingDriver.dni} onChange={e => setEditingDriver({...editingDriver, dni: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Número de Móvil</label>
                <input type="number" value={editingDriver.numero_movil} onChange={e => setEditingDriver({...editingDriver, numero_movil: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Modelo de Vehículo</label>
                <input type="text" value={editingDriver.vehiculo_modelo} onChange={e => setEditingDriver({...editingDriver, vehiculo_modelo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Patente</label>
                <input type="text" value={editingDriver.vehiculo_patente} onChange={e => setEditingDriver({...editingDriver, vehiculo_patente: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Alias / CBU (Pago Anticipado)</label>
                <input type="text" value={editingDriver.datos_pago} onChange={e => setEditingDriver({...editingDriver, datos_pago: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div className="form-group">
                <label>Vencimiento Carnet</label>
                <input type="date" value={editingDriver.vencimiento_carnet} onChange={e => setEditingDriver({...editingDriver, vencimiento_carnet: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-danger" onClick={() => setEditingDriver(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
