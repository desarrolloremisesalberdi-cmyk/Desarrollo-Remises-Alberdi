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

// Migración automática para sistema de calificaciones de 5 estrellas
async function initCalificacionesTable() {
  try {
    await db.query(`
      DO $$ 
      BEGIN 
        -- Columnas en tabla viajes
        BEGIN
          ALTER TABLE viajes ADD COLUMN calificacion INT;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN calificacion_comentario TEXT;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN calificacion_etiquetas TEXT;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN calificacion_fecha TIMESTAMP WITH TIME ZONE;
        EXCEPTION WHEN duplicate_column THEN END;

        -- Columnas en tabla choferes
        BEGIN
          ALTER TABLE choferes ADD COLUMN calificacion_promedio DECIMAL(3,2) DEFAULT 5.0;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE choferes ADD COLUMN total_calificaciones INT DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN END;

        -- Tabla dedicada de calificaciones
        CREATE TABLE IF NOT EXISTS calificaciones (
          id SERIAL PRIMARY KEY,
          viaje_id TEXT,
          chofer_id TEXT,
          usuario_id TEXT,
          estrellas INT NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
          comentario TEXT,
          etiquetas TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Columnas para comprobante de pago anticipado y método de pago
        BEGIN
          ALTER TABLE viajes ADD COLUMN comprobante_url TEXT;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN comprobante_estado VARCHAR(20) DEFAULT NULL;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN metodo_pago VARCHAR(50) DEFAULT 'efectivo';
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN es_fuera_de_casilda BOOLEAN DEFAULT FALSE;
        EXCEPTION WHEN duplicate_column THEN END;
        BEGIN
          ALTER TABLE viajes ADD COLUMN origen_direccion TEXT;
        EXCEPTION WHEN duplicate_column THEN END;
      END $$;
    `);
    console.log('✅ Tablas y columnas de calificación verificadas correctamente');
  } catch (err) {
    console.warn('Nota en verificación de calificaciones:', err.message);
  }
}
initCalificacionesTable();

// Configuración de Correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'desarrolloremisesalberdi@gmail.com',
    pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
  }
});

// Utils
const activeRideTimeouts = {};

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
      subject: 'Recuperación de Contraseña - Taxis Alberdi',
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

// Choferes cercanos para selección del pasajero
app.get('/api/choferes/cercanos', async (req, res) => {
  const { lat, lng, limit = 5 } = req.query;
  try {
    const originLat = parseFloat(lat) || -33.044167;
    const originLng = parseFloat(lng) || -61.168056;

    const result = await db.query(
      `SELECT id, nombre, apellido, numero_movil, vehiculo_modelo, vehiculo_color, vehiculo_patente, foto_url, lat, lng, estado, is_online,
              COALESCE(calificacion_promedio, 5.0) as calificacion_promedio,
              COALESCE(total_calificaciones, 0) as total_calificaciones
       FROM choferes 
       WHERE is_online = true AND estado = 'libre' AND (suspendido = false OR suspendido IS NULL) AND lat IS NOT NULL AND lng IS NOT NULL`
    );

    const choferesConDistancia = result.rows.map(ch => {
      const dist = calculateDistance(originLat, originLng, parseFloat(ch.lat), parseFloat(ch.lng));
      const etaMin = Math.max(1, Math.round(dist * 2.5 + 1));
      return {
        ...ch,
        distancia_km: parseFloat(dist.toFixed(1)),
        distancia_metros: Math.round(dist * 1000),
        eta_minutos: etaMin
      };
    });

    choferesConDistancia.sort((a, b) => a.distancia_km - b.distancia_km);
    const topChoferes = choferesConDistancia.slice(0, parseInt(limit));

    res.json({ success: true, choferes: topChoferes });
  } catch (error) {
    console.error('Error al obtener choferes cercanos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener choferes cercanos' });
  }
});

// Solicitar un viaje
app.post('/api/viajes/request', async (req, res) => {
  const { 
    usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, 
    destino_fijo_id, costo_fijo, chofer_destinado_id,
    metodo_pago, origen_direccion, es_fuera_de_casilda 
  } = req.body;

  try {
    const newViaje = await db.query(
      'INSERT INTO viajes (usuario_id, origen_lat, origen_lng, destino_lat, destino_lng, destino_fijo_id, costo_fijo, estado, hora_inicio, metodo_pago, es_fuera_de_casilda, origen_direccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11) RETURNING *',
      [
        usuario_id, origen_lat || -33.044167, origen_lng || -61.168056, destino_lat, destino_lng, 
        destino_fijo_id || null, costo_fijo || null, 'solicitado',
        metodo_pago || 'efectivo', es_fuera_de_casilda || false, origen_direccion || ''
      ]
    );
    const viaje = newViaje.rows[0];
    
    // Asegurar compatibilidad
    viaje.metodo_pago = metodo_pago || 'efectivo';
    viaje.es_fuera_de_casilda = es_fuera_de_casilda || false;
    viaje.origen_direccion = origen_direccion || '';

    // Obtener información del usuario para saber si es jubilado
    const user = await db.query('SELECT es_jubilado, nombre, apellido, dni FROM usuarios WHERE id = $1', [usuario_id]);
    if (user.rows.length > 0) {
      viaje.es_jubilado = user.rows[0].es_jubilado;
      viaje.pasajero_nombre = `${user.rows[0].nombre} ${user.rows[0].apellido}`;
      viaje.pasajero_dni = user.rows[0].dni;
    }

    if (chofer_destinado_id) {
      viaje.chofer_destinado_id = chofer_destinado_id;
      const choferQuery = await db.query('SELECT nombre, apellido, numero_movil FROM choferes WHERE id = $1', [chofer_destinado_id]);
      if (choferQuery.rows.length > 0) {
        viaje.chofer_destinado_movil = choferQuery.rows[0].numero_movil;
        viaje.chofer_destinado_nombre = `${choferQuery.rows[0].nombre} ${choferQuery.rows[0].apellido}`;
      }

      // Timeout de 30 segundos si el chofer seleccionado no responde
      activeRideTimeouts[viaje.id] = setTimeout(async () => {
        try {
          const checkViaje = await db.query('SELECT estado FROM viajes WHERE id = $1', [viaje.id]);
          if (checkViaje.rows.length > 0 && checkViaje.rows[0].estado === 'solicitado') {
            io.emit('ride_driver_timeout', {
              viaje_id: viaje.id,
              pasajero_id: viaje.usuario_id,
              chofer_id: chofer_destinado_id,
              numero_movil: viaje.chofer_destinado_movil || 'N/A',
              nombre_chofer: viaje.chofer_destinado_nombre || 'El chofer'
            });
          }
        } catch (e) {
          console.error('Error en timeout de chofer:', e);
        } finally {
          delete activeRideTimeouts[viaje.id];
        }
      }, 30000);
    }
    
    // Emitir a todos los choferes conectados que hay un nuevo viaje
    io.emit('new_ride_request', viaje);
    
    res.json({ success: true, viaje });
  } catch (error) {
    console.error('Error al solicitar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Subir comprobante de pago anticipado (Pasajero)
app.post('/api/viajes/comprobante', async (req, res) => {
  const { viaje_id, comprobante_base64, pasajero_id } = req.body;
  try {
    const result = await db.query(
      "UPDATE viajes SET comprobante_url = $1, comprobante_estado = 'enviado' WHERE id = $2 RETURNING *",
      [comprobante_base64, viaje_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Viaje no encontrado' });
    }
    const viaje = result.rows[0];
    io.emit('comprobante_recibido', {
      viaje_id: viaje.id,
      comprobante_url: comprobante_base64,
      pasajero_id: viaje.usuario_id,
      chofer_id: viaje.chofer_id
    });
    res.json({ success: true, viaje });
  } catch (error) {
    console.error('Error al subir comprobante:', error);
    res.status(500).json({ success: false, error: 'Error al subir comprobante' });
  }
});

// Validar comprobante de pago (Chofer)
app.post('/api/viajes/validar-comprobante', async (req, res) => {
  const { viaje_id, chofer_id, estado } = req.body; // 'aprobado' | 'rechazado'
  try {
    const result = await db.query(
      "UPDATE viajes SET comprobante_estado = $1 WHERE id = $2 RETURNING *",
      [estado, viaje_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Viaje no encontrado' });
    }
    const viaje = result.rows[0];
    io.emit('comprobante_validado', {
      viaje_id: viaje.id,
      pasajero_id: viaje.usuario_id,
      chofer_id: chofer_id,
      estado: estado
    });
    res.json({ success: true, viaje });
  } catch (error) {
    console.error('Error al validar comprobante:', error);
    res.status(500).json({ success: false, error: 'Error al validar comprobante' });
  }
});

// Chofer rechaza viaje asignado
app.post('/api/viajes/reject', async (req, res) => {
  const { viaje_id, chofer_id } = req.body;
  try {
    if (activeRideTimeouts[viaje_id]) {
      clearTimeout(activeRideTimeouts[viaje_id]);
      delete activeRideTimeouts[viaje_id];
    }
    const viajeRes = await db.query('SELECT usuario_id FROM viajes WHERE id = $1', [viaje_id]);
    const choferRes = await db.query('SELECT nombre, apellido, numero_movil FROM choferes WHERE id = $1', [chofer_id]);
    
    const movil = choferRes.rows.length > 0 ? choferRes.rows[0].numero_movil : 'N/A';
    const nombre = choferRes.rows.length > 0 ? `${choferRes.rows[0].nombre} ${choferRes.rows[0].apellido}` : 'El chofer';
    const pasajero_id = viajeRes.rows.length > 0 ? viajeRes.rows[0].usuario_id : null;

    io.emit('ride_driver_rejected', {
      viaje_id,
      pasajero_id,
      chofer_id,
      numero_movil: movil,
      nombre_chofer: nombre
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error al rechazar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno al rechazar' });
  }
});

// Cambiar estado de chofer (Operador: Libre / Ocupado por Viaje Telefónico)
app.post('/api/choferes/set-status', async (req, res) => {
  const { chofer_id, estado, origen } = req.body;
  try {
    const isOnline = estado === 'libre' || estado === 'ocupado';
    const result = await db.query(
      'UPDATE choferes SET estado = $1, is_online = $2 WHERE id = $3 OR dni = $4 RETURNING *',
      [estado, isOnline, chofer_id, chofer_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }

    const chofer = result.rows[0];

    // Emitir a todos en tiempo real
    io.emit('driver_status_changed', {
      chofer_id: chofer.id,
      dni: chofer.dni,
      estado: estado,
      isOnline: isOnline,
      origen: origen || 'base_telefonica',
      numero_movil: chofer.numero_movil
    });

    res.json({ success: true, chofer });
  } catch (error) {
    console.error('Error al cambiar estado de chofer:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
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

    const safeFechaNacimiento = (fecha_nacimiento && String(fecha_nacimiento).trim() !== '') ? String(fecha_nacimiento).trim() : null;
    const safeLicenciaVencimiento = (licencia_vencimiento && String(licencia_vencimiento).trim() !== '') ? String(licencia_vencimiento).trim() : null;
    const safeEmail = (email && String(email).trim() !== '') ? String(email).trim() : null;
    const safeNumeroMovil = (numero_movil !== undefined && numero_movil !== null && String(numero_movil).trim() !== '') ? parseInt(numero_movil, 10) : null;

    const result = await db.query(
      `INSERT INTO choferes 
       (nombre, apellido, email, clave, telefono, domicilio, dni, fecha_nacimiento, licencia_vencimiento, numero_movil, vehiculo_modelo, vehiculo_color, vehiculo_patente, datos_pago, foto_url, dni_foto_url, vehiculo_foto_url, estado, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'inactivo', NOW()) RETURNING *`,
      [nombre, apellido, safeEmail, defaultPassword, telefono, domicilio, dni, safeFechaNacimiento, safeLicenciaVencimiento, safeNumeroMovil, vehiculo_modelo, vehiculo_color, vehiculo_patente, datos_cobro, fotoPerfilUrl, fotoDniUrl, fotoAutoUrl]
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
    if (activeRideTimeouts[viaje_id]) {
      clearTimeout(activeRideTimeouts[viaje_id]);
      delete activeRideTimeouts[viaje_id];
    }
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

    const choferRes = await db.query('SELECT datos_pago FROM choferes WHERE id = $1', [chofer_id]);
    const datosPagoChofer = choferRes.rows.length > 0 ? choferRes.rows[0].datos_pago : '';

    // 2. Obtener Tarifas actuales
    const tarifasRes = await db.query('SELECT * FROM tarifas ORDER BY id DESC LIMIT 1');
    const tarifas = tarifasRes.rows[0];

    // 3. Calcular distancia
    const distanciaKm = calculateDistance(viaje.origen_lat, viaje.origen_lng, fin_lat, fin_lng);
    const distancia100m = distanciaKm * 10; // cuántos tramos de 100m

    // 4. Determinar Tarifa (Diurna, Nocturna, Jubilado)
    const tarifaType = getTarifaType();
    let bajada = parseFloat(tarifas.bajada_bandera_diurna);
    let precio100m = parseFloat(tarifas.precio_100m_diurna);

    if (esJubilado) {
      bajada = parseFloat(tarifas.bajada_bandera_jubilados);
      precio100m = parseFloat(tarifas.precio_100m_jubilados);
    } else if (tarifaType === 'nocturna') {
      bajada = parseFloat(tarifas.bajada_bandera_nocturna);
      precio100m = parseFloat(tarifas.precio_100m_nocturna);
    }

    // 5. Calcular monto total y comisión
    const costoEspera = (espera_minutos / 60) * parseFloat(tarifas.precio_espera_hora || 0);
    let montoCalculado = bajada + (precio100m * distancia100m) + costoEspera;
    if (viaje.costo_fijo) {
      montoCalculado = parseFloat(viaje.costo_fijo) + costoEspera;
    }
    
    // Redondear el monto a entero (o 2 decimales, pero general es mejor entero para cobrar)
    montoCalculado = Math.round(montoCalculado);
    
    const comisionAdmin = Math.round(montoCalculado * (parseFloat(tarifas.porcentaje_comision_agencia) / 100));

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

    // Avisar al pasajero del costo final y los datos de pago
    io.emit('ride_finished', {
      viaje_id: viaje_id,
      pasajero_id: viajeActualizado.usuario_id,
      monto: montoCalculado,
      distancia: distanciaKm,
      datos_pago: datosPagoChofer
    });

    res.json({ success: true, viaje: viajeActualizado });
  } catch (error) {
    console.error('Error al finalizar viaje:', error);
    res.status(500).json({ success: false, error: error.message || 'Error interno del servidor' });
  }
});

// Endpoint para que el pasajero registre el método de pago y cierre el modal
app.post('/api/viajes/pay', async (req, res) => {
  const { viaje_id, metodo_pago } = req.body;
  try {
    const result = await db.query(
      `UPDATE viajes SET metodo_pago = $1 WHERE id = $2 RETURNING *`,
      [metodo_pago, viaje_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Viaje no encontrado' });
    }
    res.json({ success: true, viaje: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Endpoint para calificar al chofer con 1 a 5 estrellas al finalizar el viaje
app.post('/api/viajes/calificar', async (req, res) => {
  const { viaje_id, chofer_id, usuario_id, estrellas, comentario = '', etiquetas = [] } = req.body;
  
  if (!estrellas || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ success: false, error: 'La calificación debe ser de 1 a 5 estrellas' });
  }

  try {
    const etiquetasStr = Array.isArray(etiquetas) ? etiquetas.join(', ') : (etiquetas || '');
    
    // 1. Guardar en tabla de calificaciones
    try {
      await db.query(
        `INSERT INTO calificaciones (viaje_id, chofer_id, usuario_id, estrellas, comentario, etiquetas, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [viaje_id ? String(viaje_id) : null, chofer_id ? String(chofer_id) : null, usuario_id ? String(usuario_id) : null, estrellas, comentario, etiquetasStr]
      );
    } catch (e) {
      console.warn('Nota guardando en calificaciones:', e.message);
    }

    // 2. Actualizar el registro del viaje
    if (viaje_id) {
      try {
        await db.query(
          `UPDATE viajes 
           SET calificacion = $1, 
               calificacion_comentario = $2, 
               calificacion_etiquetas = $3, 
               calificacion_fecha = NOW() 
           WHERE id = $4`,
          [estrellas, comentario, etiquetasStr, viaje_id]
        );
      } catch (e) {
        console.warn('Nota actualizando viaje:', e.message);
      }
    }

    // 3. Recalcular promedio del chofer
    if (chofer_id) {
      try {
        const avgRes = await db.query(
          `SELECT AVG(estrellas) as promedio, COUNT(*) as total 
           FROM calificaciones 
           WHERE chofer_id = $1`,
          [String(chofer_id)]
        );
        
        if (avgRes.rows.length > 0 && avgRes.rows[0].total > 0) {
          const promedio = parseFloat(avgRes.rows[0].promedio).toFixed(2);
          const total = parseInt(avgRes.rows[0].total);
          
          await db.query(
            `UPDATE choferes 
             SET calificacion_promedio = $1, total_calificaciones = $2 
             WHERE id = $3`,
            [promedio, total, chofer_id]
          );

          // Notificar vía socket para actualizar paneles en vivo
          io.emit('driver_rated', {
            chofer_id,
            estrellas,
            promedio: parseFloat(promedio),
            total,
            comentario
          });
        }
      } catch (e) {
        console.warn('Nota recalculando promedio chofer:', e.message);
      }
    }

    res.json({ success: true, message: '¡Muchas gracias por calificar tu viaje con Taxis Alberdi!' });
  } catch (error) {
    console.error('Error al calificar viaje:', error);
    res.status(500).json({ success: false, error: 'Error interno al registrar calificación' });
  }
});

// Endpoint para consultar calificaciones de un chofer
app.get('/api/choferes/:id/calificaciones', async (req, res) => {
  const { id } = req.params;
  try {
    const choferRes = await db.query(
      `SELECT id, nombre, apellido, numero_movil, foto_url, 
              COALESCE(calificacion_promedio, 5.0) as calificacion_promedio, 
              COALESCE(total_calificaciones, 0) as total_calificaciones 
       FROM choferes 
       WHERE id = $1`,
      [id]
    );

    if (choferRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    }

    const reviewsRes = await db.query(
      `SELECT c.estrellas, c.comentario, c.etiquetas, c.created_at, u.nombre as pasajero_nombre 
       FROM calificaciones c
       LEFT JOIN usuarios u ON u.id::text = c.usuario_id
       WHERE c.chofer_id = $1
       ORDER BY c.created_at DESC
       LIMIT 20`,
      [String(id)]
    );

    res.json({
      success: true,
      chofer: choferRes.rows[0],
      calificaciones: reviewsRes.rows
    });
  } catch (error) {
    console.error('Error al obtener calificaciones:', error);
    res.status(500).json({ success: false, error: 'Error interno al consultar calificaciones' });
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

// Obtener tracking público en vivo de un viaje (Seguridad Pasajero)
app.get('/api/viajes/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT v.id, v.usuario_id, v.chofer_id, v.estado, v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng,
              v.hora_inicio, v.hora_fin, v.costo_fijo, v.monto_calculado,
              u.nombre as pasajero_nombre,
              c.nombre as chofer_nombre, c.apellido as chofer_apellido,
              c.numero_movil as chofer_movil, c.vehiculo_modelo, c.vehiculo_patente,
              c.vehiculo_color, c.foto_url as chofer_foto, c.lat as chofer_lat, c.lng as chofer_lng,
              c.is_online as chofer_online,
              df.nombre_destino as destino_fijo_nombre
       FROM viajes v
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       LEFT JOIN choferes c ON v.chofer_id = c.id
       LEFT JOIN destinos_fijos df ON v.destino_fijo_id = df.id
       WHERE v.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Viaje no encontrado' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      viaje: {
        id: row.id,
        usuario_id: row.usuario_id,
        estado: row.estado,
        origen_lat: row.origen_lat,
        origen_lng: row.origen_lng,
        destino_lat: row.destino_lat,
        destino_lng: row.destino_lng,
        destino_fijo_nombre: row.destino_fijo_nombre,
        hora_inicio: row.hora_inicio,
        hora_fin: row.hora_fin,
        pasajero: row.pasajero_nombre ? { nombre: row.pasajero_nombre } : null,
        chofer: row.chofer_id ? {
          id: row.chofer_id,
          nombre: row.chofer_nombre,
          apellido: row.chofer_apellido,
          numero_movil: row.chofer_movil,
          vehiculo_modelo: row.vehiculo_modelo,
          vehiculo_patente: row.vehiculo_patente,
          vehiculo_color: row.vehiculo_color,
          foto_url: row.chofer_foto,
          lat: row.chofer_lat,
          lng: row.chofer_lng,
          is_online: row.chofer_online
        } : null
      }
    });
  } catch (error) {
    console.error('Error al obtener tracking de viaje:', error);
    res.status(500).json({ success: false, error: 'Error al consultar tracking' });
  }
});

// Página Web pública de seguimiento en tiempo real (abierta desde WhatsApp)
app.get('/track/:id', async (req, res) => {
  const viajeId = req.params.id;
  const origenParam = req.query.origen || '';
  const destinoParam = req.query.destino || '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🛡️ Seguimiento en Vivo - Radio Taxi Alberdi</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    header { background: #1e293b; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 1000; }
    .badge-live { display: flex; align-items: center; gap: 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 12px; borderRadius: 20px; color: #f87171; font-weight: 800; font-size: 12px; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } 100% { opacity: 1; transform: scale(1); } }
    #map { flex: 1; width: 100%; height: 100%; }
    .bottom-panel { position: absolute; bottom: 0; left: 0; right: 0; z-index: 1000; padding: 14px; background: linear-gradient(to top, rgba(15,23,42,0.98) 85%, transparent); pointer-events: none; }
    .card { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 20px; padding: 18px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); pointer-events: auto; }
    .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 12px; font-weight: bold; font-size: 13px; margin-bottom: 12px; }
    .driver-box { display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px; }
    .driver-img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #10b981; }
    .btn-contact { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  <header>
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 24px;">🛡️</span>
      <div>
        <h1 style="font-size: 16px; font-weight: 800;">Radio Taxi Alberdi</h1>
        <p style="font-size: 12px; color: #94a3b8;">Seguimiento Seguro en Vivo</p>
      </div>
    </div>
    <div class="badge-live">
      <div class="pulse-dot"></div>
      EN VIVO
    </div>
  </header>

  <div id="map"></div>

  <div class="bottom-panel">
    <div class="card">
      <div id="statusBadge" class="status-pill" style="background: #0284c7; color: #fff;">
        🚖 Chofer en camino al punto de partida
      </div>

      <div class="driver-box" id="driverBox">
        <img id="driverPhoto" class="driver-img" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" alt="Chofer" />
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong id="driverName" style="font-size: 16px;">Chofer asignado</strong>
            <span id="driverMovil" style="background: #3b82f6; color: #fff; font-size: 11px; font-weight: bold; padding: 2px 7px; border-radius: 6px;">MÓVIL</span>
          </div>
          <p id="driverCar" style="font-size: 13px; color: #94a3b8; margin: 3px 0 0 0;">Vehículo de flota oficial</p>
          <p id="driverPlate" style="font-size: 12px; color: #cbd5e1; font-weight: bold; margin: 2px 0 0 0;">Patente: --</p>
        </div>
      </div>

      <div style="margin-bottom: 12px; font-size: 13px;">
        <div style="margin-bottom: 4px; color: #cbd5e1;">
          <strong style="color: #3b82f6;">📍 Origen:</strong> <span id="txtOrigen">${origenParam || 'Punto de partida'}</span>
        </div>
        <div style="color: #cbd5e1;">
          <strong style="color: #ef4444;">🏁 Destino:</strong> <span id="txtDestino">${destinoParam || 'Destino acordado'}</span>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <a href="tel:03464422222" class="btn-contact" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15);">
          📞 Llamar Base
        </a>
        <a href="https://api.whatsapp.com/send?phone=5493464555555&text=Hola%20Radio%20Taxi%20Alberdi,%20estoy%20siguiendo%20el%20viaje%20${viajeId}" class="btn-contact" style="background: #25D366; color: #fff;">
          💬 WhatsApp Base
        </a>
      </div>
    </div>
  </div>

  <script>
    const viajeId = '${viajeId}';
    let choferId = null;
    let map, taxiMarker, originMarker, destMarker;

    // Inicializar mapa centrado en Casilda
    map = L.map('map', { zoomControl: false }).setView([-33.044167, -61.168056], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const taxiIcon = L.divIcon({
      className: 'taxi-icon',
      html: '<div style="background:#10b981;border:3px solid #fff;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.5);font-size:22px;">🚖</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    const originIcon = L.divIcon({
      className: 'origin-icon',
      html: '<div style="background:#3b82f6;border:3px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.4);font-size:18px;">📍</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const destIcon = L.divIcon({
      className: 'dest-icon',
      html: '<div style="background:#ef4444;border:3px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.4);font-size:18px;">🏁</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    function updateDriverLocation(lat, lng) {
      if (!lat || !lng) return;
      const coords = [parseFloat(lat), parseFloat(lng)];
      if (taxiMarker) {
        taxiMarker.setLatLng(coords);
      } else {
        taxiMarker = L.marker(coords, { icon: taxiIcon }).addTo(map);
      }
      map.panTo(coords, { animate: true, duration: 1 });
    }

    async function fetchTrip() {
      try {
        const res = await fetch('/api/viajes/' + viajeId + '/track');
        const data = await res.json();
        if (data.success && data.viaje) {
          const v = data.viaje;
          const statusBadge = document.getElementById('statusBadge');
          if (v.estado === 'en_curso') {
            statusBadge.innerText = '🚘 En viaje hacia el destino';
            statusBadge.style.background = '#10b981';
          } else if (v.estado === 'finalizado') {
            statusBadge.innerText = '✅ Viaje finalizado con éxito';
            statusBadge.style.background = '#475569';
          } else {
            statusBadge.innerText = '🚖 Chofer en camino al punto de partida';
            statusBadge.style.background = '#0284c7';
          }

          if (v.chofer) {
            choferId = v.chofer.id;
            document.getElementById('driverName').innerText = v.chofer.nombre + ' ' + v.chofer.apellido;
            document.getElementById('driverMovil').innerText = 'MÓVIL #' + v.chofer.numero_movil;
            document.getElementById('driverCar').innerText = '🚗 ' + v.chofer.vehiculo_modelo + (v.chofer.vehiculo_color ? ' · ' + v.chofer.vehiculo_color : '');
            document.getElementById('driverPlate').innerText = 'Patente: ' + (v.chofer.vehiculo_patente || '--');
            if (v.chofer.foto_url) document.getElementById('driverPhoto').src = v.chofer.foto_url;
            if (v.chofer.lat && v.chofer.lng) updateDriverLocation(v.chofer.lat, v.chofer.lng);
          }

          if (v.origen_lat && v.origen_lng && !originMarker) {
            originMarker = L.marker([v.origen_lat, v.origen_lng], { icon: originIcon }).addTo(map);
          }
          if (v.destino_lat && v.destino_lng && !destMarker) {
            destMarker = L.marker([v.destino_lat, v.destino_lng], { icon: destIcon }).addTo(map);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    fetchTrip();
    setInterval(fetchTrip, 4000);

    const socket = io();
    socket.on('driver_location', (data) => {
      if (choferId && (data.chofer_id === choferId || data.dni === choferId)) {
        if (data.lat && data.lng) updateDriverLocation(data.lat, data.lng);
      }
    });
    socket.on('ride_started', (data) => {
      if (data.viaje_id === viajeId) fetchTrip();
    });
    socket.on('ride_finished', (data) => {
      if (data.viaje_id === viajeId) fetchTrip();
    });
  </script>
</body>
</html>`;

  res.send(html);
});

// Obtener historial de viajes del pasajero
app.get('/api/viajes/pasajero/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT v.*, c.nombre as chofer_nombre, c.apellido as chofer_apellido, c.vehiculo_modelo, c.vehiculo_patente 
       FROM viajes v
       LEFT JOIN choferes c ON v.chofer_id = c.id
       WHERE v.usuario_id = $1 AND v.estado = 'finalizado'
       ORDER BY v.hora_fin DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ success: true, viajes: result.rows });
  } catch (error) {
    console.error('Error obteniendo historial de pasajero:', error);
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
      "SELECT id, nombre, apellido, dni, numero_movil, estado, vehiculo_modelo, vehiculo_patente, vehiculo_color, datos_pago, domicilio, telefono, email, fecha_nacimiento, is_online, lat, lng, foto_url, dni_foto_url, vehiculo_foto_url, suspendido, licencia_vencimiento, COALESCE(calificacion_promedio, 5.0) as calificacion_promedio, COALESCE(total_calificaciones, 0) as total_calificaciones FROM choferes ORDER BY nombre ASC"
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
      SELECT v.id, v.chofer_id, v.usuario_id, v.estado, v.monto_calculado, v.comision_admin, v.distancia_km, 
             v.metodo_pago, v.comprobante_url, v.comprobante_estado, v.created_at as fecha,
             c.nombre as chofer_nombre, c.apellido as chofer_apellido, c.numero_movil,
             u.nombre as pasajero_nombre, u.apellido as pasajero_apellido
      FROM viajes v
      LEFT JOIN choferes c ON v.chofer_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY v.created_at DESC
      LIMIT 500
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
const connectedDrivers = {}; // socket.id -> chofer_id
const driverDisconnectTimers = {}; // chofer_id -> setTimeout timer

io.on('connection', (socket) => {
  console.log(`Nuevo usuario conectado: ${socket.id}`);

  // Cuando un chofer actualiza su ubicación o pulso
  socket.on('update_location', async (data) => {
    // Si había un timer de desconexión pendiente (por bloqueo o minimización), CANCELARLO
    if (data.chofer_id && driverDisconnectTimers[data.chofer_id]) {
      clearTimeout(driverDisconnectTimers[data.chofer_id]);
      delete driverDisconnectTimers[data.chofer_id];
    }

    connectedDrivers[socket.id] = data.chofer_id;

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
        // App is open, just not ready to receive trips.
        await db.query(
          "UPDATE choferes SET lat = $1, lng = $2, is_online = true, estado = CASE WHEN estado = 'ocupado' THEN 'ocupado' ELSE 'inactivo' END WHERE id = $3 OR dni = $4",
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

  // Eventos de comprobante de pago anticipado
  socket.on('subir_comprobante', (data) => {
    io.emit('comprobante_recibido', data);
  });

  socket.on('validar_comprobante', (data) => {
    io.emit('comprobante_validado', data);
  });

  socket.on('toggle_espera', (data) => {
    socket.broadcast.emit('toggle_espera', data);
  });

  socket.on('operator_set_driver_status', async (data) => {
    io.emit('driver_status_changed', data);
    try {
      const isOnline = data.estado === 'libre' || data.estado === 'ocupado';
      await db.query(
        'UPDATE choferes SET estado = $1, is_online = $2 WHERE id = $3 OR dni = $4',
        [data.estado, isOnline, data.chofer_id, data.chofer_id]
      );
    } catch (e) {
      console.error('Error al actualizar estado desde socket operador:', e);
    }
  });

  // Desconexión manual explícita (cuando el chofer cierra sesión o toca Desconectar)
  socket.on('manual_disconnect', async (data) => {
    const chofer_id = data.chofer_id;
    if (chofer_id) {
      if (driverDisconnectTimers[chofer_id]) {
        clearTimeout(driverDisconnectTimers[chofer_id]);
        delete driverDisconnectTimers[chofer_id];
      }
      try {
        await db.query("UPDATE choferes SET is_online = false, estado = 'inactivo' WHERE id = $1", [chofer_id]);
        socket.broadcast.emit('driver_disconnected', { chofer_id });
      } catch (e) {
        console.error('Error al desconectar chofer manualmente:', e);
      }
      // Buscar en connectedDrivers si el socket corresponde
      for (const [sId, cId] of Object.entries(connectedDrivers)) {
        if (cId == chofer_id) delete connectedDrivers[sId];
      }
    }
  });

  // Desconexión de socket (posible pérdida transitoria de red, bloqueo o minimización)
  socket.on('disconnect', async () => {
    console.log(`Socket desconectado: ${socket.id}`);
    const chofer_id = connectedDrivers[socket.id];
    if (chofer_id) {
      delete connectedDrivers[socket.id];

      // PERÍODO DE TOLERANCIA POR INACTIVIDAD TOTAL:
      // Si el socket cae por bloqueo de pantalla o cambio de antena, NO dar de baja al chofer.
      if (driverDisconnectTimers[chofer_id]) {
        clearTimeout(driverDisconnectTimers[chofer_id]);
      }
      driverDisconnectTimers[chofer_id] = setTimeout(async () => {
        try {
          // 1. REGLA FUNDAMENTAL: Si el chofer está en un viaje activo, NUNCA desconectarlo ni tocar su viaje.
          const checkTrip = await db.query(
            "SELECT id FROM viajes WHERE chofer_id = $1 AND estado IN ('solicitado', 'en_camino', 'en_curso')",
            [chofer_id]
          );
          if (checkTrip.rows.length > 0) {
            console.log(`Chofer ${chofer_id} tiene un viaje en curso. NUNCA se desconecta.`);
            return;
          }

          // 2. Si está ocupado (ej. viaje telefónico asignado por la base), tampoco desconectar.
          const checkStatus = await db.query("SELECT estado FROM choferes WHERE id = $1", [chofer_id]);
          if (checkStatus.rows.length > 0 && checkStatus.rows[0].estado === 'ocupado') {
            console.log(`Chofer ${chofer_id} está ocupado con viaje de base. NO se desconecta.`);
            return;
          }

          console.log(`Período de inactividad prolongado para chofer ${chofer_id}. Marcando como inactivo.`);
          await db.query("UPDATE choferes SET is_online = false, estado = 'inactivo' WHERE id = $1", [chofer_id]);
          io.emit('driver_disconnected', { chofer_id });
        } catch (e) {
          console.error('Error al desconectar chofer tras período de inactividad:', e);
        } finally {
          delete driverDisconnectTimers[chofer_id];
        }
      }, 900000); // 15 minutos de inactividad continua sin pulsos de red
    }
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
  const { 
    nombre, 
    apellido, 
    dni, 
    numero_movil, 
    vehiculo_modelo, 
    vehiculo_patente, 
    vencimiento_carnet, 
    datos_pago, 
    domicilio, 
    telefono, 
    email, 
    fecha_nacimiento, 
    vehiculo_color, 
    foto_perfil_base64, 
    foto_dni_base64, 
    foto_auto_base64 
  } = req.body;

  try {
    const safeFechaNacimiento = (fecha_nacimiento && String(fecha_nacimiento).trim() !== '') ? String(fecha_nacimiento).trim() : null;
    const safeVencimientoCarnet = (vencimiento_carnet && String(vencimiento_carnet).trim() !== '') ? String(vencimiento_carnet).trim() : null;
    const safeEmail = (email && String(email).trim() !== '') ? String(email).trim() : null;
    const safeNumeroMovil = (numero_movil !== undefined && numero_movil !== null && String(numero_movil).trim() !== '') ? parseInt(numero_movil, 10) : null;
    const safeId = isNaN(Number(id)) ? id : Number(id);

    // Si viene la foto base64, la actualizamos, si no, mantenemos la existente.
    const updateQuery = `
      UPDATE choferes 
      SET nombre = $1, 
          apellido = $2, 
          dni = $3, 
          numero_movil = $4, 
          vehiculo_modelo = $5, 
          vehiculo_patente = $6, 
          licencia_vencimiento = $7, 
          datos_pago = $8, 
          domicilio = $9, 
          telefono = $10, 
          email = $11, 
          fecha_nacimiento = $12, 
          vehiculo_color = $13,
          foto_url = COALESCE($14, foto_url),
          dni_foto_url = COALESCE($15, dni_foto_url),
          vehiculo_foto_url = COALESCE($16, vehiculo_foto_url)
      WHERE id = $17 RETURNING *
    `;
    const values = [
      nombre, 
      apellido, 
      dni, 
      safeNumeroMovil, 
      vehiculo_modelo || null, 
      vehiculo_patente || null, 
      safeVencimientoCarnet, 
      datos_pago || null, 
      domicilio || null, 
      telefono || null, 
      safeEmail, 
      safeFechaNacimiento, 
      vehiculo_color || null, 
      foto_perfil_base64 || null, 
      foto_dni_base64 || null, 
      foto_auto_base64 || null, 
      safeId
    ];

    const result = await db.query(updateQuery, values);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Chofer no encontrado' });
    res.json({ success: true, chofer: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando chofer:', error);
    res.status(500).json({ success: false, error: error.message || 'Error del servidor' });
  }
});
