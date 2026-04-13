# Política de privacidad

_Última actualización: 13 de abril de 2026_

Esta Política de privacidad explica cómo Wmb Table trata la información cuando usted utiliza:

- la aplicación de escritorio Wmb Table
- el sitio de documentación de Wmb Table

Esta página fue redactada a partir de las funciones actualmente implementadas en el código de la aplicación y del sitio de documentación.

## Resumen simple

Wmb Table almacena la mayor parte de los datos del usuario localmente en su dispositivo.

Según las funciones que active, la aplicación también puede comunicarse con servicios de terceros para:

- comprobar y descargar actualizaciones de la aplicación
- descargar paquetes de idioma, modelos locales de IA o modelos locales de TTS
- reproducir o poner en caché ciertos archivos de audio remotos
- enviar solicitudes al proveedor de IA que usted elija
- enviar texto al proveedor de voz en línea que usted elija
- hacer copia de seguridad y sincronizar ciertos datos mediante Google Drive si activa esa función
- enviar informes de errores a Sentry

El sitio de documentación también utiliza actualmente:

- una cookie de preferencia de idioma
- un formulario de contacto enviado mediante Formbold
- un panel de descargas que obtiene metadatos de versiones

## 1. Información tratada localmente en la aplicación

Wmb Table está diseñado como una aplicación de escritorio. Según el código actual, las siguientes categorías de información pueden almacenarse localmente en su dispositivo:

- sus notas y referencias de notas
- sus temas y elementos de temas
- sus subrayados y comentarios
- sus documentos personales importados, incluido el texto extraído
- su historial de lectura
- sus posiciones de lectura y pestañas abiertas
- sus preferencias de idioma e interfaz
- sus ajustes de audio, TTS e IA
- sus conversaciones y mensajes de IA
- sus sugerencias de búsqueda
- la información del último audio reproducido y ciertos archivos de audio en caché
- modelos locales de IA, modelos locales de TTS, índices de búsqueda y paquetes de idioma descargados
- los tokens de Google usados para la sincronización, si activa Google Drive
- las claves API y ajustes de proveedores remotos que configure para IA o TTS

En la implementación actual, esta información se almacena principalmente en archivos y bases de datos locales dentro de un directorio de datos similar a `~/.wmb-table`.

## 2. Información enviada a terceros cuando activa ciertas funciones

### 2.1 Informes de errores

La aplicación inicializa actualmente Sentry tanto en el proceso principal como en el renderer.

Esto significa que información técnica sobre errores, bloqueos o excepciones puede enviarse a Sentry, como por ejemplo:

- información de la aplicación y su versión
- contexto técnico del error
- datos del dispositivo, sistema operativo o sesión necesarios para diagnosticar problemas

No usamos esto para publicidad. Se utiliza para diagnosticar y corregir problemas.

### 2.2 Actualizaciones de la aplicación

Cuando la aplicación comprueba actualizaciones o descarga una nueva versión, contacta las fuentes de publicaciones de GitHub configuradas para Wmb Table.

Esto puede implicar datos técnicos estándar de red como:

- dirección IP
- metadatos de la solicitud
- versión de la aplicación que solicita la actualización

### 2.3 Paquetes de idioma, modelos y archivos descargados

La aplicación puede descargar o actualizar:

- paquetes de idioma
- modelos locales de IA
- modelos locales de TTS
- ciertos archivos de audio usados durante la reproducción

Estas descargas implican conexiones con los hosts correspondientes, que pueden incluir GitHub, Hugging Face, Wasabi u otras fuentes configuradas por la aplicación.

### 2.4 Asistente de IA

El asistente de IA permanece desactivado hasta que usted lo active en la configuración.

Si elige un proveedor remoto como OpenAI, OpenRouter, Gemini, Claude o un proveedor personalizado compatible, Wmb Table puede enviar al proveedor seleccionado:

- su mensaje
- el historial reciente de la conversación
- una memoria resumida de la conversación
- las instrucciones del sistema necesarias para el funcionamiento del asistente
- los resultados de herramientas usados durante la respuesta

Según lo que usted pida, esos resultados de herramientas pueden incluir información recuperada desde la aplicación, como:

- contenido de predicaciones
- referencias bíblicas
- información sobre idiomas instalados
- notas
- temas
- documentos personales

Si elige el modo `Local`, el procesamiento de IA se realiza en su dispositivo con un modelo descargado localmente.

### 2.5 Lectura en audio y texto a voz

Wmb Table admite voces locales y servicios remotos de texto a voz.

Si usa un proveedor remoto como Edge TTS, Cartesia, ElevenLabs u OpenAI TTS, el texto puede enviarse a ese proveedor para generar audio.

Si usa una opción de voz local, como las voces del sistema o Sherpa-ONNX TTS, la síntesis permanece en su dispositivo, sujeta al comportamiento normal de la plataforma.

Algunas funciones de clonación de voz también pueden enviar las muestras de audio que usted proporcione al proveedor correspondiente.

### 2.6 Copia de seguridad y sincronización con Google Drive

La copia de seguridad y la sincronización con Google Drive son opcionales.

Si activa esta función, Wmb Table le redirige a su navegador para la autenticación con Google y actualmente solicita acceso a:

- su perfil básico de Google
- su dirección de correo de Google
- la carpeta `appDataFolder` de Google Drive

Cuando esta función está activa, Wmb Table puede almacenar o sincronizar en Google Drive instantáneas de base de datos y archivos de registro de cambios que contienen ciertas categorías de datos del usuario, entre ellas:

- notas
- referencias de notas
- referencias bíblicas de notas
- temas
- elementos de temas
- documentos personales
- sugerencias de búsqueda
- subrayados
- conversaciones de IA
- mensajes de IA

La aplicación también almacena localmente información mínima de acceso, como su nombre, correo, estado de la copia de seguridad y el token de Google necesario para volver a conectar.

Importante: en el código actual, cerrar sesión elimina los tokens locales y el estado local de sincronización, pero esta página no garantiza que todas las copias ya guardadas en su Google Drive se eliminen automáticamente.

## 3. Qué trata el sitio de documentación

El sitio de documentación de Wmb Table trata mucha menos información que la aplicación.

### 3.1 Preferencia de idioma

El sitio guarda actualmente una cookie de preferencia de idioma para recordar si usted prefiere la versión en francés, inglés o español.

Esa cookie se usa solo para mostrar el idioma preferido.

### 3.2 Formulario de contacto

Si usa el formulario de contacto del sitio, la información que introduzca se envía a Formbold:

- nombre
- correo electrónico
- asunto
- mensaje

No envíe información sensible mediante el formulario de contacto si no desea que sea tratada por un procesador de formularios de terceros.

### 3.3 Panel de descargas

La página principal de la documentación puede obtener un manifiesto de versiones para sugerir descargas adecuadas para su dispositivo.

Ese componente puede tratar datos técnicos del navegador como:

- user agent
- plataforma estimada
- arquitectura estimada
- idioma de la página

## 4. Para qué se usa la información

Tratamos la información relevante según la función implicada:

- para proporcionar las funciones principales de la aplicación
- para ejecutar las funciones que usted decide activar
- para asegurar, mantener y mejorar el software
- para responder a los mensajes enviados mediante el formulario de contacto

## 5. Cómo se comparte la información

No vendemos datos personales.

Sin embargo, la información puede compartirse con proveedores técnicos cuando sea necesario para operar las funciones que usted usa, entre ellos:

- Sentry para informes de errores
- GitHub para actualizaciones y algunas descargas
- Google para autenticación y sincronización con Drive
- Formbold para el formulario de contacto del sitio
- el proveedor de IA que usted elija
- el proveedor remoto de TTS que usted elija
- los hosts de archivos utilizados para idiomas, modelos o audio

Cada servicio de terceros aplica también sus propias condiciones y prácticas de privacidad.

## 6. Conservación de datos

Los datos locales de la aplicación generalmente permanecen en su dispositivo hasta que:

- usted los elimine en la aplicación
- elimine los archivos locales
- desinstale la aplicación y elimine sus datos locales

La información enviada a servicios de terceros puede conservarse según las reglas de esos servicios.

Los datos sincronizados con Google Drive pueden permanecer en su espacio de Google Drive hasta que se eliminen de ese espacio.

## 7. Seguridad

Intentamos limitar la exposición de datos manteniendo local la funcionalidad principal cuando es práctico.

Sin embargo:

- ningún sistema es perfectamente seguro
- la seguridad también depende de su dispositivo, su cuenta de Google, sus claves API y los servicios de terceros que elija
- si activa proveedores remotos, los datos enviados a ellos salen de su dispositivo

Usted es responsable de proteger:

- su dispositivo
- sus cuentas de terceros
- sus claves API
- sus archivos y copias de seguridad

## 8. Sus opciones

Puede limitar el tratamiento externo de varias maneras:

- no activar la sincronización con Google Drive
- no activar el asistente de IA
- elegir el modo local de IA en lugar de un proveedor remoto
- elegir una voz TTS local en lugar de un proveedor remoto
- no utilizar el formulario de contacto del sitio
- eliminar contenido local específico desde la aplicación

## 9. Menores

Wmb Table no se presenta como un servicio dirigido específicamente a menores.

Si un menor usa la aplicación, la persona responsable debe asegurarse de que no comparta información sensible mediante funciones remotas o el formulario de contacto del sitio.

## 10. Cambios a esta política

Podemos actualizar esta política para reflejar cambios en Wmb Table, en el sitio de documentación o en los servicios de terceros implicados.

La fecha indicada al inicio de esta página muestra la última actualización.

## 11. Contacto

Para preguntas sobre privacidad o datos:

- Email: [paradoxngwasi@gmail.com](mailto:paradoxngwasi@gmail.com)
- Página de contacto: [Contáctenos](/es/contact)

## Ver también

- [Términos del servicio](/es/terms)
- [Copia de seguridad y sincronización](/es/guide/backup-and-sync)
- [Ajustes del asistente](/es/guide/settings-assistant)
- [Lectura en audio y voces](/es/guide/audio-and-tts)
