# Paramètres Assistant

<p class="lead">L'onglet `Assistant` sert à choisir le service d'IA de la discussion et la façon dont elle fonctionne dans Wmb Table.</p>

## Où ouvrir cet onglet

1. Ouvrez `Paramètres`
2. Cliquez sur `Assistant`

<ScreenshotPlaceholder
  file="fr-settings-assistant-tab.png"
  label="Onglet Assistant dans les paramètres"
  hint="Montrer le choix du fournisseur, les réglages de langue et, si possible, le bloc du modèle local."
/>

## Ce que vous faites ici

Dans cet onglet, vous pouvez :

- choisir le service utilisé pour répondre
- régler un modèle local si vous voulez travailler sans internet
- entrer les informations nécessaires pour un service en ligne
- tester la connexion d'un service
- choisir comment l'assistant suit la langue de votre bibliothèque

## Étape 1 : partir de la page Assistant

L'assistant est toujours dans le menu de gauche. Tant qu'aucun service n'est configuré, sa page affiche une carte d'accueil avec le bouton `Configurer l'assistant`, qui ouvre directement cet onglet.

Dès que le service est prêt, la page Assistant affiche la discussion, sans redémarrer l'application.

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
  hint="Montrer la liste des fournisseurs avec Local, OpenRouter, OpenAI, Gemini, Claude et Ajouter un fournisseur."
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

L'assistant suit la langue de votre bibliothèque.

Deux comportements sont proposés :

- `Suivre la langue active`
- `Changer uniquement sur demande`

Pour la plupart des utilisateurs, gardez `Suivre la langue active`.

Ainsi, l'assistant cherchera plus naturellement dans :

- les prédications de votre bibliothèque
- les versions bibliques adaptées
- vos sujets et vos notes dans le bon contexte

## Réglage simple recommandé

Pour commencer sans complication :

1. choisissez le service que vous voulez utiliser
2. entrez les informations nécessaires si besoin
3. gardez `Suivre la langue active`
4. ouvrez ensuite la page `Discussion IA`

## Quand revenir dans cet onglet

Revenez ici si :

- l'assistant ne répond pas
- vous voulez changer de service
- vous voulez passer en mode local
- vous voulez utiliser un autre modèle
- vous voulez modifier la manière dont l'assistant gère les langues

## Utiliser votre propre application d'IA (serveur MCP)

Si vous utilisez déjà une application d'IA sur votre ordinateur, comme Claude Desktop ou Codex, elle peut lire votre bibliothèque Wmb Table : prédications, Bible, vos documents, vos notes et vos sujets. C'est votre propre abonnement qui est utilisé ; Wmb Table n'a pas besoin de clé API pour cela.

1. Tout en bas de cet onglet, cochez `Serveur MCP`. Tant que la case n'est pas cochée, rien d'autre ne s'affiche.
2. Dans `Configuration`, ouvrez l'onglet de votre application : `Claude Desktop`, `Codex` ou `Autre application`.
3. Copiez l'exemple marqué `(recommandé)` et suivez la petite explication au-dessus. Les exemples contiennent déjà le chemin complet de Wmb Table sur votre ordinateur : vous n'avez rien à chercher.

Pour Claude Desktop, le plus simple est le bouton `Configurer automatiquement` en haut de son onglet. Wmb Table ajoute alors lui-même son entrée au fichier `claude_desktop_config.json`, après en avoir fait une copie de sauvegarde (`claude_desktop_config.json.wmb-table-backup-…`) ; vos autres serveurs ne sont pas modifiés. Redémarrez ensuite Claude Desktop.

- Si Claude Desktop n'est pas installé, l'onglet le dit et donne le lien de téléchargement ; Wmb Table ne crée aucun fichier.
- `Déjà configuré` indique que l'entrée est en place. Si Wmb Table a changé de dossier, le bouton `Mettre à jour` corrige le chemin.
- Si le fichier n'est pas un JSON valide, ou si Wmb Table n'a pas le droit de le modifier, rien n'est changé : ajoutez alors l'exemple à la main.

Chaque onglet propose deux méthodes :

- `HTTP` : votre application se connecte à l'adresse affichée, par exemple `http://127.0.0.1:23132/mcp`. Wmb Table doit être ouvert. C'est la méthode recommandée pour Codex.
- `Commande` : votre application lance Wmb Table elle-même, sans fenêtre, avec la commande `wmb-table mcp`. Cela fonctionne même quand Wmb Table est fermé. C'est la méthode recommandée pour Claude Desktop, qui n'a alors pas besoin de Node.js.

La partie `Avancé`, en bas, donne la commande `wmb-table mcp --http --port 23132` : elle démarre le serveur HTTP dans un terminal, sans ouvrir Wmb Table. `Ctrl+C` l'arrête. Fermez d'abord Wmb Table s'il est ouvert, car il utilise déjà ce port.

Bon à savoir :

- Le serveur est désactivé par défaut. Tant que la case `Serveur MCP` n'est pas cochée, la commande `wmb-table mcp` refuse de démarrer et l'explique.
- Décocher `Serveur MCP` arrête aussi la commande : lancée par votre application, elle se ferme d'elle-même ; le serveur HTTP sans fenêtre refuse les demandes jusqu'à ce que vous recochiez la case.
- Sous Linux, les exemples ajoutent `--no-sandbox` avant `mcp` (par exemple `wmb-table --no-sandbox mcp`). Sans cela, la commande ne démarre pas en tant que root, dans un conteneur ou sur certains systèmes. Ce mode n'ouvre aucune page web, donc cela ne réduit pas la sécurité.
- Le serveur HTTP démarre avec Wmb Table quand la case est cochée, et s'arrête quand vous la décochez ou quand vous quittez Wmb Table.
- Par défaut, votre application d'IA peut seulement lire. Cochez `Autoriser les modifications (notes et sujets)` pour qu'elle puisse aussi créer et modifier vos notes et vos sujets. Ce choix vaut pour toutes les méthodes.
- Wmb Table peut rester ouvert pendant que la commande tourne : les deux utilisent la même bibliothèque sans se gêner.
- Les outils utilisent votre langue de contenu. Ajoutez `--language en` (par exemple) à la commande pour une autre langue installée.
- Le serveur n'est joignable que depuis votre ordinateur. Les sites web ouverts dans votre navigateur ne peuvent pas l'utiliser.
- Si le port habituel est déjà pris, Wmb Table utilise le suivant et l'affiche. Gardez alors cette nouvelle adresse dans votre application.
- Ce réglage reste propre à chaque ordinateur : il n'est pas synchronisé avec Google Drive.
- Pour Claude Desktop en `HTTP`, Node.js doit être installé sur l'ordinateur.

## Voir aussi

- [Discussion IA](/guide/ai-chat)
- [Langues](/guide/languages)
- [Vue d'ensemble des paramètres](/guide/settings-overview)
