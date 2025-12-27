# Instalación de Hocus Focus

## 📦 Archivo de Instalación

**Archivo:** `HocusFocus-1.0.0-arm64.dmg` (90 MB)  
**Ubicación:** `/Users/malva/Desktop/2026/hocus-focus/dist/`

## 🚀 Pasos de Instalación

### 1. Abrir el archivo DMG
- Navega a la carpeta `dist` del proyecto
- Haz doble clic en `HocusFocus-1.0.0-arm64.dmg`

### 2. Instalar la aplicación
- Se abrirá una ventana con el icono de Hocus Focus
- Arrastra el icono a la carpeta **Applications**
- Espera a que se complete la copia

### 3. Primera ejecución

#### Opción A: Si la app abre sin problemas
- Ve a **Applications**
- Haz doble clic en **HocusFocus**
- ¡Listo! La app debería abrir normalmente

#### Opción B: Si macOS bloquea la app
Si ves un mensaje como "HocusFocus no se puede abrir porque proviene de un desarrollador no identificado":

1. Ve a **System Settings** (Configuración del Sistema)
2. Selecciona **Privacy & Security** (Privacidad y Seguridad)
3. Desplázate hacia abajo hasta encontrar el mensaje sobre HocusFocus
4. Haz clic en **"Open Anyway"** (Abrir de todos modos)
5. Confirma haciendo clic en **"Open"** (Abrir)

### 4. Permisos de Administrador

Cuando actives el bloqueo por primera vez, la app solicitará permisos de administrador para modificar el archivo `/etc/hosts`. Esto es normal y necesario para que funcione el bloqueo.

## ⚠️ Notas Importantes

- **Compatibilidad:** Esta versión está optimizada para Apple Silicon (M1/M2/M3)
- **Sin firma:** La app no está firmada digitalmente, por lo que macOS mostrará advertencias de seguridad
- **Permisos:** La app necesita permisos de administrador para funcionar correctamente
- **Primer uso:** La primera vez que actives el bloqueo, se te pedirá tu contraseña de administrador

## 🔧 Solución de Problemas

### La app no abre
1. Verifica que hayas seguido el paso 3, Opción B
2. Intenta hacer clic derecho en la app y seleccionar "Abrir"
3. Si persiste, ejecuta en Terminal:
   ```bash
   xattr -cr /Applications/HocusFocus.app
   ```

### Error de permisos
- Asegúrate de ingresar tu contraseña de administrador cuando se solicite
- La app necesita estos permisos para modificar el archivo hosts del sistema

### La app se cierra inesperadamente
- Abre la app desde Terminal para ver los errores:
  ```bash
  /Applications/HocusFocus.app/Contents/MacOS/HocusFocus
  ```

## 🎯 Uso Básico

1. **Activar Bloqueo:** Click en el toggle en la sección Blocklist
2. **Agregar Sitios:** Escribe la URL en el campo de entrada
3. **Crear Horarios:** Ve a Schedules y haz clic en "Add Schedule"
4. **Ver Estadísticas:** Revisa el Dashboard para ver tu progreso

## 📝 Desinstalación

Para desinstalar Hocus Focus:

1. Cierra la aplicación si está abierta
2. Ve a **Applications**
3. Arrastra **HocusFocus** a la Papelera
4. Vacía la Papelera

Para eliminar los datos de la app:
```bash
rm -rf ~/Library/Application\ Support/hocus-focus
```

---

**¿Necesitas ayuda?** Abre un issue en el repositorio del proyecto.
