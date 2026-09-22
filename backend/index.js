require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./config/db'); // Esto inicia la conexión a DB

// Utils
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1.3; // Factor 1.3 para aproximar a distancia real por calles
}

function getTarifaType() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = now.getHours();
  // Domingo (0) todo el día es tarifa 3 (Nocturna)
  if (day === 0) return 'nocturna';
  // Lunes a Sábado: Nocturna es de 22 a 06
  if (hour >= 22 || hour < 6) return 'nocturna';
  // Resto es Diurna
  return 'diurna';
}



const app = express();
const server = http.createServer(app);

// Configuración de CORS
app.use(cors({
  origin: '*', // Permitir peticiones desde cualquier origen (para desarrollo)
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Rutas básicas (Servir Dashboard Temporal)
const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Registrar o iniciar sesión de Pasajero
app.post('/api/users/register', async (req, res) => {
  const { nombre, apellido, telefono, es_jubilado } = req.body;
  try {
    // Buscar si el usuario ya existe por su teléfono
    const existingUser = await db.query('SELECT * FROM usuarios WHERE telefono = $1', [telefono]);
    if (existingUser.rows.length > 0) {
      // Si ya existe, actualizamos su estado de jubilado por si cambió
      await db.query('UPDATE usuarios SET es_jubilado = $1 WHERE telefono = $2', [es_jubilado || false, telefono]);
      existingUser.rows[0].es_jubilado = es_jubilado || false;
      return res.json({ success: true, user: existingUser.rows[0], message: 'Sesión iniciada' });
    }
    
    // Si no existe, lo creamos
    const newUser = await db.query(
      'INSERT INTO usuarios (nombre, apellido, telefono, es_jubilado) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, apellido || '', telefono, es_jubilado || false]
    );
    res.json({ success: true, user: newUser.rows[0], message: 'Usuario registrado' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Solicitar un viaje
app.post('/api/viajes/request', async (req, res) => {
  const { usuario_id, origen_lat, origen_lng, destino_lat, destino_lng } = req.body;
  try {
    const newViaje = await db.query(
      'INSERT INTO viajes (usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, estado, hora_inicio) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
      [usuario_id, origen_lat || -33.044167, origen_lng || -61.168056, destino_lat, destino_lng, 'solicitado']
    );
    const viaje = newViaje.rows[0];
    
    // Emitir a todos los choferes conectados que hay un nuevo viaje
    io.emit('new_ride_request', viaje);
    
    res.json({ success: true, viaje });
  } catch (error) {
    console.error('Error al solicitar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Login de Chofer
app.post('/api/choferes/login', async (req, res) => {
  const { dni, clave } = req.body;
  try {
    const result = await db.query(
      'SELECT id, nombre, apellido, dni, numero_movil, vehiculo_modelo, vehiculo_patente, estado FROM choferes WHERE dni = $1 AND clave = $2',
      [dni, clave]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, chofer: result.rows[0] });
    } else {
      res.json({ success: false, error: 'Credenciales incorrectas' });
    }
  } catch (error) {
    console.error('Error en login de chofer:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// Aceptar un viaje (Chofer)
app.post('/api/viajes/accept', async (req, res) => {
  const { viaje_id, chofer_id } = req.body;
  try {
    // 1. Actualizar el viaje en la base de datos
    const result = await db.query(
      "UPDATE viajes SET chofer_id = $1, estado = 'en_camino' WHERE id = $2 RETURNING *",
      [chofer_id, viaje_id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Viaje no encontrado' });
    }
    
    const viajeActualizado = result.rows[0];

    // 2. Buscar datos del chofer para avisarle al pasajero
    const choferQuery = await db.query(
      'SELECT nombre, apellido, numero_movil, vehiculo_modelo, vehiculo_patente FROM choferes WHERE id = $1',
      [chofer_id]
    );
    
    const datosChofer = choferQuery.rows[0];

    // 3. Emitir evento por socket para avisarle al pasajero
    io.emit('ride_accepted', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id,
      chofer: datosChofer
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al aceptar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Finalizar un viaje (Chofer pasa a Libre)
app.post('/api/viajes/finish', async (req, res) => {
  const { viaje_id, chofer_id, fin_lat, fin_lng } = req.body;
  try {
    // 1. Obtener viaje y pasajero
    const viajeRes = await db.query('SELECT * FROM viajes WHERE id = $1', [viaje_id]);
    if (viajeRes.rows.length === 0) return res.json({ success: false, error: 'Viaje no encontrado' });
    const viaje = viajeRes.rows[0];

    const userRes = await db.query('SELECT es_jubilado FROM usuarios WHERE id = $1', [viaje.usuario_id]);
    const esJubilado = userRes.rows.length > 0 ? userRes.rows[0].es_jubilado : false;

    // 2. Obtener Tarifas actuales
    const tarifasRes = await db.query('SELECT * FROM tarifas ORDER BY id DESC LIMIT 1');
    const tarifas = tarifasRes.rows[0];

    // 3. Calcular distancia
    const distanciaKm = calculateDistance(viaje.origen_lat, viaje.origen_lng, fin_lat, fin_lng);
    const distancia100m = distanciaKm * 10; // cuántos tramos de 100m

    // 4. Determinar Tarifa (Diurna, Nocturna, Jubilado)
    const tarifaType = getTarifaType();
    let bajada = tarifas.bajada_bandera_diurna;
    let precio100m = tarifas.precio_100m_diurna;

    if (esJubilado) {
      bajada = tarifas.bajada_bandera_jubilados;
      precio100m = tarifas.precio_100m_jubilados;
    } else if (tarifaType === 'nocturna') {
      bajada = tarifas.bajada_bandera_nocturna;
      precio100m = tarifas.precio_100m_nocturna;
    }

    // 5. Calcular monto total y comisión
    const montoCalculado = bajada + (precio100m * distancia100m);
    const comisionAdmin = montoCalculado * (tarifas.porcentaje_comision_agencia / 100);

    // 6. Actualizar Viaje
    const result = await db.query(
      `UPDATE viajes 
       SET estado = 'finalizado', 
           destino_lat = $1, 
           destino_lng = $2, 
           hora_fin = NOW(), 
           distancia_km = $3, 
           monto_calculado = $4, 
           comision_admin = $5 
       WHERE id = $6 RETURNING *`,
      [fin_lat, fin_lng, distanciaKm, montoCalculado, comisionAdmin, viaje_id]
    );

    res.json({ success: true, viaje: result.rows[0] });
  } catch (error) {
    console.error('Error al finalizar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});


// Obtener choferes activos (libres u ocupados) con sus ubicaciones
app.get('/api/choferes/activos', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nombre, apellido, dni, numero_movil, estado, lat, lng, is_online FROM choferes WHERE is_online = true OR estado IN ('libre', 'ocupado')"
    );
    res.json({ success: true, choferes: result.rows });
  } catch (error) {
    console.error('Error al obtener choferes activos:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Obtener todos los choferes (para el panel de gestión)
app.get('/api/choferes', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nombre, apellido, dni, numero_movil, estado, vehiculo_modelo, vehiculo_patente FROM choferes ORDER BY numero_movil ASC"
    );
    res.json({ success: true, choferes: result.rows });
  } catch (error) {
    console.error('Error al obtener todos los choferes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Endpoint de Finanzas / Historial de Viajes para Admin
app.get('/api/finanzas/admin', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT v.id, v.estado, v.monto_calculado, v.comision_admin, v.distancia_km, 
             v.metodo_pago, v.created_at as fecha,
             c.nombre as chofer_nombre, c.apellido as chofer_apellido, c.numero_movil,
             u.nombre as pasajero_nombre, u.apellido as pasajero_apellido
      FROM viajes v
      LEFT JOIN choferes c ON v.chofer_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY v.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, viajes: result.rows });
  } catch (error) {
    console.error('Error al obtener finanzas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener finanzas' });
  }
});

// Endpoint de Historial de Viajes para Chofer
app.get('/api/finanzas/chofer/:id', async (req, res) => {
  const choferId = req.params.id;
  try {
    const result = await db.query(`
      SELECT v.id, v.estado, v.monto_calculado, v.comision_admin, v.distancia_km, 
             v.metodo_pago, v.created_at as fecha,
             u.nombre as pasajero_nombre, u.apellido as pasajero_apellido
      FROM viajes v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.chofer_id = $1 AND v.estado = 'finalizado'
      ORDER BY v.created_at DESC
    `, [choferId]);
    res.json({ success: true, viajes: result.rows });
  } catch (error) {
    console.error('Error al obtener viajes del chofer:', error);
    res.status(500).json({ success: false, error: 'Error al obtener viajes' });
  }
});

// Configuración de WebSockets para tiempo real
io.on('connection', (socket) => {
  console.log(`Nuevo usuario conectado: ${socket.id}`);

  // Cuando un chofer actualiza su ubicación
  socket.on('update_location', async (data) => {
    // 1. Emitir a todos (Operador y otros) al instante
    socket.broadcast.emit('driver_location', data);
    
    // 2. Persistir en la base de datos
    try {
      const estado = data.isOnline ? 'libre' : 'inactivo';
      await db.query(
        "UPDATE choferes SET lat = $1, lng = $2, is_online = $3, estado = $4 WHERE id = $5 OR dni = $6",
        [data.lat, data.lng, data.isOnline, estado, data.chofer_id, data.dni]
      );
    } catch (err) {
      console.error('Error al persistir ubicación:', err);
    }
  });

  // Cuando un pasajero pide viaje directamente por socket (opcional)
  socket.on('request_ride_direct', (data) => {
    socket.broadcast.emit('new_ride_request', data);
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
