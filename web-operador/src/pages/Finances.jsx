import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote, User, FileText, X, CheckCircle, Clock } from 'lucide-react';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function Finances() {
  const [filter, setFilter] = useState('quincena_actual');
  const [selectedDriver, setSelectedDriver] = useState('todos');
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [tarifas, setTarifas] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);

  useEffect(() => {
    // 1. Obtener viajes para finanzas
    fetch(`${API_URL}/api/finanzas/admin`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.viajes)) {
          setTrips(data.viajes);
        }
      })
      .catch(err => console.error("Error fetching finances:", err));

    // 2. Obtener lista completa de choferes registrados
    fetch(`${API_URL}/api/choferes`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.choferes)) {
          setDrivers(data.choferes);
        }
      })
      .catch(err => console.error("Error fetching choferes:", err));

    // 3. Obtener configuración de tarifas
    fetch(`${API_URL}/api/tarifas`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTarifas(data.tarifas);
        }
      })
      .catch(err => console.error("Error fetching tarifas:", err));
  }, []);

  // Consolidar opciones de choferes (los de la BD + cualquier chofer que tenga viajes asignados)
  const driverOptions = useMemo(() => {
    const list = [...drivers];
    trips.forEach(t => {
      if (t.chofer_id && !list.some(d => String(d.id) === String(t.chofer_id))) {
        list.push({
          id: t.chofer_id,
          nombre: t.chofer_nombre || 'Chofer',
          apellido: t.chofer_apellido || '',
          numero_movil: t.numero_movil || '?'
        });
      }
    });
    // Ordenar por número de móvil si es posible
    return list.sort((a, b) => Number(a.numero_movil || 0) - Number(b.numero_movil || 0));
  }, [drivers, trips]);

  // Función para determinar si una fecha está en el rango seleccionado
  const isWithinDateFilter = (fechaStr, filterType) => {
    if (!fechaStr) return false;
    const tripDate = new Date(fechaStr);
    if (isNaN(tripDate.getTime())) return false;

    const now = new Date();

    switch (filterType) {
      case 'hoy': {
        return tripDate.getDate() === now.getDate() &&
               tripDate.getMonth() === now.getMonth() &&
               tripDate.getFullYear() === now.getFullYear();
      }

      case 'quincena_actual': {
        const isFirstHalf = now.getDate() <= 15;
        const start = new Date(now.getFullYear(), now.getMonth(), isFirstHalf ? 1 : 16, 0, 0, 0);
        const end = isFirstHalf
          ? new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59, 999)
          : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return tripDate >= start && tripDate <= end;
      }

      case 'ultimos_15_dias': {
        const fifteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15, 0, 0, 0);
        return tripDate >= fifteenDaysAgo && tripDate <= now;
      }

      case 'quincena_1': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59, 999);
        return tripDate >= start && tripDate <= end;
      }

      case 'quincena_2': {
        const start = new Date(now.getFullYear(), now.getMonth(), 16, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return tripDate >= start && tripDate <= end;
      }

      case 'semana': {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        return tripDate >= sevenDaysAgo && tripDate <= now;
      }

      case 'mes': {
        return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
      }

      case 'todos':
      default:
        return true;
    }
  };

  // Filtrado de viajes aplicando Chofer y Fecha
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      // 1. Filtro de Chofer
      if (selectedDriver !== 'todos') {
        if (selectedDriver === 'sin_asignar') {
          if (trip.chofer_id || trip.numero_movil) return false;
        } else {
          const matchId = trip.chofer_id && String(trip.chofer_id) === String(selectedDriver);
          const selDriver = driverOptions.find(d => String(d.id) === String(selectedDriver));
          const matchMovil = selDriver?.numero_movil && trip.numero_movil && String(selDriver.numero_movil) === String(trip.numero_movil);
          if (!matchId && !matchMovil) return false;
        }
      }

      // 2. Filtro de Fecha / Período
      return isWithinDateFilter(trip.fecha, filter);
    });
  }, [trips, selectedDriver, filter, driverOptions]);

  // Cálculos sobre los viajes filtrados
  const completedTrips = useMemo(() => filteredTrips.filter(t => t.estado === 'finalizado'), [filteredTrips]);
  const totalRevenue = useMemo(() => completedTrips.reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);
  const totalCommission = useMemo(() => completedTrips.reduce((acc, t) => acc + Number(t.comision_admin || 0), 0), [completedTrips]);
  const totalCash = useMemo(() => completedTrips.filter(t => t.metodo_pago !== 'mercadopago' && t.metodo_pago !== 'transferencia').reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);
  const totalDigital = useMemo(() => completedTrips.filter(t => t.metodo_pago === 'mercadopago' || t.metodo_pago === 'transferencia').reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);

  // Info del chofer seleccionado si no es 'todos'
  const currentDriverObj = driverOptions.find(d => String(d.id) === String(selectedDriver));

  // Etiquetas para las opciones del selector de fecha
  const now = new Date();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonthName = monthNames[now.getMonth()];
  const isFirstHalf = now.getDate() <= 15;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <div className="page-container">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1>Reportes y Finanzas</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
            Liquidaciones de choferes, comisiones de agencia y auditoría de viajes
          </p>
        </div>

        <div className="filter-group">
          {/* Selector de Chofer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#94a3b8" />
            <select 
              value={selectedDriver} 
              onChange={(e) => setSelectedDriver(e.target.value)} 
              className="date-filter"
              title="Filtrar por Chofer"
            >
              <option value="todos">Todos los Choferes</option>
              {driverOptions.map(driver => (
                <option key={driver.id} value={String(driver.id)}>
                  {`Móvil #${driver.numero_movil || '?'} - ${driver.nombre} ${driver.apellido || ''}`.trim()}
                </option>
              ))}
              <option value="sin_asignar">Sin Asignar</option>
            </select>
          </div>

          {/* Selector de Período / Quincena */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#94a3b8" />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)} 
              className="date-filter"
              title="Filtrar por Período / Quincena"
            >
              <option value="quincena_actual">
                Quincena Actual ({isFirstHalf ? '1 al 15' : `16 al ${lastDayOfMonth}`} de {currentMonthName})
              </option>
              <option value="ultimos_15_dias">Últimos 15 Días</option>
              <option value="quincena_1">1ª Quincena (1 al 15 de {currentMonthName})</option>
              <option value="quincena_2">2ª Quincena (16 al {lastDayOfMonth} de {currentMonthName})</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta Semana (Últimos 7 días)</option>
              <option value="mes">Este Mes ({currentMonthName})</option>
              <option value="todos">Histórico Completo</option>
            </select>
          </div>
        </div>
      </header>

      {/* Tarjetas KPI */}
      <div className="kpi-grid">
        <div className="kpi-card total">
          <div className="kpi-icon"><DollarSign size={24} /></div>
          <div className="kpi-data">
            <h3>{selectedDriver !== 'todos' && currentDriverObj ? `Recaudación Móvil #${currentDriverObj.numero_movil || '?'}` : 'Recaudación Total'}</h3>
            <h2>${totalRevenue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</h2>
            <p>
              {completedTrips.length} {completedTrips.length === 1 ? 'viaje completado' : 'viajes completados'}
              {selectedDriver !== 'todos' && currentDriverObj ? ` (${currentDriverObj.nombre} ${currentDriverObj.apellido || ''})` : ''}
            </p>
          </div>
        </div>

        <div className="kpi-card cash">
          <div className="kpi-icon"><Banknote size={24} /></div>
          <div className="kpi-data">
            <h3>Comisión Agencia {tarifas ? `(${tarifas.porcentaje_comision_agencia}%)` : ''}</h3>
            <h2>${totalCommission.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <p>
              {selectedDriver !== 'todos' && currentDriverObj 
                ? `A rendir por Móvil #${currentDriverObj.numero_movil || '?'}` 
                : 'A rendir por choferes'}
            </p>
          </div>
        </div>

        <div className="kpi-card digital">
          <div className="kpi-icon"><CreditCard size={24} /></div>
          <div className="kpi-data">
            <h3>Transferencias / Digital</h3>
            <h2>${totalDigital.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</h2>
            <p>Efectivo en mano: ${totalCash.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Tabla de Viajes Filtrados */}
      <div className="table-container">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2><TrendingUp size={20} style={{ marginRight: 10 }} /> Historial de Viajes</h2>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            Mostrando {filteredTrips.length} {filteredTrips.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        <table className="trips-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha y Hora</th>
              <th>Chofer</th>
              <th>Pasajero</th>
              <th>Método de Pago</th>
              <th>Estado</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '35px', color: '#94a3b8' }}>
                  No se encontraron viajes para los filtros seleccionados
                </td>
              </tr>
            ) : (
              filteredTrips.map(trip => (
                <tr key={trip.id} className={trip.estado === 'cancelado' ? 'row-cancelled' : ''}>
                  <td>#{String(trip.id)}</td>
                  <td>{trip.fecha ? new Date(trip.fecha).toLocaleString('es-AR') : 'N/A'}</td>
                  <td>
                    {trip.numero_movil 
                      ? `Móvil #${trip.numero_movil} - ${trip.chofer_nombre || ''} ${trip.chofer_apellido || ''}`.trim() 
                      : (trip.chofer_nombre ? `${trip.chofer_nombre} ${trip.chofer_apellido || ''}`.trim() : 'Sin asignar')}
                  </td>
                  <td>{trip.pasajero_nombre || 'Pasajero'} {trip.pasajero_apellido || ''}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`pay-badge ${(trip.metodo_pago === 'mercadopago' || trip.metodo_pago === 'transferencia') ? 'pay-mp' : 'pay-cash'}`}>
                        {trip.metodo_pago === 'transferencia' ? 'transferencia' : (trip.metodo_pago || 'efectivo')}
                      </span>
                      {trip.comprobante_url && (
                        <button
                          type="button"
                          onClick={() => setReceiptModal(trip)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Ver Comprobante de Transferencia"
                        >
                          <FileText size={12} /> Comprobante
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${trip.estado === 'finalizado' ? 'status-ok' : (trip.estado === 'cancelado' ? 'status-bad' : 'status-pending')}`}>
                      {String(trip.estado || 'solicitado').toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right">
                    <strong>${Number(trip.monto_calculado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para ver comprobante de pago */}
      {receiptModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setReceiptModal(null)}
        >
          <div 
            style={{
              background: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#3b82f6" /> Comprobante de Transferencia (Viaje #{receiptModal.id})
              </h3>
              <button 
                onClick={() => setReceiptModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
              <p><strong>Pasajero:</strong> {receiptModal.pasajero_nombre} {receiptModal.pasajero_apellido || ''}</p>
              <p><strong>Monto:</strong> ${Number(receiptModal.monto_calculado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p><strong>Estado del comprobante:</strong> {receiptModal.comprobante_estado ? String(receiptModal.comprobante_estado).toUpperCase() : 'SUBIDO'}</p>
            </div>

            <div style={{ textAlign: 'center', background: '#0f172a', padding: '10px', borderRadius: '8px' }}>
              <img 
                src={receiptModal.comprobante_url} 
                alt="Comprobante de pago" 
                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>

            <button 
              onClick={() => setReceiptModal(null)}
              style={{
                background: '#3b82f6',
                color: '#fff',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '5px'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}