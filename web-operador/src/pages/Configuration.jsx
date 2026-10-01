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
    porcentaje_comision_agencia: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTarifas();
  }, []);

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
          porcentaje_comision_agencia: data.tarifas.porcentaje_comision_agencia
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

          {/* Comisión */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Porcentaje Comisión Agencia (%)</label>
            <input type="number" step="0.01" name="porcentaje_comision_agencia" value={tarifas.porcentaje_comision_agencia} onChange={handleChange} required />
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '20px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} disabled={saving}>
          <Save size={20} style={{ marginRight: '8px' }} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>
    </main>
  );
}
