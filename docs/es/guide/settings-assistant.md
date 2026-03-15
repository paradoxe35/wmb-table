# Ajustes de Assistant

<p class="lead">La pestaña `Assistant` sirve para activar el chat con IA y elegir cómo debe funcionar dentro de Wmb Table.</p>

## Dónde abrirla

1. Abra `Ajustes`
2. Haga clic en `Assistant`

<ScreenshotPlaceholder
  file="es-settings-assistant-tab.png"
  label="Pestaña Assistant en ajustes"
  hint="Mostrar el interruptor de activación, la elección del proveedor, el comportamiento del idioma y, si es posible, la zona del modelo local."
/>

## Lo que puede hacer aquí

- activar o desactivar el asistente
- elegir el servicio usado para responder
- configurar un modelo local si quiere trabajar sin internet
- introducir los datos necesarios para un servicio en línea
- probar la conexión
- elegir cómo el asistente sigue el idioma activo

## Paso 1: activar el asistente

En la parte superior de la página, hay un interruptor simple.

Cuando está activado:

- el asistente aparece en el menú de la izquierda
- puede abrir la página de chat con IA

## Paso 2: elegir el servicio

La aplicación ofrece:

- `Local`
- `OpenRouter`
- `OpenAI`
- `Gemini`
- `Claude`
- proveedor personalizado

<ScreenshotPlaceholder
  file="es-settings-assistant-provider-selector.png"
  label="Selector del proveedor de IA"
  hint="Mostrar la lista de proveedores con Local, OpenRouter, OpenAI, Gemini, Claude y Agregar proveedor personalizado."
/>

## Paso 3: si elige un servicio en línea

Para un servicio en línea, debe:

1. elegir el proveedor
2. introducir su clave API
3. elegir el modelo de la lista (o escribir su nombre)
4. probar la conexión

### Cómo obtener una clave API

Una clave API es un código personal que cada servicio le da para identificarlo. Así se obtiene una:

**OpenRouter**

1. Vaya a [openrouter.ai](https://openrouter.ai)
2. Cree una cuenta gratuita
3. Abra la página `Keys` en su perfil
4. Haga clic en `Create Key`
5. Copie la clave mostrada
6. Péguela en el campo `Clave API` en Wmb Table

**OpenAI**

1. Vaya a [platform.openai.com](https://platform.openai.com)
2. Cree una cuenta
3. Abra `API keys` en los ajustes
4. Haga clic en `Create new secret key`
5. Copie la clave mostrada
6. Péguela en el campo `Clave API` en Wmb Table

**Gemini**

1. Vaya a [aistudio.google.com](https://aistudio.google.com)
2. Inicie sesión con su cuenta de Google
3. Haga clic en `Get API Key`
4. Copie la clave
5. Péguela en el campo `Clave API` en Wmb Table

**Claude**

1. Vaya a [console.anthropic.com](https://console.anthropic.com)
2. Cree una cuenta
3. Abra `API Keys`
4. Haga clic en `Create Key`
5. Copie la clave
6. Péguela en el campo `Clave API` en Wmb Table

### Elegir un modelo

Cuando su clave API esté introducida, haga clic en el campo `Modelo`. Aparecerá una lista de modelos disponibles. Puede:

- buscar un modelo escribiendo parte de su nombre
- elegir un modelo de la lista
- escribir directamente el nombre de un modelo si lo conoce

Si la prueba es correcta, la aplicación mostrará que la conexión funciona.

<ScreenshotPlaceholder
  file="es-settings-assistant-cloud-provider.png"
  label="Configuración de proveedor en línea"
  hint="Mostrar el campo de clave, el campo de modelo y el botón Probar la conexión."
/>

## Paso 4: si elige Local

El modo local permite descargar un modelo al ordenador.

Actualmente la aplicación propone dos modelos:

- **Qwen 3.5 — Recomendado**: buena calidad de respuesta, rápido y ligero (~1,3 GB). Funciona en la mayoría de los ordenadores.
- **Qwen 3.5 — Ligero**: muy rápido y muy ligero (~550 MB). Para ordenadores antiguos o con poca memoria.

El camino simple es:

1. elegir `Local`
2. descargar un modelo (el modelo recomendado es la mejor opción)
3. seleccionar ese modelo
4. usar el asistente

También puede activar la tarjeta gráfica si su ordenador la soporta.

<ScreenshotPlaceholder
  file="es-settings-assistant-local-models.png"
  label="Descarga y elección de un modelo local"
  hint="Mostrar la lista de modelos locales con Descargar, Usar y la opción GPU."
/>

## Paso 5: comportamiento del idioma

El asistente sigue el idioma activo de la aplicación.

Dos opciones están disponibles:

- `Seguir el idioma activo`
- `Cambiar solo cuando se solicite`

Para la mayoría de usuarios, `Seguir el idioma activo` es la mejor opción.

## Configuración simple recomendada

Para empezar sin complicaciones:

1. active el asistente
2. elija el servicio que quiere usar
3. introduzca los datos necesarios
4. mantenga `Seguir el idioma activo`
5. abra la página `Chat con IA`

## Cuándo volver a esta pestaña

Vuelva aquí si:

- el asistente no responde
- quiere cambiar de servicio
- quiere usar el modo local
- quiere usar otro modelo
- quiere cambiar cómo el asistente gestiona los idiomas

## Ver también

- [Chat con IA](/es/guide/ai-chat)
- [Idiomas](/es/guide/languages)
- [Vista general de ajustes](/es/guide/settings-overview)
