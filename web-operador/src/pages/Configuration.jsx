import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';

export default function Configuration() {
  const [tarifas, setTarifas] = useState({
    bajada_bandera_diurna: '',
    precio_100m_diurna: '',
    bajada_bandera_jubilados: '',
    precio_100m_jubilados: '',
    bajada_bandera_nocturna: '',
    precio_100m_nocturna: '',
    porcentaje_comision_agencia: '',
    precio_espera_hora: '',
    precio_km_extra: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [destinos, setDestinos] = useState([]);
  const [nuevoDestino, setNuevoDestino] = useState({ nombre: '', precio: '' });
  const [editingDestino, setEditingDestino] = useState(null);

  useEffect(() => {
    fetchTarifas();
    fetchDestinos();
  }, []);

  const fetchDestinos = async () => {
    try {
      const res = await fetch('https://desarrollo-remises-alberdi.onrender.com/api/destinos_fijos');
      const data = await res.json();
      if (data.success) {
        setDestinos(data.destinos);
      }
    } catch (error) {
      console.error("Error al cargar destinos fijos:", error);
    }
  };

  const fetchTarifas = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://desarrollo-remises-alberdi.onrender.com/api/tarifas');
      const data = await res.json();
      if (data.success && data.tarifas) {
        setTarifas({
          bajada_bandera_diurna: data.tarifas.bajada_bandera_diurna,
          precio_100m_diurna: data.tarifas.precio_100m_diurna,
          bajada_bandera_jubilados: data.tarifas.bajada_bandera_jubilados,
          precio_100m_jubilados: data.tarifas.precio_100m_jubilados,
          bajada_bandera_nocturna: data.tarifas.bajada_bandera_nocturna,
          precio_100m_nocturna: data.tarifas.precio_100m_nocturna,
          porcentaje_comision_agencia: data.tarifas.porcentaje_comision_agencia,
          precio_espera_hora: data.tarifas.precio_espera_hora,
          precio_km_extra: data.tarifas.precio_km_extra
        });
      }
    } catch (error) {
      console.error("Error al cargar tarifas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setTarifas({ ...tarifas, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('https://desarrollo-remises-alberdi.onrender.com/api/tarifas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarifas)
      });
      const data = await res.json();
      if (data.success) {
        alert('Configuración guardada correctamente.');
      } else {
        alert('Error al guardar configuración: ' + data.error);
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDestino = async (e) => {
    e.preventDefault();
    if (!nuevoDestino.nombre || !nuevoDestino.precio) return;
    try {
      const res = await fetch('https://desarrollo-remises-alberdi.onrender.com/api/destinos_fijos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoDestino)
      });
      const data = await res.json();
      if (data.success) {
        setDestinos([...destinos, data.destino]);
        setNuevoDestino({ nombre: '', precio: '' });
      }
    } catch (error) {
      alert('Error al agregar destino');
    }
  };

  const handleDeleteDestino = async (id) => {
    if (!window.confirm('¿Eliminar destino?')) return;
    try {
      const res = await fetch(`https://desarrollo-remises-alberdi.onrender.com/api/destinos_fijos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDestinos(destinos.filter(d => d.id !== id));
      }
    } catch (error) {
      alert('Error al eliminar destino');
    }
  };

  const handleUpdateDestino = async (id, nombre, precio) => {
    if (!nombre || !precio) return;
    try {
      const res = await fetch(`https://desarrollo-remises-alberdi.onrender.com/api/destinos_fijos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, precio })
      });
      const data = await res.json();
      if (data.success) {
        setDestinos(destinos.map(d => d.id === id ? data.destino : d));
        setEditingDestino(null);
      }
    } catch (error) {
      alert('Error al actualizar destino');
    }
  };

  if (loading) return <div className="content"><h2>Cargando configuración...</h2></div>;

  return (
    <main className="content">
      <header>
        <h1><Settings size={28} style={{ marginRight: 10, verticalAlign: 'middle' }} /> Configuración del Sistema</h1>
      </header>

      <form onSubmit={handleSave} className="finance-summary" style={{ display: 'block', maxWidth: '800px', background: '#1f2937', padding: '20px', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>Modificar Tarifas</h2>
        
        <div className="form-grid">
          {/* Tarifa Diurna */}
          <div className="form-group">
            <label>Bajada de Bandera (Diurna)</label>
            <input type="number" step="0.01" name="bajada_bandera_diurna" value={tarifas.bajada_bandera_diurna} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Precio c/ 100m (Diurna)</label>
            <input type="number" step="0.01" name="precio_100m_diurna" value={tarifas.precio_100m_diurna} onChange={handleChange} required />
          </div>

          {/* Tarifa Nocturna */}
          <div className="form-group">
            <label>Bajada de Bandera (Nocturna)</label>
            <input type="number" step="0.01" name="bajada_bandera_nocturna" value={tarifas.bajada_bandera_nocturna} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Precio c/ 100m (Nocturna)</label>
            <input type="number" step="0.01" name="precio_100m_nocturna" value={tarifas.precio_100m_nocturna} onChange={handleChange} required />
          </div>

          {/* Tarifa Jubilados */}
          <div className="form-group">
            <label>Bajada de Bandera (Jubilados)</label>
            <input type="number" step="0.01" name="bajada_bandera_jubilados" value={tarifas.bajada_bandera_jubilados} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Precio c/ 100m (Jubilados)</label>
            <input type="number" step="0.01" name="precio_100m_jubilados" value={tarifas.precio_100m_jubilados} onChange={handleChange} required />
          </div>

          {/* Otros Costos */}
          <div className="form-group">
            <label>Hora de Espera ($)</label>
            <input type="number" step="0.01" name="precio_espera_hora" value={tarifas.precio_espera_hora} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Kilómetro Extra ($) (Interurbano)</label>
            <input type="number" step="0.01" name="precio_km_extra" value={tarifas.precio_km_extra} onChange={handleChange} required />
          </div>

          {/* Comisión */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Porcentaje Comisión Agencia (%)</label>
            <input type="number" step="0.01" name="porcentaje_comision_agencia" value={tarifas.porcentaje_comision_agencia} onChange={handleChange} required />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-large" style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={saving}>
          <Save size={20} style={{ marginRight: '8px' }} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>

      {/* Destinos Fijos Section */}
      <div className="finance-summary" style={{ display: 'block', maxWidth: '800px', background: '#1f2937', padding: '20px', borderRadius: '12px', marginTop: '20px' }}>
        <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>Destinos Fijos (Larga Distancia)</h2>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
          {destinos.map(d => (
            <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #374151' }}>
              {editingDestino?.id === d.id ? (
                <>
                  <input type="text" value={editingDestino.nombre} onChange={(e) => setEditingDestino({ ...editingDestino, nombre: e.target.value })} style={{ flex: 1, padding: '5px', marginRight: '10px', borderRadius: '5px', border: '1px solid #374151', background: '#111827', color: '#fff' }} />
                  <input type="number" step="0.01" value={editingDestino.precio} onChange={(e) => setEditingDestino({ ...editingDestino, precio: e.target.value })} style={{ width: '100px', padding: '5px', marginRight: '10px', borderRadius: '5px', border: '1px solid #374151', background: '#111827', color: '#fff' }} />
                  <span>
                    <button onClick={() => handleUpdateDestino(d.id, editingDestino.nombre, editingDestino.precio)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' }}>✓</button>
                    <button onClick={() => setEditingDestino(null)} style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>X</button>
                  </span>
                </>
              ) : (
                <>
                  <span>{d.nombre_destino}</span>
                  <span>
                    <b style={{ marginRight: '15px' }}>${d.precio_fijo}</b>
                    <button onClick={() => setEditingDestino({ id: d.id, nombre: d.nombre_destino, precio: d.precio_fijo })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px' }}>✎</button>
                    <button onClick={() => handleDeleteDestino(d.id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>X</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddDestino} style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Nombre Destino" value={nuevoDestino.nombre} onChange={(e) => setNuevoDestino({ ...nuevoDestino, nombre: e.target.value })} required style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #374151', background: '#111827', color: '#fff' }} />
          <input type="number" step="0.01" placeholder="Precio ($)" value={nuevoDestino.precio} onChange={(e) => setNuevoDestino({ ...nuevoDestino, precio: e.target.value })} required style={{ width: '120px', padding: '10px', borderRadius: '5px', border: '1px solid #374151', background: '#111827', color: '#fff' }} />
          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' }}>Agregar</button>
        </form>
      </div>

    </main>
  );
}
