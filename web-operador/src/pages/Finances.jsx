import React, { useState } from 'react';
import { DollarSign, TrendingUp, Calendar, CreditCard, Banknote } from 'lucide-react';

const mockTrips = [
  { id: 101, fecha: '18/09/2026 14:30', chofer: 'Móvil #14 - Juan Pérez', pasajero: 'María López', monto: 3500, pago: 'MercadoPago', estado: 'Finalizado' },
  { id: 102, fecha: '18/09/2026 15:15', chofer: 'Móvil #03 - Carlos Gómez', pasajero: 'Roberto Sánchez', monto: 2200, pago: 'Efectivo', estado: 'Finalizado' },
  { id: 103, fecha: '18/09/2026 16:00', chofer: 'Móvil #14 - Juan Pérez', pasajero: 'Lucía Fernández', monto: 4100, pago: 'Efectivo', estado: 'Finalizado' },
  { id: 104, fecha: '18/09/2026 16:45', chofer: 'Móvil #08 - Miguel Rodríguez', pasajero: 'Diego Torres', monto: 1800, pago: 'MercadoPago', estado: 'Cancelado' },
  { id: 105, fecha: '18/09/2026 17:20', chofer: 'Móvil #03 - Carlos Gómez', pasajero: 'Ana Martínez', monto: 5500, pago: 'Efectivo', estado: 'Finalizado' }
];

export default function Finances() {
  const [filter, setFilter] = useState('hoy');

  // Filtrar los cancelados para la suma total
  const completedTrips = mockTrips.filter(t => t.estado === 'Finalizado');
  const totalRevenue = completedTrips.reduce((acc, trip) => acc + trip.monto, 0);
  const totalCash = completedTrips.filter(t => t.pago === 'Efectivo').reduce((acc, trip) => acc + trip.monto, 0);
  const totalMP = completedTrips.filter(t => t.pago === 'MercadoPago').reduce((acc, trip) => acc + trip.monto, 0);

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
            <h3>En Efectivo</h3>
            <h2>${totalCash.toLocaleString()}</h2>
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
            {mockTrips.map(trip => (
              <tr key={trip.id} className={trip.estado === 'Cancelado' ? 'row-cancelled' : ''}>
                <td>#{trip.id}</td>
                <td>{trip.fecha}</td>
                <td>{trip.chofer}</td>
                <td>{trip.pasajero}</td>
                <td>
                  <span className={`pay-badge ${trip.pago === 'Efectivo' ? 'pay-cash' : 'pay-mp'}`}>
                    {trip.pago}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${trip.estado === 'Finalizado' ? 'status-ok' : 'status-bad'}`}>
                    {trip.estado}
                  </span>
                </td>
                <td className="text-right">
                  <strong>${trip.monto.toLocaleString()}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
