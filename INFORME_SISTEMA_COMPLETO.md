# 🚖 Sistema Integral Radio Taxis Alberdi
## Manual Informativo de Funciones — Apps y Panel de Control

Este documento detalla todas las herramientas y funciones del sistema de **Radio Taxis Alberdi**, dividido en sus tres partes principales:
1. **App para el Chofer (Celular)**
2. **App para el Pasajero (Celular)**
3. **Panel Web de Administración y Despacho (Computadora de la Agencia)**

---

## 📱 PARTE 1: Aplicación del Chofer (`App Chofer`)

Pensada como la herramienta de trabajo diario del conductor, diseñada con **modo nocturno permanente** (fondo oscuro) que cuida la vista, no encandila al manejar de noche y ahorra batería.

### 1. Inicio de Turno y Estado del Móvil
* **Ingreso rápido y seguro:** El chofer ingresa con su DNI y contraseña personal.
* **Control de disponibilidad:** 
  * **Libre:** El chofer se pone disponible en el mapa para que el sistema o la operadora le envíen viajes cercanos.
  * **Inactivo / Desconectado:** Cuando hace una pausa, almuerza o termina su turno, no recibe avisos de viajes.

### 2. Recepción de Viajes
* **Alerta sonora y visual:** Al surgir un viaje (pedido desde la app de pasajero o cargado por la agencia), el celular suena y muestra una pantalla emergente con:
  * Dirección exacta de subida (origen) y destino.
  * Nombre del pasajero.
  * Distancia y precio estimado del recorrido.
* **Aceptar o Rechazar:** El chofer decide aceptar el viaje con un solo toque o rechazarlo si no puede tomarlo para que pase al siguiente móvil.

### 3. Guiado y Notificaciones de Llegada
* **Mapa con navegación GPS:** Al aceptar, el mapa le marca el recorrido más rápido para llegar al pasajero.
* **Aviso automático "Llegué a destino":** Cuando el móvil llega a la puerta del pasajero, el chofer presiona un botón y el pasajero recibe una notificación inmediata en su celular ("Tu taxi está en la puerta"), evitando bocinazos innecesarios.

### 4. Control de Viaje y Espera
* **Iniciar Viaje:** Se activa al subir el pasajero al auto. El GPS empieza a calcular la distancia real recorrida.
* **Cronómetro de Espera:** Si el pasajero pide parar en un negocio, cajero o farmacia, el chofer toca **"Iniciar Espera"**. El sistema cronometra los minutos y calcula el costo exacto según la tarifa fijada por la agencia.
* **Finalizar Viaje y Ticket en Pantalla:** Al llegar a destino, la app desglosa el monto exacto: bajada de bandera, kilómetros recorridos y minutos de espera.

### 5. Pagos y Cobros Fuera de Casilda (Sanford, etc.)
* **Aviso previo de viaje interurbano:** El chofer sabe de antemano si el viaje proviene de otra localidad.
* **Comprobante bancario en pantalla:** Si el pasajero transfiere el dinero, la pantalla del chofer muestra la **foto del comprobante en grande** para chequear el número de operación y monto antes de arrancar.
* **Validar y Salir:** Con el botón **"Validar Pago y Salir"**, el chofer da el visto bueno al viaje. Si el dinero no se acreditó, puede rechazar el comprobante en el momento.
* **Pago en efectivo:** Si el pasajero no tiene cuenta digital, el chofer cobra en mano al llegar a destino de forma habitual.

### 6. Resumen del Turno y Reputación
* **Cierre de jornada:** Muestra cuántos viajes se completaron, el total recaudado en el turno, cuánto se cobró en efectivo y cuánto por transferencia digital.
* **Estrellas y Calificaciones:** Muestra el promedio de satisfacción (1 a 5 estrellas) basado en las valoraciones que dejaron los pasajeros atendidos.

---

## 📲 PARTE 2: Aplicación del Pasajero (`App Pasajero`)

Diseñada para que pedir un taxi en Casilda sea rápido, seguro y accesible para usuarios de cualquier edad.

### 1. Pedir un Taxi en Segundos
* **Ubicación automática por GPS:** La app detecta dónde está la persona al abrirla sin tener que escribir toda la dirección.
* **Buscador de destinos inteligente:** Permite ingresar direcciones, esquinas o lugares conocidos de Casilda y pueblos vecinos.
* **Precio antes de viajar:** Muestra el costo estimado del viaje antes de confirmar el pedido, garantizando total transparencia.
* **Botón principal "PEDIR TAXI ALBERDI":** Con un toque, el sistema busca el móvil más cercano disponible.

### 2. Información del Auto y del Chofer (Tranquilidad)
* **Datos a la vista:** En cuanto el móvil acepta el viaje, el pasajero ve:
  * Número de móvil asignado (ej: *Móvil #14*).
  * Nombre y foto del chofer.
  * Marca, modelo, color y patente del vehículo (ej: *Fiat Cronos Blanco - AB123CD*).
* **Auto en vivo sobre el mapa:** Ve el auto acercándose en tiempo real calle por calle con el tiempo estimado de llegada en minutos.

### 3. Viajes desde Pueblos Vecinos y Pagos Flexibles
* **Alerta de viaje interurbano:** Si el pedido se hace desde Sanford u otra localidad vecina, la app le avisa con amabilidad las opciones de pago disponibles.
* **Transferencia Bancaria Fácil:**
  * La app le muestra el Alias/CBU con un botón para copiarlo al portapapeles con un clic.
  * Permite subir la captura o foto del comprobante de transferencia bancaria directamente desde la app.
  * Muestra el estado del pago: *"Comprobante enviado - En revisión por el chofer"* y *"Pago aprobado"*.
* **Efectivo al chofer:** Quienes no usan billeteras virtuales pueden solicitar el taxi en efectivo sin complicaciones.

### 4. Seguridad de la Familia: Compartir Viaje en Tiempo Real
* **Enlace para WhatsApp:** Con el botón **"Compartir Viaje"**, el pasajero genera un enlace que puede enviar a familiares o amigos.
* **Sin necesidad de instalar la app:** La persona que recibe el mensaje puede abrir el enlace en cualquier celular o PC y ver en vivo por dónde va el taxi hasta llegar a destino.

### 5. Calificación del Servicio
* **5 Estrellas:** Al terminar el viaje, el pasajero califica la atención, la limpieza del auto y la puntualidad, permitiendo destacar a los buenos conductores de la flota.

---

## 🖥️ PARTE 3: Panel de Administración y Despacho (`Web Operador`)

Es el centro de control de la agencia, utilizado por las operadoras y los dueños desde la computadora para organizar la flota, los viajes y la caja.

### 1. Mapa en Vivo (Despacho y Monitoreo de Flota)
* **Vista satelital de Casilda:** Muestra la posición GPS de todos los móviles en tiempo real sobre la ciudad.
* **Semáforo de estado de los móviles:**
  * 🟢 **Verde:** Móvil libre y disponible para recibir viajes.
  * 🟠 **Naranja/Amarillo:** Móvil ocupado / en viaje con pasajero.
  * 🔵 **Azul:** Móvil en camino a buscar al pasajero.
  * 🔴 **Rojo/Gris:** Móvil desconectado o fuera de servicio.
* **Carga de viajes por teléfono:** Si un cliente llama por teléfono a la base, la operadora carga la dirección y el sistema le asigna el móvil correspondiente o lo despacha manualmente.
* **Control manual de estado:** Si un chofer avisa por radio que se detiene por auxilio mecánico o parada personal, la operadora puede cambiar su estado con un clic.

### 2. Gestión Integral de Choferes y Vehículos
* **Ficha completa de cada móvil:**
  * Foto de perfil del conductor, foto del auto, foto del carnet de conducir y del DNI.
  * Datos del vehículo: **Marca y Modelo** (*ej: Chevrolet Corsa, Fiat Cronos*), Patente, Color y Número de Móvil.
  * CBU / Alias para cobros bancarios.
* **Semáforo de Carnet de Conducir:**
  * 🟢 **Al Día:** Carnet con vigencia normal.
  * 🟠 **Por Vencer:** Alerta preventiva si faltan menos de 30 días para su vencimiento.
  * 🔴 **Vencido:** Alerta roja para evitar que circulen coches en infracción.
* **Habilitar o Suspender Móviles:** Botón de un solo clic para suspender temporalmente a un móvil (por ejemplo, si tiene el carnet vencido o el seguro impago) e impedir que reciba viajes hasta que regularice su situación.
* **Alta de Nuevos Choferes:** Formulario guiado para cargar nuevos vehículos con sus fotos y documentación.

### 3. Reportes, Caja y Liquidaciones Financieras
* **Cálculo automático de porcentajes:** Aplica automáticamente la comisión fijada por la agencia (ej: 15%) sobre los viajes completados.
* **Panel Didáctico de Períodos:**
  * **Semana (De Domingo a Domingo):** Toma la semana completa con corte los domingos a las 23:59 hs. Incluye botones para consultar semanas anteriores o siguientes.
  * **Quincena (1ª y 2ª Quincena):** Diseñado a medida para la modalidad de las remiseras:
    * *1ª Quincena:* Del día 1 al 15 del mes.
    * *2ª Quincena:* Del día 16 al último día del mes.
    * Permite auditar quincenas de meses pasados en un toque.
  * **Mensual:** Balance global del mes calendario.
  * **Hoy e Histórico:** Control de caja diaria o auditoría general de todos los viajes.
* **Filtro por Chofer:** La operadora puede elegir **"Móvil #14 - Chofer Principal"** y el sistema filtra inmediatamente:
  * Cuántos viajes realizó ese móvil.
  * Total recaudado.
  * Cuánto debe rendir a la agencia por comisión.
  * Cuánto dinero cobró en efectivo y cuánto por transferencia.
* **Auditoría de Comprobantes Bancarios:** Si hubo transferencias, la tabla muestra un botón **"Comprobante"** para revisar la foto del recibo bancario en cualquier momento ante cualquier duda o reclamo.

### 4. Configuración Centralizada de Tarifas
Desde este panel la administración actualiza los precios oficiales de la remisera, los cuales se sincronizan al instante en todos los celulares:
* Bajada de bandera diurna y nocturna.
* Ficha cada 100 metros (diurna y nocturna).
* Tarifa especial para jubilados.
* Costo por hora o fracción de espera.
* Precio por kilómetro extra para viajes rurales o de larga distancia.
* Porcentaje de comisión de la agencia.

---

### 📌 Resumen de Beneficios Clave

| Beneficio | Para el Chofer | Para el Pasajero | Para la Agencia |
| :--- | :--- | :--- | :--- |
| **Seguridad** | No pasa su WhatsApp personal; valida el comprobante antes de viajar fuera de Casilda. | Sabe qué auto y qué chofer lo viene a buscar; puede compartir el viaje con su familia. | Conoce la ubicación en tiempo real de todos los coches las 24 horas. |
| **Claridad en la Plata** | Rendiciones por quincena (1-15 y 16-fin) y semana (dom-dom) exactas y transparentes. | Sabe cuánto le va a costar el viaje antes de subir al auto. | Control exacto de comisiones, recaudación y cobros bancarios sin desfasajes de caja. |
| **Comodidad** | App en modo oscuro, mapa fluido y cronómetro de espera automático. | Pide con un solo toque y recibe aviso cuando el taxi está en la puerta. | Despacho automático de viajes y gestión ágil de altas de choferes y documentación. |
