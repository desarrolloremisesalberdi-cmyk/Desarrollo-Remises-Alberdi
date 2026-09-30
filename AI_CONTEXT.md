# Contexto del Proyecto: Desarrollo Remises Alberdi 🚖

Este archivo contiene el contexto completo del desarrollo actual del sistema para ser cargado en asistentes de Inteligencia Artificial. **Si eres un asistente de IA leyendo esto, asume este contexto para continuar trabajando en el proyecto de forma alineada con la arquitectura y la lógica establecida.**

## 🏗️ Arquitectura General
El sistema está compuesto por 4 partes principales:
1. **Backend:** Servidor Node.js con Express, WebSockets (Socket.io) y base de datos PostgreSQL alojada en Supabase.
2. **App Pasajero:** Aplicación desarrollada en React Native (Expo) compilada tanto para web como para móviles. 
3. **App Chofer:** Aplicación desarrollada en React Native (Expo) para los conductores.
4. **Web Operador:** Panel de control de administración web hecho en React (Vite/CRA) para gestionar la flota, viajes y ver métricas.

## 💾 Base de Datos y Almacenamiento (Supabase)
- **Motor:** PostgreSQL (Supabase).
- **Tablas principales:** `usuarios` (clientes), `choferes`, y `viajes`.
- **Buckets de Storage:** Hemos creado e integrado un Bucket público en Supabase (`dni-fotos`) para almacenar las imágenes de frente del DNI de los usuarios que se registran.
- **Autenticación:** Todo el manejo de sesiones en la app móvil se apoya en contraseñas cifradas usando la librería `bcrypt`. Para la recuperación de cuenta, el backend envía un token por correo electrónico usando `nodemailer`.

## ⚙️ Características Desarrolladas (Hitos)

### 1. Sistema de Autenticación Completo (Chofer y Pasajero)
- **Endpoints del Backend:**
  - `/api/users/register`: Maneja el registro de pasajeros. Recibe base64 de la foto del DNI, lo sube al Storage de Supabase y guarda el registro. Las claves se encriptan con `bcrypt`.
  - `/api/users/login` y `/api/choferes/login`: Validan DNI y clave.
  - `/api/users/forgot-password`: Envía token de 6 dígitos al correo.
  - `/api/users/reset-password`: Valida el token y setea una nueva clave.
- **Frontend App Pasajero y Chofer:**
  - Se crearon pantallas (`LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`).
  - **Recordar Usuario:** Ambas apps de Chofer y Pasajero tienen un `Switch` para "Recordar usuario". Esto guarda las credenciales en local usando `@react-native-async-storage/async-storage` (y `localStorage` en web) para autocompletar el login en sesiones futuras.

### 2. Flujo de Viaje y Modo Jubilado (Tarifa con Descuento)
- Los pasajeros tienen un campo en la base de datos `es_jubilado` (booleano).
- **Backend:** Cuando un pasajero solicita un viaje (`/api/viajes/request`), el backend consulta su estatus de jubilado, su nombre y su DNI, y lo adjunta al objeto del viaje antes de emitir la alerta por socket (`new_ride_request`).
- **App Chofer:**
  - Al saltar la alerta modal del nuevo viaje, la app lee si `es_jubilado === true`. De ser así, muestra un cartel verde muy visible advirtiendo: **"¡ATENCIÓN: PASAJERO JUBILADO! Aplica Tarifa con Descuento"**.
  - Cuando el chofer *Acepta* el viaje, la interfaz muestra el viaje activo.
  - **Mecanismo de Seguridad:** El botón de **"Empezar Recorrido"** se bloquea (se pone gris) en viajes de jubilados, y aparece un recuadro verde que dice "Tocar para Confirmar DNI". El chofer está obligado a tocar este botón (validando visualmente el DNI del pasajero) antes de que el botón de "Empezar Recorrido" se vuelva azul y funcional.

### 3. Mapa del Web Operador (Panel de Administración)
- Se actualizó el proveedor de mapas del operador web. Inicialmente se usaba CARTO pero retiraron sus capas gratuitas sin API Key.
- Luego de probar OpenStreetMap (OSM) y hacer adaptaciones CSS, decidimos migrar definitivamente a **Google Maps** (usando los Tiles estándar) para unificar la experiencia visual en todo el ecosistema (cliente, chofer y operador).

## 🚀 Tecnologías y Dependencias Clave
- `@react-native-async-storage/async-storage`: Usado en Pasajero/Chofer para recordar sesiones.
- `expo-image-picker`: Usado en el registro para capturar foto de DNI.
- `@supabase/supabase-js`: Configurado en el backend (`index.js`) para subir archivos.
- `nodemailer`, `bcrypt`: Usados en backend para seguridad.
- `react-leaflet` / Map Tiles: Usados en el Web Operador.
- `socket.io` / `socket.io-client`: Usado para la conexión en tiempo real de ubicación y despacho de viajes.

## 📝 Cómo continuar el desarrollo (Para el/la programador/a y su IA)
1. **Punto de partida:** Todo el código actual funciona de forma fluida. Si vas a modificar endpoints de viaje o perfiles, revisa primero `backend/index.js` que contiene toda la lógica monolítica centralizada.
2. **Interfaz Gráfica:** Mantenemos una paleta de colores cohesiva y diseño "glassmorphism" en varias secciones (paneles transparentes con desenfoque). No uses componentes nativos puros sin antes adaptarlos al estilo del proyecto.
3. **Flujo Sockets:** Recordá que `app-pasajero` también cuenta con código legado que emite a veces eventos directos (e.g. `request_ride_direct`). Analiza la consola del server si haces cambios en cómo se gestionan los estados de viaje.

¡Manos a la obra y éxito con el código! 💻✨
