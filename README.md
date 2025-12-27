# Hocus Focus 🎯

Una aplicación de productividad para macOS que te ayuda a mantener el enfoque bloqueando sitios web y aplicaciones que causan procrastinación.

![Hocus Focus](Icon-App.png)

## Características ✨

- **Bloqueo Inteligente**: Bloquea automáticamente sitios web que te distraen modificando el archivo hosts del sistema
- **Timer de Seguridad de 15 Minutos**: Requiere esperar antes de poder desactivar el bloqueo, evitando decisiones impulsivas
- **Horarios Programados**: Configura horarios específicos para activar el bloqueo automáticamente según tus necesidades
- **Estadísticas Detalladas**: Visualiza el tiempo ahorrado, sesiones completadas y sitios bloqueados
- **Interfaz Moderna**: Diseño oscuro profesional con gradientes vibrantes y animaciones suaves
- **Tray Icon**: Controla la app desde la barra de menú de macOS sin abrir la ventana principal
- **Búsqueda de Sitios**: Encuentra rápidamente sitios en tu lista de bloqueo
- **Quick Add**: Agrega sitios comunes con un solo clic

## Instalación 🚀

### Opción 1: Instalar desde DMG (Recomendado)

1. Descarga o localiza el archivo `HocusFocus-1.0.0-arm64.dmg` en la carpeta `dist`
2. Abre el archivo DMG
3. Arrastra Hocus Focus a la carpeta Applications
4. Si macOS muestra advertencia de seguridad:
   - Ve a **System Settings > Privacy & Security**
   - Click en **"Open Anyway"**

Para más detalles, consulta [INSTALLATION.md](INSTALLATION.md)

### Opción 2: Ejecutar desde el código fuente

1. Clona o descarga este repositorio
2. Instala las dependencias:

```bash
npm install
```

3. Inicia la aplicación:

```bash
npm start
```


## Uso 💡

### Activar/Desactivar Bloqueo

1. Haz clic en el botón "Activar Bloqueo" en el Dashboard
2. La app solicitará permisos de administrador
3. Una vez activo, los sitios configurados serán bloqueados

Para desactivar:
1. Haz clic en "Desactivar Bloqueo"
2. Espera 15 minutos (timer de seguridad)
3. El bloqueo se desactivará automáticamente

### Configurar Horarios

1. Ve a la sección "Horarios"
2. Haz clic en "Nuevo Horario"
3. Configura:
   - Nombre del horario
   - Hora de inicio y fin
   - Días de la semana
4. El bloqueo se activará automáticamente en los horarios configurados

### Gestionar Sitios Bloqueados

1. Ve a la sección "Sitios Bloqueados"
2. Haz clic en "Agregar Sitio"
3. Ingresa el dominio (ej: `facebook.com`)
4. El sitio se agregará a la lista de bloqueo

### Ver Estadísticas

1. Ve a la sección "Estadísticas"
2. Visualiza:
   - Tiempo total ahorrado
   - Sesiones de enfoque completadas
   - Promedio por sesión

## Sitios Bloqueados por Defecto 🚫

- Facebook
- Twitter/X
- Instagram
- TikTok
- YouTube
- Reddit
- Netflix
- Twitch
- Pinterest
- LinkedIn
- Snapchat

## Desarrollo 🛠️

### Estructura del Proyecto

```
hocus-focus/
├── main.js           # Proceso principal de Electron
├── preload.js        # Script de preload (seguridad)
├── renderer.js       # Lógica de la interfaz
├── index.html        # Estructura HTML
├── styles.css        # Estilos CSS
├── package.json      # Configuración del proyecto
└── Icon-App.png      # Icono de la aplicación
```

### Comandos Disponibles

```bash
# Modo desarrollo
npm start

# Construir aplicación
npm run build
```

## Cómo Funciona 🔧

Hocus Focus modifica el archivo `/etc/hosts` del sistema para redirigir los sitios bloqueados a `127.0.0.1`, haciendo que sean inaccesibles. Cuando el bloqueo está activo, agrega líneas como:

```
127.0.0.1 facebook.com # Hocus Focus Block
127.0.0.1 www.facebook.com # Hocus Focus Block
```

Al desactivar, elimina estas líneas y limpia el caché DNS.

## Seguridad 🔒

- Requiere permisos de administrador solo cuando se activa/desactiva el bloqueo
- Crea un backup del archivo hosts original
- Timer de 15 minutos para evitar desactivaciones impulsivas
- Comunicación segura entre procesos usando `contextBridge`

## Licencia 📄

MIT License - Siéntete libre de usar y modificar este proyecto.

## Contribuciones 🤝

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Soporte 💬

Si encuentras algún problema o tienes sugerencias, por favor abre un issue en el repositorio.

---

**Nota**: Esta aplicación requiere permisos de administrador para funcionar correctamente. Asegúrate de entender los cambios que hace al sistema antes de usarla.
