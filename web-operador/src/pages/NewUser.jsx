import React, { useState } from 'react';
import { UserPlus, Car, Upload } from 'lucide-react';

export default function NewUser() {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    domicilio: '',
    dni: '',
    fecha_nacimiento: '',
    numero_movil: '',
    vehiculo_modelo: '',
    vehiculo_color: '',
    vehiculo_patente: '',
    vehiculo_puertas: '4', // Por defecto 4 según requerimientos
    datos_cobro: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Chofer registrado con éxito (Simulación)');
    console.log('Datos enviados:', formData);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Registrar Nuevo Usuario Chofer</h1>
      </header>

      <div className="form-container">
        <form onSubmit={handleSubmit} className="new-user-form">
          
          <div className="form-section">
            <h2 className="section-title"><UserPlus size={20} /> Datos Personales</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Domicilio</label>
                <input type="text" name="domicilio" value={formData.domicilio} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>DNI</label>
                <input type="text" name="dni" value={formData.dni} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Vencimiento Carnet de Conducir</label>
                <input type="date" name="licencia_vencimiento" onChange={handleChange} required />
              </div>
              <div className="form-group file-upload">
                <label>Foto Carnet de Conducir</label>
                <div className="upload-box">
                  <Upload size={16} /> Subir Imagen
                  <input type="file" accept="image/*" />
                </div>
              </div>
              <div className="form-group file-upload">
                <label>Foto Frente DNI</label>
                <div className="upload-box">
                  <Upload size={16} /> Subir Imagen
                  <input type="file" accept="image/*" />
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title"><Car size={20} /> Datos del Servicio y Vehículo</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Número de Móvil Asignado</label>
                <input type="number" name="numero_movil" value={formData.numero_movil} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Datos de Cobro (CBU/Alias/MercadoPago)</label>
                <input type="text" name="datos_cobro" value={formData.datos_cobro} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Modelo del Vehículo</label>
                <input type="text" name="vehiculo_modelo" value={formData.vehiculo_modelo} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="text" name="vehiculo_color" value={formData.vehiculo_color} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Patente</label>
                <input type="text" name="vehiculo_patente" value={formData.vehiculo_patente} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Cantidad de Puertas (Obligatorio 4)</label>
                <select name="vehiculo_puertas" value={formData.vehiculo_puertas} onChange={handleChange}>
                  <option value="4">4 Puertas</option>
                  <option value="2" disabled>2 Puertas (No permitido)</option>
                </select>
              </div>
              <div className="form-group file-upload">
                <label>Foto del Auto</label>
                <div className="upload-box">
                  <Upload size={16} /> Subir Imagen
                  <input type="file" accept="image/*" />
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-large">Crear Chofer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
