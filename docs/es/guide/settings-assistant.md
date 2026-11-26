# Ajustes de Assistant

<p class="lead">La pestaña `Assistant` sirve para elegir el servicio de IA del chat y cómo debe funcionar dentro de Wmb Table.</p>

## Dónde abrirla

1. Abra `Ajustes`
2. Haga clic en `Assistant`

<ScreenshotPlaceholder
  file="es-settings-assistant-tab.png"
  label="Pestaña Assistant en ajustes"
  hint="Mostrar la elección del proveedor, el comportamiento del idioma y, si es posible, la zona del modelo local."
/>

## Lo que puede hacer aquí

- elegir el servicio usado para responder
- configurar un modelo local si quiere trabajar sin internet
- introducir los datos necesarios para un servicio en línea
- probar la conexión
- elegir cómo el asistente sigue el idioma de su biblioteca

## Paso 1: empezar desde la página Assistant

El asistente siempre está en el menú de la izquierda. Mientras no haya un servicio configurado, su página muestra una tarjeta de bienvenida con el botón `Configurar el asistente`, que abre directamente esta pestaña.

En cuanto el servicio está listo, la página Assistant muestra el chat, sin reiniciar la aplicación.

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

El asistente sigue el idioma de su biblioteca.

Dos opciones están disponibles:

- `Seguir el idioma activo`
- `Cambiar solo cuando se solicite`

Para la mayoría de usuarios, `Seguir el idioma activo` es la mejor opción.

## Configuración simple recomendada

Para empezar sin complicaciones:

1. elija el servicio que quiere usar
2. introduzca los datos necesarios
3. mantenga `Seguir el idioma activo`
4. abra la página `Chat con IA`

## Cuándo volver a esta pestaña

Vuelva aquí si:

- el asistente no responde
- quiere cambiar de servicio
- quiere usar el modo local
- quiere usar otro modelo
- quiere cambiar cómo el asistente gestiona los idiomas

## Usar su propia aplicación de IA (servidor MCP)

Si ya usa una aplicación de IA en su ordenador, como Claude Desktop, Claude Code o Codex, puede leer su biblioteca de Wmb Table: prédicas, Biblia, sus documentos, notas y temas. Se usa su propia suscripción; Wmb Table no necesita una clave API para esto.

1. Al final de esta pestaña, marque `Servidor MCP`. Mientras la casilla no esté marcada, no se muestra nada más.
2. En `Configuración`, abra la pestaña de su aplicación: `Claude Code`, `Codex`, `Claude Desktop` u `Otra aplicación`.
3. Copie el ejemplo marcado `(recomendado)` y siga la breve explicación que aparece encima. Los ejemplos ya contienen la ruta completa de Wmb Table en su ordenador: no tiene que buscar nada.

Cada pestaña ofrece dos métodos:

- `HTTP`: su aplicación se conecta a la dirección mostrada, por ejemplo `http://127.0.0.1:23132/mcp`. Wmb Table debe estar abierto. Es el método recomendado para Claude Code y Codex.
- `Comando`: su aplicación inicia Wmb Table por sí misma, sin ventana, con el comando `wmb-table mcp`. Funciona incluso con Wmb Table cerrado. Es el método recomendado para Claude Desktop, que así no necesita Node.js.

La parte `Avanzado`, abajo, da el comando `wmb-table mcp --http --port 23132`: inicia el servidor HTTP en una terminal sin abrir Wmb Table. `Ctrl+C` lo detiene. Cierre primero Wmb Table si está abierto, porque ya usa este puerto.

Conviene saber:

- El servidor está desactivado por defecto. Mientras `Servidor MCP` no esté marcado, el comando `wmb-table mcp` se niega a iniciarse y explica por qué.
- Desmarcar `Servidor MCP` también detiene el comando: si lo inició su aplicación, se cierra solo; el servidor HTTP sin ventana rechaza las solicitudes hasta que vuelva a marcar la casilla.
- En Linux, los ejemplos añaden `--no-sandbox` antes de `mcp` (por ejemplo `wmb-table --no-sandbox mcp`). Sin esto, el comando no se inicia como root, en un contenedor o en algunos sistemas. Este modo no abre ninguna página web, así que no reduce la seguridad.
- El servidor HTTP se inicia con Wmb Table mientras la casilla está marcada y se detiene al desmarcarla o al salir de Wmb Table.
- Por defecto, su aplicación de IA solo puede leer. Marque `Permitir cambios (notas y temas)` para que también pueda crear y modificar sus notas y temas. Esto vale para todos los métodos.
- Wmb Table puede permanecer abierto mientras el comando funciona: ambos usan la misma biblioteca sin molestarse.
- Las herramientas usan su idioma de contenido. Añada `--language en` (por ejemplo) al comando para otro idioma instalado.
- Solo se puede acceder al servidor desde su propio ordenador. Los sitios web abiertos en su navegador no pueden usarlo.
- Si el puerto habitual ya está ocupado, Wmb Table usa el siguiente y lo muestra. Guarde esa nueva dirección en su aplicación.
- Este ajuste es propio de cada ordenador: no se sincroniza con Google Drive.
- Para Claude Desktop por `HTTP`, Node.js debe estar instalado en el ordenador.

## Ver también

- [Chat con IA](/es/guide/ai-chat)
- [Idiomas](/es/guide/languages)
- [Vista general de ajustes](/es/guide/settings-overview)
