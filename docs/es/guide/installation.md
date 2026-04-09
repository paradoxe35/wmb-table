# Instalación

<p class="lead">Esta página explica cómo instalar Wmb Table en Windows, macOS y Linux, incluida la autorización manual que actualmente hace falta en macOS.</p>

## Antes de comenzar

Descargue Wmb Table desde la sección de descargas de la página principal y elija el archivo adecuado para su equipo:

- Windows: `.exe`
- macOS Apple Silicon: `.dmg`
- macOS Intel: `.dmg`
- Linux: `.AppImage`, `.deb` o `.tar.gz`

## Windows

Para la mayoría de los usuarios, el archivo más sencillo es el instalador `.exe`.

<ScreenshotPlaceholder
  file="es-installation-windows-installer.png"
  label="Instalador de Windows o aviso de seguridad"
  hint="Mostrar la ventana del instalador de Wmb Table o el aviso de seguridad de Windows antes de la instalación."
/>

1. Descargue el archivo `.exe` para Windows.
2. Abra el archivo.
3. Siga los pasos de instalación que aparecen en pantalla.
4. Abra Wmb Table cuando termine la instalación.

Si Windows muestra una advertencia de seguridad, revise el mensaje y continúe solo si el archivo proviene de la página oficial de descarga de Wmb Table.

## macOS

Wmb Table no está firmado actualmente en macOS.

Por eso, macOS puede bloquear la primera apertura hasta que usted lo autorice manualmente.

### Instalar la aplicación

<ScreenshotPlaceholder
  file="es-installation-macos-dmg.png"
  label="Ventana DMG en macOS"
  hint="Mostrar el DMG abierto con Wmb Table y la carpeta Aplicaciones."
/>

1. Descargue el archivo `.dmg` que corresponde a su Mac.
2. Abra el `.dmg`.
3. Arrastre `Wmb Table` a `Aplicaciones`.

### Autorizar la primera apertura

<ScreenshotPlaceholder
  file="es-installation-macos-open-anyway.png"
  label="Autorización de macOS en Privacidad y seguridad"
  hint="Mostrar la página de Privacidad y seguridad con el mensaje de bloqueo y el botón Abrir de todos modos."
/>

1. Abra `Aplicaciones`.
2. Intente abrir `Wmb Table`.
3. Cuando macOS bloquee la aplicación, cierre el aviso.
4. Abra `Configuración del Sistema`.
5. Vaya a `Privacidad y seguridad`.
6. Baje hasta la sección de seguridad.
7. Busque el mensaje que indica que macOS bloqueó Wmb Table.
8. Haga clic en `Abrir de todos modos`.
9. Confirme con `Abrir`.

Después de eso, la aplicación debería abrirse normalmente.

### Otro método posible

En algunos Mac también funciona esto:

1. Abra `Aplicaciones`.
2. Haga clic derecho en `Wmb Table`.
3. Haga clic en `Abrir`.
4. Confirme con `Abrir`.

Si macOS sigue bloqueando la aplicación, use el método `Configuración del Sistema > Privacidad y seguridad > Abrir de todos modos`.

## Linux

Puede elegir el formato que mejor se adapte a su sistema.

### AppImage

Normalmente es la opción más sencilla.

<ScreenshotPlaceholder
  file="es-installation-linux-appimage.png"
  label="Archivo AppImage en Linux o primer inicio"
  hint="Mostrar el archivo AppImage descargado, el permiso de ejecución o el primer inicio desde el administrador de archivos."
/>

1. Descargue el archivo `.AppImage`.
2. Déle permiso de ejecución si hace falta.
3. Ábralo.

Si su administrador de archivos no le permite abrirlo directamente, ejecute:

```bash
chmod +x Wmb-Table-*.AppImage
./Wmb-Table-*.AppImage
```

### Debian o Ubuntu

Si prefiere un paquete del sistema, descargue el archivo `.deb` e instálelo con su gestor de paquetes.

### tar.gz

Use esta opción si prefiere una instalación portátil manual.

Extraiga el archivo y luego abra la aplicación desde la carpeta extraída.

## Qué archivo elegir

- Windows: use `.exe`
- macOS: use el `.dmg` correspondiente a su Mac
- Linux: use primero `.AppImage`, salvo que quiera específicamente `.deb` o `.tar.gz`

## Si la aplicación no se abre

- confirme que descargó el archivo correcto para su sistema
- en macOS, complete la autorización manual en `Privacidad y seguridad`
- en Linux, asegúrese de que AppImage tenga permiso de ejecución
- vuelva a descargar el archivo si la primera descarga quedó incompleta

## Ver también

- [Primeros pasos](/es/guide/getting-started)
- [Preguntas y solución de problemas](/es/guide/troubleshooting)
