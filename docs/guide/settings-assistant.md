# Paramètres Assistant

<p class="lead">L'onglet `Assistant` sert à activer la discussion IA et à choisir comment elle doit fonctionner dans Wmb Table.</p>

## Où ouvrir cet onglet

1. Ouvrez `Paramètres`
2. Cliquez sur `Assistant`

<ScreenshotPlaceholder
  file="fr-settings-assistant-tab.png"
  label="Onglet Assistant dans les paramètres"
  hint="Montrer l'interrupteur d'activation, le choix du fournisseur, les réglages de langue et, si possible, le bloc du modèle local."
/>

## Ce que vous faites ici

Dans cet onglet, vous pouvez :

- activer ou désactiver l'assistant
- choisir le service utilisé pour répondre
- régler un modèle local si vous voulez travailler sans internet
- entrer les informations nécessaires pour un service en ligne
- tester la connexion d'un service
- choisir comment l'assistant suit la langue active

## Étape 1 : activer l'assistant

En haut de la page, vous trouvez un interrupteur simple.

Quand il est activé :

- l'assistant devient disponible dans le menu de gauche
- vous pouvez ouvrir la page de discussion IA

Quand il est désactivé :

- la page Assistant reste bloquée
- l'application vous renvoie vers les paramètres pour l'activer

## Étape 2 : choisir le service utilisé

L'application propose plusieurs choix.

### Local

`Local` fonctionne directement sur votre ordinateur.

Il est utile si vous voulez :

- travailler sans connexion internet
- garder le traitement sur votre machine
- utiliser un petit modèle téléchargé à l'avance

### OpenRouter

Ce choix permet d'accéder à plusieurs modèles avec une seule clé.

### OpenAI

Ce choix permet d'utiliser les modèles OpenAI.

### Gemini

Ce choix permet d'utiliser les modèles Gemini de Google.

### Claude

Ce choix permet d'utiliser les modèles Claude.

### Fournisseur personnalisé

Vous pouvez aussi ajouter un service compatible si vous avez une adresse et un modèle à indiquer.

<ScreenshotPlaceholder
  file="fr-settings-assistant-provider-selector.png"
  label="Choix du fournisseur IA"
  hint="Montrer la liste des fournisseurs avec Local, OpenRouter, OpenAI, Gemini, Claude et Ajouter un fournisseur personnalisé."
/>

## Étape 3 : si vous choisissez un service en ligne

Pour un service en ligne, vous devez :

1. choisir le fournisseur
2. entrer votre clé API
3. choisir le modèle dans la liste (ou taper son nom)
4. tester la connexion

### Comment obtenir une clé API

Une clé API est un code personnel que chaque service vous donne pour vous identifier. Voici comment en obtenir une :

**OpenRouter**

1. Allez sur [openrouter.ai](https://openrouter.ai)
2. Créez un compte gratuit
3. Ouvrez la page `Keys` dans votre profil
4. Cliquez sur `Create Key`
5. Copiez la clé affichée
6. Collez-la dans le champ `Clé API` dans Wmb Table

**OpenAI**

1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez un compte
3. Ouvrez `API keys` dans les paramètres
4. Cliquez sur `Create new secret key`
5. Copiez la clé affichée
6. Collez-la dans le champ `Clé API` dans Wmb Table

**Gemini**

1. Allez sur [aistudio.google.com](https://aistudio.google.com)
2. Connectez-vous avec votre compte Google
3. Cliquez sur `Get API Key`
4. Copiez la clé
5. Collez-la dans le champ `Clé API` dans Wmb Table

**Claude**

1. Allez sur [console.anthropic.com](https://console.anthropic.com)
2. Créez un compte
3. Ouvrez `API Keys`
4. Cliquez sur `Create Key`
5. Copiez la clé
6. Collez-la dans le champ `Clé API` dans Wmb Table

### Choisir un modèle

Quand votre clé API est entrée, cliquez sur le champ `Modèle`. Une liste de modèles disponibles apparaît. Vous pouvez :

- chercher un modèle en tapant une partie de son nom
- choisir un modèle dans la liste
- taper directement le nom d'un modèle si vous le connaissez

Si le test est bon, l'application affiche que la connexion fonctionne.

<ScreenshotPlaceholder
  file="fr-settings-assistant-cloud-provider.png"
  label="Réglage d'un fournisseur en ligne"
  hint="Montrer la zone de clé, le champ du modèle et le bouton Tester la connexion."
/>

## Étape 4 : si vous choisissez Local

Le mode local vous permet de télécharger un modèle sur votre ordinateur.

Aujourd'hui, l'application propose deux modèles :

- **Qwen 3.5 — Recommandé** : bonne qualité de réponse, rapide et léger (~1,3 Go). Fonctionne sur la plupart des ordinateurs.
- **Qwen 3.5 — Léger** : très rapide et très léger (~550 Mo). Pour les ordinateurs anciens ou avec peu de mémoire.

L'idée simple est :

1. choisir `Local`
2. télécharger un modèle (le modèle recommandé est le meilleur choix)
3. sélectionner ce modèle
4. utiliser ensuite l'assistant

Vous pouvez aussi activer la carte graphique si votre ordinateur la supporte.

<ScreenshotPlaceholder
  file="fr-settings-assistant-local-models.png"
  label="Téléchargement et choix d'un modèle local"
  hint="Montrer la liste des modèles locaux avec Télécharger, Utiliser et l'option GPU."
/>

## Étape 5 : comportement de la langue

L'assistant suit la langue active de l'application.

Deux comportements sont proposés :

- `Suivre la langue active`
- `Changer uniquement sur demande`

Pour la plupart des utilisateurs, gardez `Suivre la langue active`.

Ainsi, l'assistant cherchera plus naturellement dans :

- les prédications de votre langue active
- les versions bibliques adaptées
- vos sujets et vos notes dans le bon contexte

## Réglage simple recommandé

Pour commencer sans complication :

1. activez l'assistant
2. choisissez le service que vous voulez utiliser
3. entrez les informations nécessaires si besoin
4. gardez `Suivre la langue active`
5. ouvrez ensuite la page `Discussion IA`

## Quand revenir dans cet onglet

Revenez ici si :

- l'assistant ne répond pas
- vous voulez changer de service
- vous voulez passer en mode local
- vous voulez utiliser un autre modèle
- vous voulez modifier la manière dont l'assistant gère les langues

## Voir aussi

- [Discussion IA](/guide/ai-chat)
- [Langues](/guide/languages)
- [Vue d'ensemble des paramètres](/guide/settings-overview)
