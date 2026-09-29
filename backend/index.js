require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./config/db'); // Esto inicia la conexión a DB
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración de Correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'desarrolloremisesalberdi@gmail.com',
    pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
  }
});

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

app.use(express.json({ limit: '50mb' }));

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

// Proxy de Google Maps para evitar CORS en Web
app.use('/api/maps', async (req, res) => {
  const targetUrl = `https://maps.googleapis.com/maps/api${req.url}`;
  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registro de Pasajero
app.post('/api/users/register', async (req, res) => {
  const { nombre, apellido, dni, telefono, email, clave, foto_base64 } = req.body;
  try {
    // 1. Verificar si ya existe el DNI o Email
    const existing = await db.query('SELECT id FROM usuarios WHERE dni = $1 OR email = $2', [dni, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El DNI o Email ya están registrados.' });
    }

    // 2. Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(clave, saltRounds);

    // 3. Subir foto a Supabase Storage (si existe)
    let dni_foto_url = null;
    if (foto_base64) {
      try {
        const base64Data = foto_base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `dni_${dni}_${Date.now()}.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dnis')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('dnis')
          .getPublicUrl(fileName);
        
        dni_foto_url = publicUrlData.publicUrl;
      } catch (uploadErr) {
        console.error('Error al subir imagen de DNI:', uploadErr);
        // Podemos decidir fallar o continuar sin foto. Para este caso fallamos.
        return res.status(400).json({ success: false, error: 'Error al procesar la foto del DNI.' });
      }
    }

    // 4. Guardar en Base de Datos
    const newUser = await db.query(
      'INSERT INTO usuarios (nombre, apellido, dni, telefono, email, clave, dni_foto_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [nombre, apellido, dni, telefono, email, hashedPassword, dni_foto_url]
    );

    // No devolver el hash en la respuesta
    const user = newUser.rows[0];
    delete user.clave;

    res.json({ success: true, user, message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// Login de Pasajero
app.post('/api/users/login', async (req, res) => {
  const { dni_o_email, clave } = req.body;
  try {
    const result = await db.query('SELECT * FROM usuarios WHERE dni = $1 OR email = $1', [dni_o_email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas.' });
    }

    const user = result.rows[0];
    if (!user.clave) {
      return res.status(401).json({ success: false, error: 'La cuenta no tiene contraseña configurada. Por favor recupérela.' });
    }

    const match = await bcrypt.compare(clave, user.clave);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas.' });
    }

    delete user.clave;
    delete user.reset_token;
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// Recuperar contraseña (Generar Token y enviar correo)
app.post('/api/users/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query('SELECT id, nombre FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No existe usuario con ese correo.' });
    }

    const user = result.rows[0];
    // Generar un token aleatorio de 6 dígitos
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query('UPDATE usuarios SET reset_token = $1 WHERE email = $2', [resetToken, email]);

    const mailOptions = {
      from: transporter.options.auth.user,
      to: email,
      subject: 'Recuperación de Contraseña - Remises Alberdi',
      text: `Hola ${user.nombre}, tu código para restablecer la contraseña es: ${resetToken}. Ingrésalo en la aplicación para cambiar tu clave.`
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Correo enviado.' });
  } catch (error) {
    console.error('Error enviando correo:', error);
    res.status(500).json({ success: false, error: 'Error al enviar el correo.' });
  }
});

// Restablecer contraseña con Token
app.post('/api/users/reset-password', async (req, res) => {
  const { email, token, nueva_clave } = req.body;
  try {
    const result = await db.query('SELECT id FROM usuarios WHERE email = $1 AND reset_token = $2', [email, token]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Código incorrecto o vencido.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(nueva_clave, saltRounds);
    
    await db.query('UPDATE usuarios SET clave = $1, reset_token = NULL WHERE email = $2', [hashedPassword, email]);
    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error restableciendo clave:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
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
      'SELECT nombre, apellido, numero_movil, vehiculo_modelo, vehiculo_patente, foto_url FROM choferes WHERE id = $1',
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

// Empezar un viaje (Chofer llega al pasajero)
app.post('/api/viajes/start', async (req, res) => {
  const { viaje_id, chofer_id } = req.body;
  try {
    const result = await db.query(
      "UPDATE viajes SET estado = 'en_viaje' WHERE id = $1 RETURNING *",
      [viaje_id]
    );
    
    if (result.rows.length === 0) return res.json({ success: false, error: 'Viaje no encontrado' });
    const viajeActualizado = result.rows[0];

    // Avisarle al pasajero que el viaje comenzó
    io.emit('ride_started', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al empezar viaje:', error);
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

    const viajeActualizado = result.rows[0];

    // Avisar al pasajero del costo final
    io.emit('ride_finished', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id,
      monto: montoCalculado,
      distancia: distanciaKm
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al finalizar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});


// Obtener choferes activos (online)
app.get('/api/choferes/activos', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nombre, apellido, dni, numero_movil, lat, lng, is_online, foto_url FROM choferes WHERE is_online = true'
    );
    res.json({ success: true, choferes: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Obtener todos los choferes (para el panel de gestión)
app.get('/api/choferes', async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nombre, apellido, dni, numero_movil, estado, vehiculo_modelo, is_online, lat, lng, foto_url FROM choferes ORDER BY nombre ASC"
    );
    res.json({ success: true, choferes: result.rows });
  } catch (error) {
    console.error('Error al obtener choferes:', error);
    res.status(500).json({ success: false, error: 'Error al cargar choferes' });
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
