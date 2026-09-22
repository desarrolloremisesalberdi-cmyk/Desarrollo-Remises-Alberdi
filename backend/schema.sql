-- Esquema inicial para Plataforma de Taxis Alberdi (PostgreSQL / Supabase)

-- Habilitar extensión PostGIS para geolocalización (si se requiere a futuro)
-- create extension if not exists postgis;

-- 1. Tabla de Usuarios (Pasajeros)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(50) NOT NULL,
    observaciones TEXT,
    dni_foto_url TEXT,
    es_jubilado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Choferes (Taxistas/Remiseros)
CREATE TABLE IF NOT EXISTS public.choferes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    clave VARCHAR(255),
    telefono VARCHAR(50),
    domicilio VARCHAR(255),
    dni VARCHAR(20),
    fecha_nacimiento DATE,
    dni_foto_url TEXT,
    datos_pago TEXT, -- Alias, CBU, MercadoPago
    estado VARCHAR(20) DEFAULT 'inactivo', -- libre, ocupado, inactivo, deshabilitado
    numero_movil INT,
    -- Datos del Vehículo
    vehiculo_modelo VARCHAR(100),
    vehiculo_color VARCHAR(50),
    vehiculo_patente VARCHAR(20) UNIQUE,
    vehiculo_foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Viajes
CREATE TABLE IF NOT EXISTS public.viajes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id),
    chofer_id UUID REFERENCES public.choferes(id),
    estado VARCHAR(20) DEFAULT 'solicitado', -- solicitado, en_camino, en_curso, finalizado, cancelado
    origen_lat DOUBLE PRECISION,
    origen_lng DOUBLE PRECISION,
    destino_lat DOUBLE PRECISION,
    destino_lng DOUBLE PRECISION,
    monto_calculado DECIMAL(10, 2),
    comision_admin DECIMAL(10, 2),
    distancia_km DECIMAL(10, 2),
    hora_inicio TIMESTAMP WITH TIME ZONE,
    hora_fin TIMESTAMP WITH TIME ZONE,
    metodo_pago VARCHAR(20), -- efectivo, mercadopago
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Tarifas
CREATE TABLE IF NOT EXISTS public.tarifas (
    id SERIAL PRIMARY KEY,
    bajada_bandera_diurna DECIMAL(10, 2) NOT NULL,
    precio_100m_diurna DECIMAL(10, 2) NOT NULL,
    bajada_bandera_jubilados DECIMAL(10, 2) NOT NULL,
    precio_100m_jubilados DECIMAL(10, 2) NOT NULL,
    bajada_bandera_nocturna DECIMAL(10, 2) NOT NULL,
    precio_100m_nocturna DECIMAL(10, 2) NOT NULL,
    porcentaje_comision_agencia DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
