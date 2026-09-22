require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./config/db'); // Esto inicia la conexión a DB

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

// Rutas básicas
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido a la API de Radio Taxi Alberdi' });
});

// Registrar o iniciar sesión de Pasajero
app.post('/api/users/register', async (req, res) => {
  const { nombre, apellido, telefono } = req.body;
  try {
    // Buscar si el usuario ya existe por su teléfono
    const existingUser = await db.query('SELECT * FROM usuarios WHERE telefono = $1', [telefono]);
    if (existingUser.rows.length > 0) {
      return res.json({ success: true, user: existingUser.rows[0], message: 'Sesión iniciada' });
    }
    
    // Si no existe, lo creamos
    const newUser = await db.query(
      'INSERT INTO usuarios (nombre, apellido, telefono) VALUES ($1, $2, $3) RETURNING *',
      [nombre, apellido || '', telefono]
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
      'INSERT INTO viajes (usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
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
