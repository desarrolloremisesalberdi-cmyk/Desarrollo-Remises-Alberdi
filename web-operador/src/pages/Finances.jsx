import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CreditCard, 
  Banknote, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  X, 
  RotateCcw 
} from 'lucide-react';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function Finances() {
  // Modos principales: 'semana', 'quincena', 'mes', 'hoy', 'todo'
  const [periodType, setPeriodType] = useState('semana');
  // Para quincenas: 1 (1 al 15) o 2 (16 al fin de mes)
  const [quincenaHalf, setQuincenaHalf] = useState(new Date().getDate() <= 15 ? 1 : 2);
  // Offsets de navegación para retroceder / avanzar semanas o meses
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Filtro por Chofer
  const [selectedDriver, setSelectedDriver] = useState('todos');

  // Datos
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

  // Consolidar lista de choferes
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
    return list.sort((a, b) => Number(a.numero_movil || 0) - Number(b.numero_movil || 0));
  }, [drivers, trips]);

  // Cálculo didáctico del rango de fechas activo
  const rangeInfo = useMemo(() => {
    const now = new Date();

    if (periodType === 'todo') {
      return {
        start: null,
        end: null,
        badge: 'Historial',
        label: 'Histórico Completo (Sin límite de fecha)',
        sublabel: 'Mostrando la totalidad de viajes registrados en el sistema'
      };
    }

    if (periodType === 'hoy') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const dayName = now.toLocaleDateString('es-AR', { weekday: 'long' });
      const formatted = now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
      return {
        start,
        end,
        badge: 'Hoy',
        label: `Hoy: ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${formatted}`,
        sublabel: 'Viajes realizados en la jornada de hoy (00:00 a 23:59 hs)'
      };
    }

    if (periodType === 'semana') {
      // Semana en curso: De Domingo a Domingo
      const target = new Date(now);
      if (weekOffset !== 0) {
        target.setDate(target.getDate() + (weekOffset * 7));
      }
      const dayOfWeek = target.getDay(); // 0 es Domingo
      // Domingo que inicia la semana
      const start = new Date(target.getFullYear(), target.getMonth(), target.getDate() - dayOfWeek, 0, 0, 0, 0);
      // Domingo que cierra la semana (7 días después a las 23:59:59)
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 23, 59, 59, 999);

      const monthName = end.toLocaleDateString('es-AR', { month: 'long' });
      const year = end.getFullYear();

      return {
        start,
        end,
        badge: weekOffset === 0 ? 'Semana en Curso' : (weekOffset === -1 ? 'Semana Anterior' : 'Semana Seleccionada'),
        label: `Semana: Domingo ${start.getDate()} al Domingo ${end.getDate()} de ${monthName} de ${year}`,
        sublabel: 'Filtro de domingo a domingo (7 días completos con cierre el domingo a las 23:59 hs)'
      };
    }

    if (periodType === 'quincena') {
      const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      const monthName = target.toLocaleDateString('es-AR', { month: 'long' });
      const year = target.getFullYear();

      if (quincenaHalf === 1) {
        const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(target.getFullYear(), target.getMonth(), 15, 23, 59, 59, 999);
        return {
          start,
          end,
          badge: '1ª Quincena',
          label: `1ª Quincena de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} (1 al 15)`,
          sublabel: `Liquidación del 01 al 15 de ${monthName} de ${year}`
        };
      } else {
        const start = new Date(target.getFullYear(), target.getMonth(), 16, 0, 0, 0, 0);
        const end = new Date(target.getFullYear(), target.getMonth(), lastDay, 23, 59, 59, 999);
        return {
          start,
          end,
          badge: '2ª Quincena',
          label: `2ª Quincena de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} (16 al ${lastDay})`,
          sublabel: `Liquidación del 16 al ${lastDay} de ${monthName} de ${year}`
        };
      }
    }

    if (periodType === 'mes') {
      const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      const monthName = target.toLocaleDateString('es-AR', { month: 'long' });
      const year = target.getFullYear();
      const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(target.getFullYear(), target.getMonth(), lastDay, 23, 59, 59, 999);
      return {
        start,
        end,
        badge: 'Mes Completo',
        label: `Mes de ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`,
        sublabel: `Del 01 al ${lastDay} de ${monthName} de ${year}`
      };
    }

    return { start: null, end: null, badge: '', label: '', sublabel: '' };
  }, [periodType, quincenaHalf, weekOffset, monthOffset]);

  // Filtrado de viajes aplicando Chofer y Rango de Fecha activo
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

      // 2. Filtro por Rango de Fecha
      if (rangeInfo.start && rangeInfo.end) {
        if (!trip.fecha) return false;
        const tripDate = new Date(trip.fecha);
        if (isNaN(tripDate.getTime())) return false;
        if (tripDate < rangeInfo.start || tripDate > rangeInfo.end) return false;
      }

      return true;
    });
  }, [trips, selectedDriver, rangeInfo, driverOptions]);

  // Cálculos sobre los viajes filtrados
  const completedTrips = useMemo(() => filteredTrips.filter(t => t.estado === 'finalizado'), [filteredTrips]);
  const totalRevenue = useMemo(() => completedTrips.reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);
  const totalCommission = useMemo(() => completedTrips.reduce((acc, t) => acc + Number(t.comision_admin || 0), 0), [completedTrips]);
  const totalCash = useMemo(() => completedTrips.filter(t => t.metodo_pago !== 'mercadopago' && t.metodo_pago !== 'transferencia').reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);
  const totalDigital = useMemo(() => completedTrips.filter(t => t.metodo_pago === 'mercadopago' || t.metodo_pago === 'transferencia').reduce((acc, t) => acc + Number(t.monto_calculado || 0), 0), [completedTrips]);

  // Info del chofer seleccionado si no es 'todos'
  const currentDriverObj = driverOptions.find(d => String(d.id) === String(selectedDriver));

  return (
    <div className="page-container">
      <header className="page-header" style={{ marginBottom: '15px' }}>
        <div>
          <h1>Reportes y Finanzas</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
            Control de caja, liquidaciones a choferes y auditoría de recaudación
          </p>
        </div>
      </header>

      {/* PANEL DIDÁCTICO DE FILTROS: PERÍODO Y CHOFER */}
      <div className="period-control-card">
        {/* Fila 1: Botones de Modo de Período y Filtro de Chofer */}
        <div className="period-control-top">
          {/* Botones didácticos de período */}
          <div className="period-tabs">
            <button
              type="button"
              className={`period-tab ${periodType === 'semana' ? 'active' : ''}`}
              onClick={() => { setPeriodType('semana'); setWeekOffset(0); }}
            >
              <Calendar size={14} /> Semana
            </button>

            <button
              type="button"
              className={`period-tab ${periodType === 'quincena' ? 'active' : ''}`}
              onClick={() => { 
                setPeriodType('quincena'); 
                setMonthOffset(0); 
                setQuincenaHalf(new Date().getDate() <= 15 ? 1 : 2);
              }}
            >
              <Calendar size={14} /> Quincena
            </button>

            <button
              type="button"
              className={`period-tab ${periodType === 'mes' ? 'active' : ''}`}
              onClick={() => { setPeriodType('mes'); setMonthOffset(0); }}
            >
              <Calendar size={14} /> Mensual
            </button>

            <button
              type="button"
              className={`period-tab ${periodType === 'hoy' ? 'active' : ''}`}
              onClick={() => { setPeriodType('hoy'); }}
            >
              Hoy
            </button>

            <button
              type="button"
              className={`period-tab ${periodType === 'todo' ? 'active' : ''}`}
              onClick={() => { setPeriodType('todo'); }}
            >
              Histórico
            </button>
          </div>

          {/* Filtro por Chofer */}
          <div className="driver-selector-box">
            <User size={16} color="#60a5fa" />
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Chofer:</span>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="driver-select"
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
        </div>

        {/* Fila 2: Explicación Didáctica del Rango y Sub-controles de Navegación */}
        <div className="period-control-bottom">
          <div className="period-description">
            <div className="period-main-text">
              <span className="badge-tag">{rangeInfo.badge}</span>
              <strong>{rangeInfo.label}</strong>
            </div>
            <span className="period-sub-text">{rangeInfo.sublabel}</span>
          </div>

          {/* Sub-controles dinámicos según el modo seleccionado */}
          {periodType === 'semana' && (
            <div className="sub-controls-group">
              <button
                type="button"
                className="arrow-btn"
                onClick={() => setWeekOffset(prev => prev - 1)}
                title="Semana anterior de domingo a domingo"
              >
                <ChevronLeft size={15} /> Semana anterior
              </button>

              {weekOffset !== 0 && (
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => setWeekOffset(0)}
                  title="Volver a la semana en curso"
                >
                  <RotateCcw size={12} style={{ display: 'inline', marginRight: 4 }} /> Semana actual
                </button>
              )}

              <button
                type="button"
                className="arrow-btn"
                onClick={() => setWeekOffset(prev => prev + 1)}
                title="Semana siguiente de domingo a domingo"
              >
                Semana siguiente <ChevronRight size={15} />
              </button>
            </div>
          )}

          {periodType === 'quincena' && (
            <div className="sub-controls-group">
              <button
                type="button"
                className={`half-btn ${quincenaHalf === 1 ? 'active' : ''}`}
                onClick={() => setQuincenaHalf(1)}
              >
                1ª Quincena (1 al 15)
              </button>
              <button
                type="button"
                className={`half-btn ${quincenaHalf === 2 ? 'active' : ''}`}
                onClick={() => setQuincenaHalf(2)}
              >
                2ª Quincena (16 al fin)
              </button>

              <button
                type="button"
                className="arrow-btn"
                onClick={() => setMonthOffset(prev => prev - 1)}
                title="Mes anterior"
                style={{ marginLeft: 6 }}
              >
                <ChevronLeft size={15} /> Mes ant.
              </button>

              {monthOffset !== 0 && (
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => setMonthOffset(0)}
                >
                  Mes actual
                </button>
              )}

              <button
                type="button"
                className="arrow-btn"
                onClick={() => setMonthOffset(prev => prev + 1)}
                title="Mes siguiente"
              >
                Mes sig. <ChevronRight size={15} />
              </button>
            </div>
          )}

          {periodType === 'mes' && (
            <div className="sub-controls-group">
              <button
                type="button"
                className="arrow-btn"
                onClick={() => setMonthOffset(prev => prev - 1)}
                title="Mes anterior"
              >
                <ChevronLeft size={15} /> Mes anterior
              </button>

              {monthOffset !== 0 && (
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => setMonthOffset(0)}
                >
                  Mes actual
                </button>
              )}

              <button
                type="button"
                className="arrow-btn"
                onClick={() => setMonthOffset(prev => prev + 1)}
                title="Mes siguiente"
              >
                Mes siguiente <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
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
            {selectedDriver !== 'todos' && currentDriverObj ? ` de Móvil #${currentDriverObj.numero_movil}` : ''}
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
                  No se encontraron viajes para el período y chofer seleccionados
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