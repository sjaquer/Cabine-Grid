# **App Name**: CyberGrid Console

## Core Features:

- Panel de Control de Máquinas: Visualización en tiempo real del estado (Libre/Ocupado), número de PC, tiempo transcurrido o restante, y tipo de tarifa asignada para cada máquina en un grid interactivo. Incluye botones de acción por tarjeta.
- Gestión de Sesiones (Inicio/Fin): Funcionalidad para iniciar nuevas sesiones asignando una PC, tarifa (A o B) y modo de uso (Tiempo Libre/Prepago). Permite finalizar sesiones activas y activa el proceso de cobro.
- Temporizador y Alertas de Uso: Sistema de temporización que cuenta hacia adelante para Tiempo Libre y hacia atrás para Tiempo Prepago. Emite alertas visuales cuando el tiempo prepagado está por terminar.
- Cálculo Automatizado de Cobro: Algoritmo preciso que calcula el monto a cobrar basado en la tarifa y los minutos de uso, aplicando la lógica 'por hora o fracción' con redondeo al alza. Muestra el total al finalizar la sesión.
- Persistencia de Datos en Tiempo Real: Uso de Firebase Firestore para guardar y sincronizar los estados de las máquinas, sesiones activas y datos de clientes, asegurando que la información no se pierda ante recargas o cierres del navegador.
- Historial y Sumario de Ventas Diarias: Sección dedicada a visualizar un registro de todas las sesiones finalizadas y un sumario del recaudo total del día.
- Búsqueda Rápida de Clientes (MVP): Herramienta simple para buscar y seleccionar clientes existentes al asignar una máquina.

## Style Guidelines:

- Esquema de color oscuro ('gamer style') para la interfaz general, enfocado en una estética tecnológica y de bajo contraste. Los elementos de interacción y notificaciones usarán colores vibrantes.
- Color principal: Azul tecnológico y saturado (#5252E0) para elementos clave como botones y selecciones, transmitiendo confianza y modernidad.
- Color de fondo: Un gris muy oscuro con un sutil matiz azul (#1A1A23), que sirve como base para el 'modo oscuro' y contrasta con los elementos interactivos.
- Color de acento: Un azul cian brillante (#75B3F0) utilizado para resaltados importantes, estados activos o para dirigir la atención a notificaciones.
- Colores de estado contextuales y vibrantes: Verde para máquinas disponibles, Rojo para ocupadas y Amarillo para alertar sobre tiempo restante o próximo fin de sesión.
- Encabezados y elementos clave: 'Space Grotesk' (sans-serif) para un estilo tecnológico y moderno. Cuerpo de texto: 'Inter' (sans-serif) para asegurar una alta legibilidad y un aspecto objetivo en la visualización de datos y temporizadores.
- Iconos modernos, lineales y de alto contraste que destaquen sobre el fondo oscuro, representando claramente las acciones y estados (por ejemplo, iconos de 'play', 'pausa', 'dinero').
- Diseño responsive basado en una cuadrícula (grid) para la vista principal de máquinas, garantizando una disposición organizada y adaptable. Las tarjetas individuales de PC serán limpias, espaciadas y jerárquicas.
- Transiciones suaves para los cambios de estado de las tarjetas (por ejemplo, de Libre a Ocupado), efectos sutiles de hover en botones y actualizaciones fluidas de los temporizadores para una experiencia de usuario dinámica.