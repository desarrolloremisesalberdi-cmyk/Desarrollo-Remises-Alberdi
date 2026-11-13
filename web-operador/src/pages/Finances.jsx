import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote } from 'lucide-react';

const API_URL = 'https://desarrollo-remises-alberdi.onrender.com';

export default function Finances() {
  const [filter, setFilter] = useState('hoy');
  const [trips, setTrips] = useState([]);
  const [tarifas, setTarifas] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/finanzas/admin`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTrips(data.viajes);
        }
      })
      .catch(err => console.error("Error fetching finances:", err));

    fetch(`${API_URL}/api/tarifas`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTarifas(data.tarifas);
        }
      })
      .catch(err => console.error("Error fetching tarifas:", err));
  }, []);

  // Filtrar los cancelados para la suma total
  const completedTrips = trips.filter(t => t.estado === 'finalizado');
  const totalRevenue = completedTrips.reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);
  const totalCommission = completedTrips.reduce((acc, trip) => acc + Number(trip.comision_admin || 0), 0);
  
  // Asumimos efectivo por defecto si no hay método
  const totalCash = completedTrips.filter(t => t.metodo_pago !== 'mercadopago' && t.metodo_pago !== 'transferencia').reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);
  const totalDigital = completedTrips.filter(t => t.metodo_pago === 'mercadopago' || t.metodo_pago === 'transferencia').reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Reportes y Finanzas</h1>
        <div className="filter-group">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="date-filter">
            <option value="hoy">Hoy</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mes</option>
          </select>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card total">
          <div className="kpi-icon"><DollarSign size={24} /></div>
          <div className="kpi-data">
            <h3>Recaudación Total</h3>
            <h2>${totalRevenue.toLocaleString()}</h2>
            <p>{completedTrips.length} viajes completados</p>
          </div>
        </div>

        <div className="kpi-card cash">
          <div className="kpi-icon"><Banknote size={24} /></div>
          <div className="kpi-data">
            <h3>Comisión Agencia {tarifas ? `(${tarifas.porcentaje_comision_agencia}%)` : ''}</h3>
            <h2>${totalCommission.toLocaleString('es-AR', {minimumFractionDigits: 2})}</h2>
            <p>A rendir por choferes</p>
          </div>
        </div>

        <div className="kpi-card digital">
          <div className="kpi-icon"><CreditCard size={24} /></div>
          <div className="kpi-data">
            <h3>Transferencias / Digital</h3>
            <h2>${totalDigital.toLocaleString()}</h2>
            <p>Transferencias directas y MP</p>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2><TrendingUp size={20} style={{marginRight: 10}} /> Historial de Viajes</h2>
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
            {trips.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  No hay registros de viajes para mostrar
                </td>
              </tr>
            ) : (
              trips.map(trip => (
                <tr key={trip.id} className={trip.estado === 'cancelado' ? 'row-cancelled' : ''}>
                  <td>#{String(trip.id)}</td>
                  <td>{trip.fecha ? new Date(trip.fecha).toLocaleString() : 'N/A'}</td>
                  <td>{trip.numero_movil ? `Móvil #${trip.numero_movil} - ${trip.chofer_nombre || ''} ${trip.chofer_apellido || ''}`.trim() : 'Sin asignar'}</td>
                  <td>{trip.pasajero_nombre || 'Pasajero'} {trip.pasajero_apellido || ''}</td>
                  <td>
                    <span className={`pay-badge ${(trip.metodo_pago === 'mercadopago' || trip.metodo_pago === 'transferencia') ? 'pay-mp' : 'pay-cash'}`}>
                      {trip.metodo_pago === 'transferencia' ? 'transferencia' : (trip.metodo_pago || 'efectivo')}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${trip.estado === 'finalizado' ? 'status-ok' : (trip.estado === 'cancelado' ? 'status-bad' : 'status-pending')}`}>
                      {String(trip.estado || 'solicitado').toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right">
                    <strong>${Number(trip.monto_calculado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
