# Andino Wallet

Una Progressive Web App (PWA) especializada para montañistas, diseñada para gestionar cuentas blockchain, bitácoras de montañismo, emergencias y documentación de expediciones en redes Polkadot/Substrate.

## 🏔️ Para Montañistas

Andino Wallet es tu compañero digital en la montaña. Gestiona tus expediciones, registra tus aventuras, mantén tus documentos seguros y activa emergencias cuando las necesites, todo desde tu dispositivo móvil, incluso sin conexión.

## 🚀 Características Principales

### 🗻 Bitácoras de Montañismo
- **Registro de expediciones** - Crea bitácoras detalladas de tus aventuras
- **Avisos de salida** - Registra información de tu grupo, ruta y contactos de emergencia
- **Milestones GPS** - Marca puntos importantes con coordenadas precisas
- **Tracking GPS** - Registra tu ruta en tiempo real
- **Mapas offline** - Visualiza tus rutas sin necesidad de conexión
- **Fotos y notas** - Documenta tu expedición con imágenes y anotaciones

### 🚨 Sistema de Emergencias
- **Botón de emergencia** - Activa una emergencia con un solo toque
- **Registro en blockchain** - Las emergencias se registran de forma inmutable en Polkadot
- **Datos de ubicación** - Comparte automáticamente tu posición GPS
- **Contexto completo** - Incluye información de tu bitácora activa
- **Escucha en tiempo real** - Recibe notificaciones de emergencias de tu cuenta
- **Funciona offline** - Guarda emergencias localmente y sincroniza cuando hay conexión

### 📄 Documentos y Credenciales
- **Almacenamiento seguro** - Guarda documentos importantes (permisos, seguros, certificados)
- **Firmas digitales** - Firma documentos con tu identidad blockchain
- **Firmas autográficas** - Captura firmas manuscritas directamente en la app
- **Exportación PDF** - Genera documentos PDF con toda la información
- **Acceso offline** - Consulta tus documentos sin conexión

### 🔐 Seguridad Blockchain
- **Wallet no custodial** - Tus claves privadas nunca salen de tu dispositivo
- **WebAuthn** - Autenticación biométrica (huella, Face ID, hardware keys)
- **Encriptación AES-256** - Protección de datos con contraseña
- **Multi-cadena** - Soporte para Polkadot, Kusama, Paseo y sus parachains
- **People Chain** - Gestiona tu identidad on-chain

### 📱 Experiencia de Usuario
- **Mobile-first** - Diseñado para usar en la montaña con una sola mano
- **Offline-first** - Funciona completamente sin conexión a internet
- **Instalable** - Instala como app nativa en tu dispositivo
- **UI intuitiva** - Interfaz simple y clara, incluso con guantes
- **Modo oscuro** - Protege tus ojos en condiciones de poca luz

## 🎯 Casos de Uso

### Antes de la Expedición
1. **Crear bitácora** - Registra los detalles de tu próxima aventura
2. **Aviso de salida** - Completa información del grupo, ruta y contactos
3. **Subir documentos** - Guarda permisos, seguros y certificaciones
4. **Preparar mapas** - Descarga mapas offline de tu ruta

### Durante la Expedición
1. **Tracking GPS** - Registra tu ruta en tiempo real
2. **Agregar milestones** - Marca puntos importantes (campamentos, cumbres, cruces)
3. **Tomar fotos** - Documenta tu aventura con imágenes geolocalizadas
4. **Activar emergencia** - Si es necesario, activa una emergencia con un toque

### Después de la Expedición
1. **Revisar bitácora** - Consulta todos los detalles de tu expedición
2. **Exportar documentos** - Genera PDFs con toda la información
3. **Compartir** - Comparte tu aventura con otros montañistas
4. **Archivar** - Guarda tus bitácoras para futuras referencias

## 📦 Instalación

Este proyecto usa **Yarn** como gestor de paquetes:

```bash
# Instalar Yarn globalmente (si no lo tienes)
npm install -g yarn

# Instalar dependencias
yarn install
```

## 🛠️ Desarrollo

```bash
# Iniciar servidor de desarrollo
yarn dev

# El servidor estará disponible en:
# - Local: http://localhost:5173/
# - Red: http://[tu-ip]:5173/
```

## 🏗️ Build

```bash
# Construir para producción
yarn build

# Vista previa de la build de producción
yarn preview
```

## 🌐 Redes Blockchain Soportadas

### Redes Principales
- **Polkadot** - Red principal de Polkadot
- **Kusama** - Canary network de Polkadot
- **Paseo** - Testnet de Polkadot

### Parachains
- **Asset Hub** - Gestión de assets
- **People Chain** - Identidad on-chain
- **Bridge Hub** - Puentes cross-chain

## 🔑 Funcionalidades Técnicas

### Gestión de Cuentas
- Crear y gestionar múltiples cuentas blockchain
- Importar cuentas desde mnemonic o archivos JSON
- Backup completo y seguro de todas tus cuentas
- Soporte para sr25519, ed25519 y ecdsa

### Transacciones
- Enviar y recibir tokens
- Ver historial de transacciones
- Estimar fees antes de enviar
- QR codes para recibir pagos

### Seguridad
- **WebAuthn** - Autenticación con PIN, huella o hardware key
- **Encriptación local** - Todos los datos se almacenan encriptados
- **Backup seguro** - Exporta tus datos encriptados con contraseña
- **Recuperación** - Restaura tu wallet desde un backup

## 📚 Documentación

La documentación completa está disponible en la carpeta `docs/`:

- **[Plan PWA Emergencias](./docs/PLAN_PWA_EMERGENCIAS_MINIMA.md)** - Plan para versión mínima de emergencias
- **[GPS Tracking](./docs/GPS_TRACKING.md)** - Sistema de tracking GPS
- **[Base de Datos](./docs/AURA_WALLET_DATABASE.md)** - Estructura de IndexedDB
- **[WebAuthn](./docs/WEBAUTHN_IMPLEMENTATION.md)** - Implementación de WebAuthn
- **[Capacidades Offline](./docs/PWA_OFFLINE_CAPABILITIES.md)** - Funcionamiento offline

## 🛡️ Seguridad

### ⚠️ Advertencia Importante

Andino Wallet es una aplicación **no custodial**. Esto significa:

- **Tú eres el único responsable** de tus claves privadas y fondos
- **Guarda tu frase de recuperación** en un lugar seguro
- **Nunca compartas** tu frase de recuperación con nadie
- **Si pierdes tu frase de recuperación**, perderás acceso permanente a tus fondos
- **No hay forma de recuperar** tu cuenta sin la frase de recuperación

### Mejores Prácticas

1. **Backup regular** - Exporta tu wallet regularmente
2. **Contraseña segura** - Usa una contraseña fuerte y única
3. **WebAuthn** - Configura autenticación biométrica
4. **Verifica direcciones** - Siempre verifica las direcciones antes de enviar
5. **Mantén actualizado** - Mantén la aplicación actualizada

## 🏗️ Stack Tecnológico

- **Vite 7** - Build tool ultra rápido
- **React 18** - Framework UI
- **TypeScript** - Tipado estático completo
- **Tailwind CSS 4** - Framework CSS moderno
- **shadcn/ui** - Componentes UI accesibles
- **Dedot** - Cliente JavaScript para Polkadot
- **Polkadot.js Keyring** - Gestión de cuentas criptográficas
- **IndexedDB** - Almacenamiento local encriptado
- **Leaflet** - Mapas interactivos
- **WebAuthn API** - Autenticación biométrica
- **Workbox** - Service Worker para capacidades offline

## 🎯 Roadmap

### Próximas Características
- [ ] Integración con servicios de emergencia externos
- [ ] Compartir bitácoras con otros montañistas
- [ ] Estadísticas de expediciones
- [ ] Integración con dispositivos GPS externos
- [ ] Notificaciones push para emergencias
- [ ] Modo avión mejorado

## 📝 Licencia

MIT

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request para cualquier mejora o corrección.

## 📧 Contacto

Para preguntas o soporte, por favor abre un issue en el repositorio.

---

**Andino Wallet** - Tu compañero digital en la montaña 🏔️
