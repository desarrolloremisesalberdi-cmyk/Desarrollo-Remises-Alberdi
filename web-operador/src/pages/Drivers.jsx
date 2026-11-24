import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, ChevronRight, UserPlus, Upload, Eye, KeyRound, X, ZoomIn, User, Car, Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const PROD_API_URL = 'https://desarrollo-remises-alberdi.onrender.com';
const LOCAL_API_URL = 'http://localhost:3000';
const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));
const API_BASE = isLocalHost ? LOCAL_API_URL : PROD_API_URL;

const socket = io(API_BASE);

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (res.ok) return res;
  } catch (e) {
    // Fallback to production URL if local backend is unreachable
  }
  return fetch(`${PROD_API_URL}${path}`, options);
}

export default function Drivers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driversList, setDriversList] = useState([]);
  const [editingDriver, setEditingDriver] = useState(null);
  const [editTab, setEditTab] = useState('personales');

  // Modal "Consultar Datos"
  const [viewingDriver, setViewingDriver] = useState(null);
  const [viewTab, setViewTab] = useState('todo');
  const [zoomedPhoto, setZoomedPhoto] = useState(null);

  // Modal "Cambiar / Restablecer Clave"
  const [passwordModalDriver, setPasswordModalDriver] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const navigate = useNavigate();

  const normalizeDriver = (ch) => ({
    ...ch,
    id: ch.id,
    nombreCompleto: `${ch.nombre || ''} ${ch.apellido || ''}`.trim(),
    dni: ch.dni || '',
    movilStr: ch.numero_movil ? ch.numero_movil.toString().padStart(2, '0') : 'N/A',
    tipo_chofer: ch.tipo_chofer || 'Titular',
    licencia_vencimiento_str: ch.licencia_vencimiento ? new Date(ch.licencia_vencimiento).toISOString().split('T')[0] : 'No especificada',
    fecha_nacimiento_str: ch.fecha_nacimiento ? new Date(ch.fecha_nacimiento).toISOString().split('T')[0] : 'No especificada',
    estado_str: !ch.is_online ? 'Desconectado' : (ch.estado ? ch.estado.charAt(0).toUpperCase() + ch.estado.slice(1) : 'Desconocido'),
    vehiculo_str: ch.vehiculo_modelo || 'Vehículo Genérico',
    suspendido: ch.suspendido || false,
    calificacion_promedio: ch.calificacion_promedio ? parseFloat(ch.calificacion_promedio) : 5.0,
    total_calificaciones: ch.total_calificaciones ? parseInt(ch.total_calificaciones) : 0
  });

  React.useEffect(() => {
    apiFetch('/api/choferes')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const list = data.choferes.map(normalizeDriver);
          setDriversList(list);
        }
      })
      .catch(err => console.error(err));

    const handleDriverRated = (data) => {
      setDriversList(prev => prev.map(d => {
        if (d.id === data.chofer_id) {
          return {
            ...d,
            calificacion_promedio: parseFloat(data.calificacion_promedio || data.promedio || d.calificacion_promedio),
            total_calificaciones: parseInt(data.total_calificaciones || data.total || d.total_calificaciones)
          };
        }
        return d;
      }));
      setSelectedDriver(prev => {
        if (prev && prev.id === data.chofer_id) {
          return {
            ...prev,
            calificacion_promedio: parseFloat(data.calificacion_promedio || data.promedio || prev.calificacion_promedio),
            total_calificaciones: parseInt(data.total_calificaciones || data.total || prev.total_calificaciones)
          };
        }
        return prev;
      });
    };

    socket.on('driver_rated', handleDriverRated);
    return () => {
      socket.off('driver_rated', handleDriverRated);
    };
  }, []);

  // Filtramos por DNI, Nombre o Número de Móvil
  const filteredDrivers = driversList.filter(driver => 
    (driver.dni && driver.dni.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (driver.movilStr && driver.movilStr.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (driver.nombreCompleto && driver.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Función para determinar el estado de la licencia
  const checkLicenseStatus = (dateString) => {
    if (!dateString || dateString === 'No especificada') {
      return { text: 'SIN FECHA CARGADA', color: 'orange', icon: <AlertTriangle size={16} /> };
    }
    const expirationDate = new Date(dateString);
    const today = new Date();
    const diffTime = expirationDate - today;
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
      const payload = {
        ...editingDriver,
        nombre: editingDriver.nombre ? editingDriver.nombre.trim() : '',
        apellido: editingDriver.apellido ? editingDriver.apellido.trim() : '',
        dni: editingDriver.dni ? editingDriver.dni.trim() : '',
        telefono: editingDriver.telefono ? editingDriver.telefono.trim() : '',
        domicilio: editingDriver.domicilio ? editingDriver.domicilio.trim() : '',
        fecha_nacimiento: (editingDriver.fecha_nacimiento && editingDriver.fecha_nacimiento.trim() !== '') ? editingDriver.fecha_nacimiento.trim() : null,
        vencimiento_carnet: (editingDriver.vencimiento_carnet && editingDriver.vencimiento_carnet.trim() !== '' && editingDriver.vencimiento_carnet !== 'No especificada') ? editingDriver.vencimiento_carnet.trim() : null,
        email: (editingDriver.email && editingDriver.email.trim() !== '') ? editingDriver.email.trim() : null,
        numero_movil: (editingDriver.numero_movil !== undefined && editingDriver.numero_movil !== null && String(editingDriver.numero_movil).trim() !== '') ? parseInt(editingDriver.numero_movil, 10) : null
      };

      const res = await apiFetch(`/api/choferes/${editingDriver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        const updatedList = driversList.map(d => {
          if (d.id === editingDriver.id) {
            return normalizeDriver({ ...d, ...data.chofer });
          }
          return d;
        });
        setDriversList(updatedList);
        const updatedSelected = updatedList.find(d => d.id === editingDriver.id);
        setSelectedDriver(updatedSelected);
        if (viewingDriver && viewingDriver.id === editingDriver.id) {
          setViewingDriver(updatedSelected);
        }
        setEditingDriver(null);
        alert('Chofer actualizado correctamente');
      } else {
        alert(data.error || 'Error al actualizar');
      }
    } catch (error) {
      alert('Error de red: ' + error.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordModalDriver) return;
    if (!newPassword || newPassword.trim().length < 4) {
      alert('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiFetch(`/api/choferes/${passwordModalDriver.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nueva_clave: newPassword.trim() })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Contraseña restablecida con éxito para ${passwordModalDriver.nombreCompleto} (Móvil #${passwordModalDriver.movilStr}).`);
        setPasswordModalDriver(null);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert('Error: ' + (data.error || 'No se pudo cambiar la contraseña.'));
      }
    } catch (error) {
      alert('Error de conexión: ' + error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleEstado = async (choferId, nuevoEstado, origen = 'base_telefonica') => {
    socket.emit('operator_set_driver_status', {
      chofer_id: choferId,
      estado: nuevoEstado,
      origen: origen
    });

    try {
      const res = await apiFetch('/api/choferes/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chofer_id: choferId, estado: nuevoEstado, origen: origen })
      });
      const data = await res.json();
      if (data.success) {
        const isOnline = nuevoEstado === 'libre' || nuevoEstado === 'ocupado';
        setDriversList(prev => prev.map(d => 
          d.id === choferId ? { 
            ...d, 
            estado: nuevoEstado, 
            is_online: isOnline,
            estado_str: nuevoEstado.charAt(0).toUpperCase() + nuevoEstado.slice(1) 
          } : d
        ));
        setSelectedDriver(prev => ({
          ...prev,
          estado: nuevoEstado,
          is_online: isOnline,
          estado_str: nuevoEstado.charAt(0).toUpperCase() + nuevoEstado.slice(1)
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (driver, initialTab = 'personales') => {
    setEditingDriver({
      id: driver.id,
      nombre: driver.nombre || '',
      apellido: driver.apellido || '',
      dni: driver.dni || '',
      telefono: driver.telefono || '',
      domicilio: driver.domicilio || '',
      email: driver.email || '',
      fecha_nacimiento: driver.fecha_nacimiento ? new Date(driver.fecha_nacimiento).toISOString().split('T')[0] : '',
      numero_movil: driver.numero_movil || '',
      tipo_chofer: driver.tipo_chofer || 'Titular',
      vehiculo_modelo: driver.vehiculo_modelo || '',
      vehiculo_patente: driver.vehiculo_patente || '',
      vehiculo_color: driver.vehiculo_color || '',
      vencimiento_carnet: (driver.licencia_vencimiento_str && driver.licencia_vencimiento_str !== 'No especificada') ? driver.licencia_vencimiento_str : '',
      datos_pago: driver.datos_pago || '',
      foto_perfil_base64: '',
      foto_dni_base64: '',
      foto_auto_base64: '',
      foto_carnet_base64: ''
    });
    setEditTab(initialTab);
  };

  const openPasswordModal = (driver) => {
    setPasswordModalDriver(driver);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
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
              placeholder="Buscar por DNI, Nombre o Nº Móvil..." 
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Móvil #{driver.movilStr} - {driver.nombreCompleto}</h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: driver.tipo_chofer === 'Titular' ? '#38bdf8' : '#a78bfa',
                    backgroundColor: driver.tipo_chofer === 'Titular' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(167, 139, 250, 0.14)',
                    border: `1px solid ${driver.tipo_chofer === 'Titular' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(167, 139, 250, 0.35)'}`,
                    padding: '2px 7px',
                    borderRadius: '6px'
                  }}>
                    {driver.tipo_chofer || 'Titular'}
                  </span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: '#fbbf24', 
                    backgroundColor: 'rgba(251, 191, 36, 0.12)', 
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    padding: '2px 7px', 
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    ⭐ {Number(driver.calificacion_promedio || 5.0).toFixed(1)} ({driver.total_calificaciones || 0})
                  </span>
                </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {selectedDriver.foto_url ? (
                  <img
                    src={selectedDriver.foto_url}
                    alt={selectedDriver.nombreCompleto}
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', cursor: 'pointer' }}
                    onClick={() => setZoomedPhoto({ title: `Foto de Perfil - ${selectedDriver.nombreCompleto}`, url: selectedDriver.foto_url })}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 20, color: '#94a3b8' }}>
                    {selectedDriver.nombre ? selectedDriver.nombre.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0 }}>Ficha del Chofer: {selectedDriver.nombreCompleto}</h2>
                  <span style={{ fontSize: 13, color: selectedDriver.suspendido ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                    {selectedDriver.suspendido ? '⛔ CHOFER SUSPENDIDO' : '✓ Chofer Habilitado'}
                  </span>
                </div>
              </div>
              <hr />
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Móvil Asignado:</span>
                  <strong>#{selectedDriver.movilStr} ({selectedDriver.tipo_chofer || 'Titular'})</strong>
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
                  <strong>{selectedDriver.vehiculo_str} (Patente: {selectedDriver.vehiculo_patente || 'S/D'})</strong>
                </div>
                <div className="detail-item">
                  <span>Alias / CBU:</span>
                  <strong>{selectedDriver.datos_pago || 'No especificado'}</strong>
                </div>
                <div className="detail-item">
                  <span>Calificación Pasajeros:</span>
                  <strong style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⭐ {Number(selectedDriver.calificacion_promedio || 5.0).toFixed(1)} / 5.0
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>
                      ({selectedDriver.total_calificaciones || 0} evaluaciones)
                    </span>
                  </strong>
                </div>
                
                <div className="detail-item license-status" style={{ gridColumn: '1 / -1' }}>
                  <span>Estado de Licencia:</span>
                  <div className={`badge badge-${checkLicenseStatus(selectedDriver.licencia_vencimiento_str).color}`}>
                    {checkLicenseStatus(selectedDriver.licencia_vencimiento_str).icon}
                    <strong style={{marginLeft: 5}}>{checkLicenseStatus(selectedDriver.licencia_vencimiento_str).text}</strong>
                  </div>
                  <p className="expiration-date">Vence el: {selectedDriver.licencia_vencimiento_str}</p>
                </div>

                <div className="detail-item" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: 10, marginTop: 5, flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: 12, color: '#94a3b8', display: 'block' }}>Estado Operativo de Despacho:</span>
                    <strong style={{ 
                      fontSize: 15, 
                      color: selectedDriver.estado === 'libre' ? '#10b981' : (selectedDriver.estado === 'ocupado' ? '#ef4444' : '#94a3b8') 
                    }}>
                      {selectedDriver.estado === 'libre' 
                        ? '🟢 LIBRE (Recibe viajes de la app)' 
                        : (selectedDriver.estado === 'ocupado' 
                            ? '🔴 OCUPADO (No recibe viajes de la app)' 
                            : '⚪ DESCONECTADO (Inactivo / Fuera de turno)')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedDriver.estado === 'libre' && (
                      <button 
                        className="btn btn-danger"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 'bold' }}
                        onClick={() => handleToggleEstado(selectedDriver.id, 'ocupado', 'base_telefonica')}
                      >
                        📞 Poner Ocupado (Viaje Telefónico)
                      </button>
                    )}
                    {selectedDriver.estado === 'ocupado' && (
                      <button 
                        className="btn btn-primary"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 'bold', backgroundColor: '#10b981', borderColor: '#10b981' }}
                        onClick={() => handleToggleEstado(selectedDriver.id, 'libre', 'manual')}
                      >
                        🟢 Poner Libre
                      </button>
                    )}
                    {selectedDriver.estado === 'inactivo' && (
                      <button 
                        className="btn btn-primary"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 'bold', backgroundColor: '#10b981', borderColor: '#10b981' }}
                        onClick={() => handleToggleEstado(selectedDriver.id, 'libre', 'manual')}
                      >
                        🟢 Conectar / Poner Libre
                      </button>
                    )}
                    {selectedDriver.estado !== 'inactivo' && (
                      <button 
                        className="btn"
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 'bold', backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569' }}
                        onClick={() => handleToggleEstado(selectedDriver.id, 'inactivo', 'manual')}
                      >
                        ⚪ Desconectar Chofer
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="detail-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }}
                  onClick={() => {
                    setViewingDriver(selectedDriver);
                    setViewTab('todo');
                  }}
                >
                  <Eye size={16} />
                  Consultar Datos
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => openEditModal(selectedDriver, 'personales')}
                >
                  Editar Datos
                </button>

                <button
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#111827', fontWeight: '800' }}
                  onClick={() => openPasswordModal(selectedDriver)}
                >
                  <KeyRound size={16} />
                  Cambiar Clave
                </button>

                <button 
                  className={`btn ${selectedDriver.suspendido ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => {
                    const confirmMsg = selectedDriver.suspendido 
                      ? `¿Estás seguro de que quieres habilitar a ${selectedDriver.nombre}?`
                      : `¿Estás seguro de que quieres suspender a ${selectedDriver.nombre}? No podrá iniciar sesión.`;
                    
                    if (window.confirm(confirmMsg)) {
                      apiFetch('/api/choferes/toggle-suspend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: selectedDriver.id, suspendido: !selectedDriver.suspendido })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
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

      {/* ================= MODAL: CONSULTAR DATOS COMPLETOS Y FOTOS ================= */}
      {viewingDriver && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9998, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: '16px', width: '100%', maxWidth: '880px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
            
            {/* Cabecera del Modal */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {viewingDriver.foto_url ? (
                  <img
                    src={viewingDriver.foto_url}
                    alt={viewingDriver.nombreCompleto}
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #10b981', cursor: 'pointer' }}
                    onClick={() => setZoomedPhoto({ title: `Foto de Perfil - ${viewingDriver.nombreCompleto}`, url: viewingDriver.foto_url })}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', color: '#cbd5e1' }}>
                    {viewingDriver.nombre ? viewingDriver.nombre.charAt(0).toUpperCase() : 'C'}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>{viewingDriver.nombreCompleto}</h2>
                    <span style={{ background: '#3b82f6', color: '#fff', padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                      Móvil #{viewingDriver.movilStr}
                    </span>
                    <span style={{ background: viewingDriver.suspendido ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: viewingDriver.suspendido ? '#f87171' : '#34d399', border: `1px solid ${viewingDriver.suspendido ? '#ef4444' : '#10b981'}`, padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800' }}>
                      {viewingDriver.suspendido ? 'Suspendido' : 'Habilitado'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '13px' }}>
                    DNI: <strong style={{ color: '#e2e8f0' }}>{viewingDriver.dni}</strong> • Teléfono: <strong style={{ color: '#e2e8f0' }}>{viewingDriver.telefono || 'No cargado'}</strong> • Calificación: <strong style={{ color: '#fbbf24' }}>⭐ {Number(viewingDriver.calificacion_promedio || 5.0).toFixed(1)}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingDriver(null)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#cbd5e1', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Pestañas de Consulta */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 26px', background: '#0f172a', borderBottom: '1px solid #1f2937', flexWrap: 'wrap' }}>
              {[
                { id: 'todo', label: '📋 Ficha Completa + Fotos' },
                { id: 'personales', label: '👤 Datos Personales' },
                { id: 'vehiculo', label: '🚖 Servicio y Vehículo' },
                { id: 'fotos', label: '🖼️ Fotos y Documentación' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewTab(tab.id)}
                  style={{
                    background: viewTab === tab.id ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                    color: viewTab === tab.id ? '#fff' : '#94a3b8',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Cuerpo Scrollable del Modal */}
            <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
              
              {/* SECCIÓN: DATOS PERSONALES */}
              {(viewTab === 'todo' || viewTab === 'personales') && (
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 style={{ margin: '0 0 14px 0', color: '#38bdf8', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '10px' }}>
                    <User size={18} /> Datos Personales y Licencia
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Nombre:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.nombre || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Apellido:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.apellido || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>DNI:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.dni || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Teléfono:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.telefono || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Correo Electrónico (Email):</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.email || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Fecha de Nacimiento:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.fecha_nacimiento_str}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Domicilio Real:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.domicilio || 'No cargado'}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Vencimiento Carnet de Conducir:</span>
                        <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.licencia_vencimiento_str}</strong>
                      </div>
                      <div className={`badge badge-${checkLicenseStatus(viewingDriver.licencia_vencimiento_str).color}`}>
                        {checkLicenseStatus(viewingDriver.licencia_vencimiento_str).icon}
                        <strong style={{ marginLeft: 5 }}>{checkLicenseStatus(viewingDriver.licencia_vencimiento_str).text}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN: SERVICIO Y VEHÍCULO */}
              {(viewTab === 'todo' || viewTab === 'vehiculo') && (
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <h3 style={{ margin: '0 0 14px 0', color: '#10b981', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '10px' }}>
                    <Car size={18} /> Datos del Servicio, Vehículo y Cobro
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Número de Móvil Asignado:</span>
                      <strong style={{ color: '#10b981', fontSize: '16px' }}>Móvil #{viewingDriver.movilStr}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Rol en el Móvil:</span>
                      <strong style={{ color: '#38bdf8', fontSize: '15px' }}>{viewingDriver.tipo_chofer || 'Titular'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Marca y Modelo del Vehículo:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.vehiculo_modelo || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Patente / Dominio:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.vehiculo_patente || 'No cargado'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Color del Vehículo:</span>
                      <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{viewingDriver.vehiculo_color || 'No cargado'}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Datos de Cobro (Alias / CBU / MercadoPago):</span>
                      <strong style={{ color: '#38bdf8', fontSize: '15px' }}>{viewingDriver.datos_pago || 'No especificado'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN: FOTOS Y DOCUMENTACIÓN */}
              {(viewTab === 'todo' || viewTab === 'fotos') && (
                <div style={{ background: '#1e293b', borderRadius: '12px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '10px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ImageIcon size={18} /> Fotos y Documentación Cargada
                    </h3>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Hacé clic en cualquier imagen para ampliarla a pantalla completa
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'Foto de Perfil del Chofer', url: viewingDriver.foto_url },
                      { label: 'Foto Carnet de Conducir', url: viewingDriver.carnet_foto_url },
                      { label: 'Foto del Vehículo', url: viewingDriver.vehiculo_foto_url }
                    ].map((doc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#e2e8f0', fontSize: '13px' }}>{doc.label}</strong>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: '700',
                            background: doc.url ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: doc.url ? '#34d399' : '#f87171'
                          }}>
                            {doc.url ? '✓ Cargada' : 'Sin cargar'}
                          </span>
                        </div>

                        {doc.url ? (
                          <div
                            onClick={() => setZoomedPhoto({ title: `${doc.label} - ${viewingDriver.nombreCompleto}`, url: doc.url })}
                            style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', height: '170px', background: '#020617' }}
                          >
                            <img
                              src={doc.url}
                              alt={doc.label}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              background: 'rgba(15, 23, 42, 0.85)',
                              color: '#38bdf8',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid rgba(56,189,248,0.4)'
                            }}>
                              <ZoomIn size={13} /> Ampliar
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            height: '170px',
                            borderRadius: '8px',
                            border: '1px dashed #334155',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            gap: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <ImageIcon size={28} color="#475569" />
                            <span style={{ fontSize: '12px' }}>No hay imagen cargada para este documento</span>
                            <button
                              type="button"
                              onClick={() => {
                                const driverToEdit = viewingDriver;
                                setViewingDriver(null);
                                openEditModal(driverToEdit, 'fotos');
                              }}
                              style={{
                                background: 'rgba(59,130,246,0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59,130,246,0.35)',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              + Subir foto ahora
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie del Modal de Consulta */}
            <div style={{ padding: '16px 26px', borderTop: '1px solid #1f2937', background: '#1e293b', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const d = viewingDriver;
                    setViewingDriver(null);
                    openEditModal(d, 'personales');
                  }}
                >
                  Editar Datos / Subir Fotos
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#111827', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    const d = viewingDriver;
                    openPasswordModal(d);
                  }}
                >
                  <KeyRound size={15} />
                  Cambiar Clave
                </button>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setViewingDriver(null)}
              >
                Cerrar Consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LIGHTBOX: VISTA AMPLIADA DE FOTO ================= */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 10005, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '820px', background: '#0f172a', borderRadius: '16px', padding: '18px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>{zoomedPhoto.title}</h3>
              <button
                onClick={() => setZoomedPhoto(null)}
                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕ Cerrar
              </button>
            </div>
            <img
              src={zoomedPhoto.url}
              alt={zoomedPhoto.title}
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '10px', background: '#020617' }}
            />
          </div>
        </div>
      )}

      {/* ================= MODAL: CAMBIAR / RESTABLECER CLAVE DEL CHOFER ================= */}
      {passwordModalDriver && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.78)', zIndex: 10002, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#1f2937', border: '1px solid #374151', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={22} color="#f59e0b" />
                Restablecer Clave del Chofer
              </h2>
              <button
                type="button"
                onClick={() => setPasswordModalDriver(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
              Asigná una nueva contraseña para <strong style={{ color: '#f8fafc' }}>{passwordModalDriver.nombreCompleto}</strong> (<strong style={{ color: '#10b981' }}>Móvil #{passwordModalDriver.movilStr}</strong> • DNI: {passwordModalDriver.dni}).
            </p>

            {/* Botones rápidos de restablecimiento */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Opciones rápidas de restablecimiento:</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNewPassword('123456');
                    setConfirmPassword('123456');
                    setShowPassword(true);
                  }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Clave por defecto (123456)
                </button>
                {passwordModalDriver.dni && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewPassword(String(passwordModalDriver.dni));
                      setConfirmPassword(String(passwordModalDriver.dni));
                      setShowPassword(true);
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ⚡ Usar su DNI ({passwordModalDriver.dni})
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    required
                    style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', background: '#374151', color: 'white', border: '1px solid #4b5563', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#cbd5e1' }}>Confirmar Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí la nueva contraseña..."
                  required
                  style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', background: '#374151', color: 'white', border: '1px solid #4b5563', fontSize: '14px' }}
                />
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer', marginBottom: '18px' }}>
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Mostrar contraseña en pantalla
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #374151', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setPasswordModalDriver(null)}
                  disabled={savingPassword}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: '800' }}
                  disabled={savingPassword}
                >
                  {savingPassword ? 'Guardando...' : '✓ Guardar Nueva Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDITAR DATOS DEL CHOFER ================= */}
      {editingDriver && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#1f2937', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '15px' }}>Editar Chofer</h2>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>
              <button 
                type="button" 
                onClick={() => setEditTab('personales')} 
                style={{ background: editTab === 'personales' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
              >
                Datos Personales
              </button>
              <button 
                type="button" 
                onClick={() => setEditTab('vehiculo')} 
                style={{ background: editTab === 'vehiculo' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
              >
                Servicio y Vehículo
              </button>
              <button 
                type="button" 
                onClick={() => setEditTab('fotos')} 
                style={{ background: editTab === 'fotos' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}
              >
                Fotos / Documentos
              </button>
            </div>

            <form onSubmit={handleUpdateDriver}>
              {editTab === 'personales' && (
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Nombre</label>
                    <input type="text" value={editingDriver.nombre || ''} onChange={e => setEditingDriver({...editingDriver, nombre: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Apellido</label>
                    <input type="text" value={editingDriver.apellido || ''} onChange={e => setEditingDriver({...editingDriver, apellido: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>DNI</label>
                    <input type="text" value={editingDriver.dni || ''} onChange={e => setEditingDriver({...editingDriver, dni: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="tel" value={editingDriver.telefono || ''} onChange={e => setEditingDriver({...editingDriver, telefono: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={editingDriver.email || ''} onChange={e => setEditingDriver({...editingDriver, email: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Fecha de Nacimiento</label>
                    <input type="date" value={editingDriver.fecha_nacimiento || ''} onChange={e => setEditingDriver({...editingDriver, fecha_nacimiento: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Domicilio</label>
                    <input type="text" value={editingDriver.domicilio || ''} onChange={e => setEditingDriver({...editingDriver, domicilio: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Vencimiento Carnet de Conducir</label>
                    <input type="date" value={editingDriver.vencimiento_carnet || ''} onChange={e => setEditingDriver({...editingDriver, vencimiento_carnet: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                </div>
              )}

              {editTab === 'vehiculo' && (
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Número de Móvil</label>
                    <input type="number" value={editingDriver.numero_movil || ''} onChange={e => setEditingDriver({...editingDriver, numero_movil: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Rol en el Móvil (Titular / Chofer)</label>
                    <select
                      value={editingDriver.tipo_chofer || 'Titular'}
                      onChange={e => setEditingDriver({...editingDriver, tipo_chofer: e.target.value})}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }}
                    >
                      <option value="Titular">Titular</option>
                      <option value="Chofer 1">Chofer 1</option>
                      <option value="Chofer 2">Chofer 2</option>
                      <option value="Chofer 3">Chofer 3</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Alias / CBU (Pago Anticipado)</label>
                    <input type="text" value={editingDriver.datos_pago || ''} onChange={e => setEditingDriver({...editingDriver, datos_pago: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Marca y Modelo del Vehículo</label>
                    <input type="text" placeholder="Ej: Chevrolet Corsa, Fiat Cronos..." value={editingDriver.vehiculo_modelo || ''} onChange={e => setEditingDriver({...editingDriver, vehiculo_modelo: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <input type="text" value={editingDriver.vehiculo_color || ''} onChange={e => setEditingDriver({...editingDriver, vehiculo_color: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                  <div className="form-group">
                    <label>Patente</label>
                    <input type="text" value={editingDriver.vehiculo_patente || ''} onChange={e => setEditingDriver({...editingDriver, vehiculo_patente: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#374151', color: 'white', border: 'none' }} />
                  </div>
                </div>
              )}

              {editTab === 'fotos' && (
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '10px' }}>Si subes una foto nueva, reemplazará a la existente. Si no seleccionas nada, se mantendrá la foto actual.</p>
                  
                  <div className="form-group" style={{ background: '#374151', padding: '15px', borderRadius: '8px' }}>
                    <label>Foto de Perfil del Chofer</label>
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Upload size={20} color="#9ca3af" />
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingDriver(prev => ({ ...prev, foto_perfil_base64: reader.result }));
                          reader.readAsDataURL(file);
                        }
                      }} style={{ color: 'white' }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ background: '#374151', padding: '15px', borderRadius: '8px' }}>
                    <label>Foto Carnet de Conducir</label>
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Upload size={20} color="#9ca3af" />
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingDriver(prev => ({ ...prev, foto_carnet_base64: reader.result }));
                          reader.readAsDataURL(file);
                        }
                      }} style={{ color: 'white' }} />
                    </div>
                  </div>

                  <div className="form-group" style={{ background: '#374151', padding: '15px', borderRadius: '8px' }}>
                    <label>Foto del Auto</label>
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Upload size={20} color="#9ca3af" />
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingDriver(prev => ({ ...prev, foto_auto_base64: reader.result }));
                          reader.readAsDataURL(file);
                        }
                      }} style={{ color: 'white' }} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #374151', paddingTop: '15px' }}>
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
