# Assistant Settings

<p class="lead">The `Assistant` tab is where you turn on AI chat and choose how it should work inside Wmb Table.</p>

## Where to open it

1. Open `Settings`
2. Click `Assistant`

<ScreenshotPlaceholder
  file="en-settings-assistant-tab.png"
  label="Assistant tab in settings"
  hint="Show the enable switch, provider choice, language behavior, and if possible the local model area."
/>

## What this tab lets you do

In this tab, you can:

- enable or disable the assistant
- choose the service used for replies
- set up a local model if you want to work without internet
- enter the information needed for an online service
- test the connection of a service
- choose how the assistant follows the content language

## Step 1: enable the assistant

At the top of the page, there is a simple switch.

When it is on:

- the assistant becomes available in the left menu
- you can open the AI chat page

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

The assistant follows the content language of the app.

Two choices are available:

- `Follow the content language`
- `Change only when asked`

For most users, `Follow the content language` is the best choice.

## Simple recommended setup

To get started without complication:

1. enable the assistant
2. choose the service you want to use
3. enter the needed information
4. keep `Follow the content language`
5. open the `AI Chat` page

## When to come back to this tab

Come back here if:

- the assistant does not respond
- you want to switch services
- you want to use local mode
- you want to use a different model
- you want to change how the assistant handles languages

## See also

- [AI Chat](/en/guide/ai-chat)
- [Languages](/en/guide/languages)
- [Settings Overview](/en/guide/settings-overview)
