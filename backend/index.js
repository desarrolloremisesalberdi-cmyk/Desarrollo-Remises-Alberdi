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
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ SUPABASE_URL o SUPABASE_ANON_KEY no están definidos. La subida de imágenes fallará.");
}

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

    // 3. Guardar base64 directamente en PostgreSQL (bypass Supabase Storage)
    let dni_foto_url = foto_base64 || null;

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
  const { usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, destino_fijo_id, costo_fijo } = req.body;
  try {
    const newViaje = await db.query(
      'INSERT INTO viajes (usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, destino_fijo_id, costo_fijo, estado, hora_inicio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
      [usuario_id, origen_lat || -33.044167, origen_lng || -61.168056, destino_lat, destino_lng, destino_fijo_id || null, costo_fijo || null, 'solicitado']
    );
    const viaje = newViaje.rows[0];
    
    // Obtener información del usuario para saber si es jubilado
    const user = await db.query('SELECT es_jubilado, nombre, apellido, dni FROM usuarios WHERE id = $1', [usuario_id]);
    if (user.rows.length > 0) {
      viaje.es_jubilado = user.rows[0].es_jubilado;
      viaje.pasajero_nombre = `${user.rows[0].nombre} ${user.rows[0].apellido}`;
      viaje.pasajero_dni = user.rows[0].dni;
    }
    
    // Emitir a todos los choferes conectados que hay un nuevo viaje
    io.emit('new_ride_request', viaje);
    
    res.json({ success: true, viaje });
  } catch (error) {
    console.error('Error al solicitar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ================= DESTINOS FIJOS =================
app.get('/api/destinos_fijos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM destinos_fijos ORDER BY nombre_destino ASC');
    res.json({ success: true, destinos: result.rows });
  } catch (error) {
    console.error('Error al obtener destinos fijos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener destinos' });
  }
});

app.post('/api/destinos_fijos', async (req, res) => {
  const { nombre, precio } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO destinos_fijos (nombre_destino, precio_fijo) VALUES ($1, $2) RETURNING *',
      [nombre, precio]
    );
    res.json({ success: true, destino: result.rows[0] });
  } catch (error) {
    console.error('Error al agregar destino fijo:', error);
    res.status(500).json({ success: false, error: 'Error al agregar destino' });
  }
});

app.put('/api/destinos_fijos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio } = req.body;
  try {
    const result = await db.query(
      'UPDATE destinos_fijos SET nombre_destino = $1, precio_fijo = $2 WHERE id = $3 RETURNING *',
      [nombre, precio, id]
    );
    res.json({ success: true, destino: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar destino fijo:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar destino' });
  }
});

app.delete('/api/destinos_fijos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM destinos_fijos WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar destino fijo:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar destino' });
  }
});

// ================= TARIFAS =================
app.get('/api/tarifas', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tarifas ORDER BY id DESC LIMIT 1');
    res.json({ success: true, tarifas: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener tarifas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tarifas' });
  }
});

app.post('/api/tarifas', async (req, res) => {
  const {
    bajada_bandera_diurna,
    precio_100m_diurna,
    bajada_bandera_nocturna,
    precio_100m_nocturna,
    bajada_bandera_jubilados,
    precio_100m_jubilados,
    porcentaje_comision_agencia,
    precio_espera_hora,
    precio_km_extra
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO tarifas 
      (bajada_bandera_diurna, precio_100m_diurna, bajada_bandera_nocturna, precio_100m_nocturna, bajada_bandera_jubilados, precio_100m_jubilados, porcentaje_comision_agencia, precio_espera_hora, precio_km_extra, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
      [bajada_bandera_diurna, precio_100m_diurna, bajada_bandera_nocturna, precio_100m_nocturna, bajada_bandera_jubilados, precio_100m_jubilados, porcentaje_comision_agencia, precio_espera_hora || 0, precio_km_extra || 1100]
    );
    res.json({ success: true, tarifas: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar tarifas:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar tarifas' });
  }
});

// Registro de Chofer
app.post('/api/choferes/register', async (req, res) => {
  const { 
    nombre, apellido, email, telefono, domicilio, dni, 
    fecha_nacimiento, licencia_vencimiento, numero_movil, vehiculo_modelo, 
    vehiculo_color, vehiculo_patente, datos_cobro, 
    foto_perfil_base64, foto_carnet_base64, foto_dni_base64, foto_auto_base64, clave 
  } = req.body;
  
  try {
    const existing = await db.query('SELECT * FROM choferes WHERE dni = $1', [dni]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'DNI ya registrado como chofer.' });
    }

    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash(clave || '123456', saltRounds);

    // Guardar las imágenes directamente como Base64 en la base de datos
    // Esto evita requerir configuración adicional de Storage y funciona con src={foto_url}
    fotoPerfilUrl = foto_perfil_base64 || null;
    fotoCarnetUrl = foto_carnet_base64 || null;
    fotoDniUrl = foto_dni_base64 || null;
    fotoAutoUrl = foto_auto_base64 || null;

    const result = await db.query(
      `INSERT INTO choferes 
       (nombre, apellido, email, clave, telefono, domicilio, dni, fecha_nacimiento, licencia_vencimiento, numero_movil, vehiculo_modelo, vehiculo_color, vehiculo_patente, datos_pago, foto_url, dni_foto_url, vehiculo_foto_url, estado, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'inactivo', NOW()) RETURNING *`,
      [nombre, apellido, email, defaultPassword, telefono, domicilio, dni, fecha_nacimiento, licencia_vencimiento, numero_movil, vehiculo_modelo, vehiculo_color, vehiculo_patente, datos_cobro, fotoPerfilUrl, fotoDniUrl, fotoAutoUrl]
    );

    res.json({ success: true, chofer: result.rows[0] });
  } catch (error) {
    console.error('Error registrando chofer:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// Login de Chofer
app.post('/api/choferes/login', async (req, res) => {
  const { dni, clave } = req.body;
  try {
    const result = await db.query(
      'SELECT id, nombre, apellido, dni, clave, numero_movil, vehiculo_modelo, vehiculo_patente, estado, foto_url, suspendido FROM choferes WHERE dni = $1',
      [dni]
    );
    
    if (result.rows.length > 0) {
      const chofer = result.rows[0];
      const match = await bcrypt.compare(clave, chofer.clave);
      if (match) {
        if (chofer.suspendido) {
          return res.json({ success: false, error: 'suspended' });
        }
        // Eliminar la clave antes de enviarlo al cliente
        delete chofer.clave;
        res.json({ success: true, chofer });
      } else {
        res.json({ success: false, error: 'Credenciales incorrectas' });
      }
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

    // Actualizar estado del chofer a ocupado
    await db.query(
      "UPDATE choferes SET estado = 'ocupado', is_online = false WHERE id = $1",
      [chofer_id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Viaje no encontrado' });
    }
    
    const viajeActualizado = result.rows[0];

    // 2. Buscar datos del chofer para avisarle al pasajero
    const choferQuery = await db.query(
      'SELECT nombre, apellido, numero_movil, vehiculo_modelo, vehiculo_patente, foto_url, datos_pago FROM choferes WHERE id = $1',
      [chofer_id]
    );
    
    const datosChofer = choferQuery.rows[0];

    // 3. Emitir evento por socket para avisarle al pasajero
    io.emit('ride_accepted', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id,
      chofer: datosChofer,
      viaje: viajeActualizado
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
  const { viaje_id, chofer_id, fin_lat, fin_lng, espera_minutos = 0 } = req.body;
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
    const costoEspera = (espera_minutos / 60) * (tarifas.precio_espera_hora || 0);
    let montoCalculado = bajada + (precio100m * distancia100m) + costoEspera;
    if (viaje.costo_fijo) {
      montoCalculado = parseFloat(viaje.costo_fijo) + costoEspera;
    }
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
           comision_admin = $5,
           espera_minutos = $6,
           costo_espera = $7
       WHERE id = $8 RETURNING *`,
      [fin_lat, fin_lng, distanciaKm, montoCalculado, comisionAdmin, espera_minutos, costoEspera, viaje_id]
    );

    const viajeActualizado = result.rows[0];

    // Volver a poner al chofer libre
    await db.query(
      "UPDATE choferes SET estado = 'libre', is_online = true WHERE id = $1",
      [viajeActualizado.chofer_id]
    );

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

// Solicitar cierre manual por falla de GPS (Chofer -> Operador)
app.post('/api/viajes/request-manual-close', async (req, res) => {
  const { viaje_id } = req.body;
  try {
    const result = await db.query(
      "UPDATE viajes SET requiere_cierre_manual = true WHERE id = $1 RETURNING *",
      [viaje_id]
    );
    if (result.rows.length === 0) return res.json({ success: false, error: 'Viaje no encontrado' });
    const viajeActualizado = result.rows[0];

    // Avisar al operador (y otros) que se necesita cierre manual
    io.emit('manual_close_requested', {
      viaje_id: viaje_id,
      chofer_id: viajeActualizado.chofer_id
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al solicitar cierre manual:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Forzar cierre de viaje con monto manual (Operador -> Viaje)
app.post('/api/viajes/force-close', async (req, res) => {
  const { viaje_id, monto_manual } = req.body;
  try {
    const viajeRes = await db.query('SELECT * FROM viajes WHERE id = $1', [viaje_id]);
    if (viajeRes.rows.length === 0) return res.json({ success: false, error: 'Viaje no encontrado' });
    const viaje = viajeRes.rows[0];

    const tarifasRes = await db.query('SELECT * FROM tarifas ORDER BY id DESC LIMIT 1');
    const tarifas = tarifasRes.rows[0];

    // Calcula comision
    const comisionAdmin = monto_manual * (tarifas.porcentaje_comision_agencia / 100);

    const result = await db.query(
      `UPDATE viajes 
       SET estado = 'finalizado', 
           hora_fin = NOW(), 
           monto_calculado = $1, 
           comision_admin = $2,
           requiere_cierre_manual = false
       WHERE id = $3 RETURNING *`,
      [monto_manual, comisionAdmin, viaje_id]
    );

    const viajeActualizado = result.rows[0];

    // Volver a poner al chofer libre
    await db.query(
      "UPDATE choferes SET estado = 'libre', is_online = true WHERE id = $1",
      [viajeActualizado.chofer_id]
    );

    // Avisar al pasajero del costo final
    io.emit('ride_finished', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id,
      monto: monto_manual,
      distancia: 0 // manual
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al forzar cierre:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
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
      "SELECT id, nombre, apellido, dni, numero_movil, estado, vehiculo_modelo, vehiculo_patente, vehiculo_color, datos_pago, domicilio, telefono, email, fecha_nacimiento, is_online, lat, lng, foto_url, dni_foto_url, vehiculo_foto_url, suspendido, licencia_vencimiento FROM choferes ORDER BY nombre ASC"
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
      if (data.isOnline) {
        await db.query(
          "UPDATE choferes SET lat = $1, lng = $2, is_online = true, estado = 'libre' WHERE id = $3 OR dni = $4",
          [data.lat, data.lng, data.chofer_id, data.dni]
        );
      } else {
        // Solo marcar como inactivo si no está ocupado (porque al estar ocupado isOnline = false en la app)
        await db.query(
          "UPDATE choferes SET lat = $1, lng = $2, is_online = false, estado = CASE WHEN estado = 'ocupado' THEN 'ocupado' ELSE 'inactivo' END WHERE id = $3 OR dni = $4",
          [data.lat, data.lng, data.chofer_id, data.dni]
        );
      }
    } catch (err) {
      console.error('Error al persistir ubicación:', err);
    }
  });

  // Cuando un pasajero pide viaje directamente por socket (opcional)
  socket.on('request_ride_direct', (data) => {
    socket.broadcast.emit('new_ride_request', data);
  });

  socket.on('toggle_espera', (data) => {
    socket.broadcast.emit('toggle_espera', data);
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

// Toggle suspension for a driver
app.post('/api/choferes/toggle-suspend', async (req, res) => {
  const { id, suspendido } = req.body;
  try {
    const result = await db.query('UPDATE choferes SET suspendido = $1 WHERE id = $2 RETURNING *', [suspendido, id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    res.json({ success: true, chofer: result.rows[0] });
  } catch (error) {
    console.error('Error toggling suspension:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});
// Editing driver
app.put('/api/choferes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, dni, numero_movil, vehiculo_modelo, vehiculo_patente, vencimiento_carnet, datos_pago, domicilio, telefono, email, fecha_nacimiento, vehiculo_color, foto_perfil_base64, foto_dni_base64, foto_auto_base64 } = req.body;
  try {
    // Si viene la foto base64, la actualizamos, si no, mantenemos la existente.
    const updateQuery = `
      UPDATE choferes 
      SET nombre = $1, apellido = $2, dni = $3, numero_movil = $4, vehiculo_modelo = $5, vehiculo_patente = $6, licencia_vencimiento = $7, datos_pago = $8, domicilio = $9, telefono = $10, email = $11, fecha_nacimiento = $12, vehiculo_color = $13,
      foto_url = COALESCE($14, foto_url),
      dni_foto_url = COALESCE($15, dni_foto_url),
      vehiculo_foto_url = COALESCE($16, vehiculo_foto_url)
      WHERE id = $17 RETURNING *
    `;
    const values = [nombre, apellido, dni, numero_movil, vehiculo_modelo, vehiculo_patente, vencimiento_carnet, datos_pago, domicilio, telefono, email, fecha_nacimiento, vehiculo_color, foto_perfil_base64 || null, foto_dni_base64 || null, foto_auto_base64 || null, id];
    const result = await db.query(updateQuery, values);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    res.json({ success: true, chofer: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando chofer:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});
