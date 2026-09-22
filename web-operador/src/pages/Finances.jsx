import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote } from 'lucide-react';

const API_URL = 'https://taxis-alberdi-backend.onrender.com';

export default function Finances() {
  const [filter, setFilter] = useState('hoy');
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/finanzas/admin`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTrips(data.viajes);
        }
      })
      .catch(err => console.error("Error fetching finances:", err));
  }, []);

  // Filtrar los cancelados para la suma total
  const completedTrips = trips.filter(t => t.estado === 'finalizado');
  const totalRevenue = completedTrips.reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);
  const totalCommission = completedTrips.reduce((acc, trip) => acc + Number(trip.comision_admin || 0), 0);
  
  // Asumimos efectivo por defecto si no hay método
  const totalCash = completedTrips.filter(t => t.metodo_pago !== 'mercadopago').reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);
  const totalMP = completedTrips.filter(t => t.metodo_pago === 'mercadopago').reduce((acc, trip) => acc + Number(trip.monto_calculado || 0), 0);

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
            <h3>Comisión Agencia (15%)</h3>
            <h2>${totalCommission.toLocaleString('es-AR', {minimumFractionDigits: 2})}</h2>
            <p>A rendir por choferes</p>
          </div>
        </div>

        <div className="kpi-card digital">
          <div className="kpi-icon"><CreditCard size={24} /></div>
          <div className="kpi-data">
            <h3>Mercado Pago</h3>
            <h2>${totalMP.toLocaleString()}</h2>
            <p>Transferencias directas</p>
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
            {trips.map(trip => (
              <tr key={trip.id} className={trip.estado === 'cancelado' ? 'row-cancelled' : ''}>
                <td>{trip.id.substring(0,6)}...</td>
                <td>{new Date(trip.fecha).toLocaleString()}</td>
                <td>{trip.numero_movil ? `Móvil #${trip.numero_movil} - ${trip.chofer_nombre} ${trip.chofer_apellido}` : 'Sin asignar'}</td>
                <td>{trip.pasajero_nombre} {trip.pasajero_apellido}</td>
                <td>
                  <span className={`pay-badge ${trip.metodo_pago === 'mercadopago' ? 'pay-mp' : 'pay-cash'}`}>
                    {trip.metodo_pago || 'efectivo'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${trip.estado === 'finalizado' ? 'status-ok' : (trip.estado === 'cancelado' ? 'status-bad' : 'status-pending')}`}>
                    {trip.estado.toUpperCase()}
                  </span>
                </td>
                <td className="text-right">
                  <strong>${Number(trip.monto_calculado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
