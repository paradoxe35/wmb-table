# Assistant Settings

<p class="lead">The `Assistant` tab is where you choose the AI service for the chat and how it should work inside Wmb Table.</p>

## Where to open it

1. Open `Settings`
2. Click `Assistant`

<ScreenshotPlaceholder
  file="en-settings-assistant-tab.png"
  label="Assistant tab in settings"
  hint="Show the provider choice, language behavior, and if possible the local model area."
/>

## What this tab lets you do

In this tab, you can:

- choose the service used for replies
- set up a local model if you want to work without internet
- enter the information needed for an online service
- test the connection of a service
- choose how the assistant follows your library language

## Step 1: start from the Assistant page

The assistant is always in the left menu. Until a service is set up, its page shows a welcome card with a `Set up the assistant` button that opens this tab directly.

Once the service is ready, the Assistant page shows the chat, without restarting the app.

## Step 2: choose the service

The app offers several choices.

### Local

`Local` works directly on your computer.

It is useful if you want to:

- work without internet
- keep processing on your own machine
- use a small model downloaded in advance

### OpenRouter

Use this if you want access to several models through one service.

### OpenAI

Use this for OpenAI models.

### Gemini

Use this for Google Gemini models.

### Claude

Use this for Claude models.

### Custom provider

You can also add a compatible provider if you have its address and model name.

<ScreenshotPlaceholder
  file="en-settings-assistant-provider-selector.png"
  label="AI provider selector"
  hint="Show the provider list with Local, OpenRouter, OpenAI, Gemini, Claude, and Add custom provider."
/>

## Step 3: if you choose an online service

For an online service, you need to:

1. choose the provider
2. enter your API key
3. choose the model from the list (or type its name)
4. test the connection

### How to get an API key

An API key is a personal code that each service gives you so it knows who you are. Here is how to get one:

**OpenRouter**

1. Go to [openrouter.ai](https://openrouter.ai)
2. Create a free account
3. Open the `Keys` page in your profile
4. Click `Create Key`
5. Copy the key shown
6. Paste it in the `API Key` field in Wmb Table

**OpenAI**

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account
3. Open `API keys` in the settings
4. Click `Create new secret key`
5. Copy the key shown
6. Paste it in the `API Key` field in Wmb Table

**Gemini**

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click `Get API Key`
4. Copy the key
5. Paste it in the `API Key` field in Wmb Table

**Claude**

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account
3. Open `API Keys`
4. Click `Create Key`
5. Copy the key
6. Paste it in the `API Key` field in Wmb Table

### Choosing a model

Once your API key is entered, click on the `Model` field. A list of available models will appear. You can:

- search for a model by typing part of its name
- choose a model from the list
- type a model name directly if you know it

If the test succeeds, the app will show that the connection is working.

<ScreenshotPlaceholder
  file="en-settings-assistant-cloud-provider.png"
  label="Cloud provider configuration"
  hint="Show the key field, model field, and Test connection button."
/>

## Step 4: if you choose Local

Local mode lets you download a model to your computer.

At the moment, the app offers two models:

- **Qwen 3.5 — Recommended**: good answer quality, fast and lightweight (~1.3 GB). Works on most computers.
- **Qwen 3.5 — Lightweight**: very fast and very small (~550 MB). For older computers or those with limited memory.

The simple path is:

1. choose `Local`
2. download a model (the recommended model is the best choice)
3. select that model
4. use the assistant

You can also turn on the graphics card option if your computer supports it.

<ScreenshotPlaceholder
  file="en-settings-assistant-local-models.png"
  label="Downloading and choosing a local model"
  hint="Show the local model list with Download, Use, and the GPU option."
/>

## Step 5: language behavior

The assistant follows your library language.

Two choices are available:

- `Follow the content language`
- `Change only when asked`

For most users, `Follow the content language` is the best choice.

## Simple recommended setup

To get started without complication:

1. choose the service you want to use
2. enter the needed information
3. keep `Follow the content language`
4. open the `AI Chat` page

## When to come back to this tab

Come back here if:

- the assistant does not respond
- you want to switch services
- you want to use local mode
- you want to use a different model
- you want to change how the assistant handles languages

## Use your own AI app (MCP server)

If you already use an AI app on your computer, such as Claude Desktop, Claude Code or Codex, it can read your Wmb Table library: sermons, Bible, your documents, notes and subjects. Your own subscription is used; Wmb Table needs no API key for this.

1. At the bottom of this tab, check `MCP server`. Until the box is checked, nothing else shows.
2. Under `Configuration`, pick a way to connect, then the tab for your app (Claude Code, Codex or Claude Desktop).
3. Copy the example and follow the short note above it. The examples already hold the full path of Wmb Table on your computer: there is nothing to look up.

The three ways to connect:

- `Command (recommended)`: your AI app starts Wmb Table itself, without a window, with the command `wmb-table mcp`. Wmb Table does not need to be open. This is the simplest, and Claude Desktop does not need Node.js.
- `HTTP`: your app connects to the address shown, for example `http://127.0.0.1:23132/mcp`. Wmb Table must stay open.
- `Headless HTTP`: you start the server yourself in a terminal with `wmb-table mcp --http --port 23132`, without opening Wmb Table, and your app connects to the address. `Ctrl+C` stops the server. Close Wmb Table first if it is open, since it already uses this port.

Good to know:

- The server is off by default. Until `MCP server` is checked, the `wmb-table mcp` command refuses to start and says why.
- The HTTP server starts with Wmb Table while the box is checked, and stops when you uncheck it or quit Wmb Table.
- By default your AI app can only read. Check `Allow changes (notes and subjects)` so it can also create and change your notes and subjects. This applies to all three ways to connect.
- Wmb Table can stay open while the command runs: both use the same library without getting in each other's way.
- The tools use your content language. Add `--language en` (for example) to the command for another installed language.
- The server can only be reached from your own computer. Websites open in your browser cannot use it.
- If the usual port is already taken, Wmb Table uses the next one and shows it. Keep that new address in your app.
- This setting belongs to each computer: it is not synced through Google Drive.
- For Claude Desktop over `HTTP`, Node.js must be installed on the computer.

## See also

- [AI Chat](/en/guide/ai-chat)
- [Languages](/en/guide/languages)
- [Settings Overview](/en/guide/settings-overview)
