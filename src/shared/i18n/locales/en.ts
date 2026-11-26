const en: Record<string, string> = {
    // ── Sidebar menu ──
    Historique: 'History',
    Recherche: 'Search',
    Sujets: 'Subjects',
    Notes: 'Notes',
    Soulignages: 'Highlights',
    'Aucun soulignage': 'No highlights',
    'Supprimer ce soulignage ?': 'Delete this highlight?',
    'Soulignage supprimé': 'Highlight deleted',
    'Erreur lors du chargement des soulignages': 'Error loading highlights',
    'Charger plus': 'Load more',
    Paramètres: 'Settings',

    // ── Viewer menu ──
    Outils: 'Tools',
    Lecture: 'Reading',

    // ── Sidebar documents ──
    Prédications: 'Sermons',
    Bible: 'Bible',
    Documents: 'Documents',
    'Aucun document ajouté': 'No documents added',
    'Ajouter un document': 'Add a document',
    'Choisir un document': 'Choose a document',
    'Choisir une date': 'Choose a date',
    'Mes documents': 'My documents',
    Gérer: 'Manage',
    'Gérer mes documents': 'Manage my documents',
    Alphabet: 'Alphabet',
    Année: 'Year',
    Années: 'Years',
    'A-Z': 'A-Z',
    'Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.':
        'Supported formats: PDF, TXT, MD, DOCX, EPUB.',
    'Importer un document': 'Import a document',
    'Document importé dans la note': 'Document imported into the note',
    'Cette note contient déjà du contenu.': 'This note already contains content.',
    'Note introuvable.': 'Note not found.',
    "Erreur lors de l'import du document.": 'Error importing document.',
    'Format de document non pris en charge.': 'Unsupported document format.',
    'Le fichier est trop volumineux.': 'The file is too large.',

    // ── Settings index ──
    Général: 'General',
    'Vue document': 'Document View',
    Langues: 'Languages',
    'Lecture audio': 'Text-to-Speech',
    Sauvegarde: 'Backup',
    'Mise à jour': 'Update',
    'Gérez les préférences de votre application.': 'Manage your application preferences.',
    Assistant: 'Assistant',
    'Assistant IA': 'AI Assistant',
    'Clé API': 'API key',
    'URL de base': 'Base URL',
    Modèle: 'Model',
    Identifiant: 'Identifier',
    'Nom affiché': 'Display name',
    Optionnel: 'Optional',
    'Modèle par défaut': 'Default model',
    'URL par défaut': 'Default URL',
    Recommandé: 'Recommended',
    Installé: 'Installed',
    Nouveau: 'New',

    // ── AI settings ──
    'Choisissez le service à utiliser pour le chat IA.': 'Choose the service to use for AI chat.',
    'Choisir un fournisseur': 'Choose a provider',
    "Choisissez un fournisseur pour utiliser l'assistant.":
        'Choose a provider to use the assistant.',
    'Ajoutez une clé API pour utiliser ce fournisseur.': 'Add an API key to use this provider.',
    "Les paramètres de l'assistant n'ont pas pu être enregistrés.":
        'The assistant settings could not be saved.',
    Personnalisé: 'Custom',
    'Comportement des langues': 'Language behavior',
    "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.":
        'The assistant follows the content language unless you explicitly ask for another one.',
    'Suivre la langue active': 'Follow the content language',
    'Changer uniquement sur demande': 'Switch only on request',
    "Utilisez l'identifiant exact du modèle fourni par ce service.":
        'Use the exact model identifier provided by this service.',

    // ── MCP server ──
    'Serveur MCP': 'MCP server',
    'Permet à votre propre application d’IA (Claude Desktop, Claude Code, Codex…) d’utiliser votre bibliothèque Wmb Table.':
        'Lets your own AI app (Claude Desktop, Claude Code, Codex…) use your Wmb Table library.',
    'Autoriser les modifications (notes et sujets)': 'Allow changes (notes and subjects)',
    'Votre application d’IA peut créer et modifier vos notes et vos sujets.':
        'Your AI app can create and change your notes and subjects.',
    'Votre application d’IA peut seulement lire votre bibliothèque.':
        'Your AI app can only read your library.',
    'Adresse du serveur': 'Server address',
    'Le port habituel {{defaultPort}} était occupé : Wmb Table utilise le port {{port}}.':
        'The usual port {{defaultPort}} was busy: Wmb Table uses port {{port}}.',
    'Connecter votre application': 'Connect your app',
    'Lancez cette commande dans un terminal.': 'Run this command in a terminal.',
    'Ajoutez ces lignes au fichier ~/.codex/config.toml.':
        'Add these lines to the file ~/.codex/config.toml.',
    'Ajoutez ceci au fichier claude_desktop_config.json (Paramètres, Développeur, Modifier la configuration), puis redémarrez Claude Desktop. Node.js doit être installé.':
        'Add this to the file claude_desktop_config.json (Settings, Developer, Edit Config), then restart Claude Desktop. Node.js must be installed.',
    'Dans une autre application, ajoutez un serveur MCP « Streamable HTTP » avec cette adresse.':
        'In another app, add a “Streamable HTTP” MCP server with this address.',
    'Copier {{label}}': 'Copy {{label}}',
    Copié: 'Copied',
    'Le serveur MCP n’a pas pu démarrer : les ports {{firstPort}} à {{lastPort}} sont déjà utilisés. Fermez l’application qui les occupe, puis réactivez le serveur.':
        'The MCP server could not start: ports {{firstPort}} to {{lastPort}} are already in use. Close the app that uses them, then turn the server on again.',
    'Le serveur MCP n’a pas pu démarrer. Réessayez ou redémarrez Wmb Table.':
        'The MCP server could not start. Try again or restart Wmb Table.',
    'Le réglage du serveur MCP n’a pas pu être enregistré.':
        'The MCP server setting could not be saved.',

    // ── AI provider descriptions ──
    'Fonctionne sans connexion internet, directement sur votre ordinateur.':
        'Works offline, directly on your computer.',
    'Accédez à plusieurs modèles avec une seule clé API.':
        'Access multiple models with a single API key.',
    'ChatGPT et autres modèles OpenAI.': 'ChatGPT and other OpenAI models.',
    'Les modèles Gemini de Google.': 'Google Gemini models.',
    "Les modèles Claude d'Anthropic.": 'Anthropic Claude models.',
    'Utilisez Ollama via son API compatible OpenAI, en local ou avec une URL cloud.':
        'Use Ollama through its OpenAI-compatible API, locally or with a cloud URL.',

    // ── AI custom providers ──
    'Ajouter un fournisseur': 'Add a provider',
    'Ajouter un fournisseur personnalisé': 'Add a custom provider',
    'Compatible avec l’API OpenAI.': 'Compatible with the OpenAI API.',
    'Supprimer ce fournisseur ?': 'Delete this provider?',
    'Un fournisseur avec ce nom existe déjà.': 'A provider with this name already exists.',
    "L'URL de base est requise.": 'The base URL is required.',
    "L'URL doit commencer par http:// ou https://.": 'The URL must start with http:// or https://.',
    "Cette URL n'est pas valide.": 'This URL is not valid.',
    'Supprimer le fournisseur {{name}}': 'Delete the provider {{name}}',
    'ex: Mon Service IA': 'e.g. My AI Service',
    'ex: gpt-4o-mini': 'e.g. gpt-4o-mini',
    'Taille du contexte (tokens)': 'Context size (tokens)',

    // ── AI provider test ──
    'Tester la connexion': 'Test connection',
    Connecté: 'Connected',
    Échec: 'Failed',
    'La connexion a échoué.': 'Connection failed.',
    'La clé API a été refusée. Vérifiez-la puis réessayez.':
        'The API key was refused. Check it and try again.',
    "Le modèle ou l'adresse est introuvable. Vérifiez le modèle et l'URL de base.":
        'The model or address was not found. Check the model and the base URL.',
    "Impossible de joindre le serveur. Vérifiez l'URL de base et votre connexion.":
        'Cannot reach the server. Check the base URL and your connection.',
    'La clé API est manquante pour ce fournisseur.': 'The API key is missing for this provider.',
    'Fournisseur IA inconnu.': 'Unknown AI provider.',
    'Validation du fournisseur impossible.': 'Unable to validate the provider.',
    'La synthèse du navigateur est gérée dans le processus renderer.':
        'Browser speech synthesis is handled in the renderer process.',
    'La prévisualisation du navigateur est gérée dans le processus renderer.':
        'Browser preview is handled in the renderer process.',
    'Fournisseur TTS inconnu.': 'Unknown TTS provider.',
    'Fournisseur TTS introuvable.': 'TTS provider not found.',
    'Ce fournisseur ne prend pas en charge le téléchargement de modèles.':
        'This provider does not support model downloads.',
    'Ce fournisseur ne prend pas en charge la suppression de modèles.':
        'This provider does not support model deletion.',
    'Ce fournisseur ne prend pas en charge le clonage de voix.':
        'This provider does not support voice cloning.',
    'Voix de référence introuvable.': 'Reference voice not found.',
    "La clé API OpenAI n'est pas configurée.": 'OpenAI API key is not configured.',
    "La clé API ElevenLabs n'est pas configurée.": 'ElevenLabs API key is not configured.',
    "La clé API Cartesia n'est pas configurée.": 'Cartesia API key is not configured.',
    "Aucune voix Cartesia n'est sélectionnée.": 'No Cartesia voice is selected.',
    'La langue est requise pour cloner une voix Cartesia.':
        'Language is required to clone a Cartesia voice.',
    'Le nom du modèle est requis pour le téléchargement Sherpa.':
        'A model name is required for Sherpa download.',
    'Modèle Sherpa inconnu.': 'Unknown Sherpa model.',
    'Cette voix ne peut pas être lue sur cet ordinateur.':
        'This voice cannot be played on this computer.',

    // ── AI errors ──
    'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.':
        'No AI provider configured. Select a provider in settings.',
    'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.':
        'No model configured for this provider. Set a model in settings.',

    // ── AI chat ──
    "Posez une question sur un sujet d'étude : l'assistant développe le thème, rapproche ce que disent les prédications et les Écritures, et vous donne les références pour vérifier par vous-même.":
        'Ask a question about a study topic: the assistant develops the theme, brings together what the sermons and the Scriptures say, and gives you the references so you can check for yourself.',
    "Pour l'utiliser, choisissez un service d'IA — par exemple OpenAI, Claude, Gemini, OpenRouter, ou Ollama sur votre ordinateur — et ajoutez votre clé API si le service en demande une.":
        'To use it, choose an AI service — for example OpenAI, Claude, Gemini, OpenRouter, or Ollama on your computer — and add your API key if the service asks for one.',
    "Configurer l'assistant": 'Set up the assistant',
    'Voir le guide': 'Read the guide',
    'Le saviez-vous ? <u>{{feature}}</u> peut vous aider à explorer un sujet et comprendre plus vite ce que vous cherchez.':
        'Did you know? <u>{{feature}}</u> can help you explore a topic and understand what you are looking for faster.',
    'Configurez <u>{{feature}}</u> pour poser vos questions, approfondir un thème, comparer plusieurs prédications, retrouver des passages bibliques et obtenir des réponses claires sans tout parcourir manuellement.':
        'Set up <u>{{feature}}</u> to ask questions, dig deeper into a theme, compare multiple sermons, find Bible passages, and get clear answers without reading through everything manually.',
    "Ouvrir les réglages de l'assistant": 'Open assistant settings',
    'Le saviez-vous ? <u>{{feature}}</u> peut lire vos documents.':
        'Did you know? <u>{{feature}}</u> can read your documents aloud.',
    'Choisissez une voix pour <u>{{feature}}</u>, puis lancez la lecture directement depuis vos documents.':
        'Choose a voice for <u>{{feature}}</u>, then start playback directly from your documents.',
    'Ouvrir les réglages audio': 'Open audio settings',
    'Le saviez-vous ? <u>{{feature}}</u> peut protéger vos données.':
        'Did you know? <u>{{feature}}</u> can protect your data.',
    'Connectez Google Drive pour que <u>{{feature}}</u> garde vos notes, sujets et réglages synchronisés.':
        'Connect Google Drive so <u>{{feature}}</u> keeps your notes, subjects, and settings in sync.',
    'Ouvrir les réglages de sauvegarde': 'Open backup settings',
    'Posez votre question...': 'Ask your question...',
    'Posez votre question... ({{shortcut}} pour une nouvelle ligne)':
        'Ask your question... ({{shortcut}} for a new line)',
    'Essayez une question pour commencer': 'Try a question to get started',
    'Suggère-moi un thème à étudier.': 'Suggest a theme for me to study.',
    'Aide-moi à formuler une question de recherche.': 'Help me phrase a research question.',
    'Trouve-moi quelques références utiles sur un sujet.':
        'Find a few useful references on a topic for me.',
    'Compare plusieurs références sur un même sujet.':
        'Compare several references on the same topic.',
    Envoyer: 'Send',
    Arrêter: 'Stop',
    '{{count}} message en attente': '{{count}} pending message',
    '{{count}} messages en attente': '{{count}} pending messages',
    'Ils seront envoyés dès que cette réponse se termine.':
        'They will be sent as soon as this response finishes.',
    "En attente d'envoi.": 'Waiting to be sent.',
    "Ajoutez un message à la file d'attente...": 'Add a message to the queue...',
    "Ajoutez un message à la file d'attente... ({{shortcut}} pour une nouvelle ligne)":
        'Add a message to the queue... ({{shortcut}} for a new line)',
    "Ajouter à la file d'attente": 'Add to queue',
    'Retirer de la file': 'Remove from queue',
    'Maj+Entrée': 'Shift+Enter',
    Conversations: 'Conversations',
    'Nouvelle conversation': 'New conversation',
    'Conversation renommée': 'Conversation renamed',
    'Aucune conversation': 'No conversations',
    'Aucun sujet': 'No subjects',
    'Sélectionner ou saisir un modèle': 'Select or type a model',
    "Ce modèle est trop limité pour l'assistant. Choisissez-en un autre dans les paramètres.":
        'This model is too limited for the assistant. Choose another one in the settings.',
    "Ce modèle est trop limité pour l'assistant. Choisissez-en un autre pour pouvoir l'utiliser.":
        'This model is too limited for the assistant. Choose another one to be able to use it.',
    'Voir le raisonnement': 'Show reasoning',
    'Masquer le raisonnement': 'Hide reasoning',
    '{{count}} dernières lignes': 'last {{count}} lines',
    '+{{count}} autre': '+{{count}} other',
    '+{{count}} autres': '+{{count}} others',
    Conversation: 'Conversation',
    'Nom de la conversation': 'Conversation name',
    maintenant: 'now',
    '{{count}}min': '{{count}}min',
    '{{count}}h': '{{count}}h',
    '{{count}}j': '{{count}}d',
    '{{count}}sem': '{{count}}wk',
    '{{count}}mois': '{{count}}mo',
    '{{count}}a': '{{count}}y',
    'Cette conversation est vide.': 'This conversation is empty.',
    Vous: 'You',
    'Créé le': 'Created on',
    'Mis à jour le': 'Updated on',
    'Exporté le': 'Exported on',
    'Réponse sans texte': 'Response without text',
    'Réponse coupée : elle a atteint la longueur maximale que ce modèle peut écrire.':
        'Answer cut off: it reached the maximum length this model can write.',
    "Le modèle n'a pas répondu à temps. Réessayez, ou choisissez un modèle plus rapide dans les paramètres.":
        'The model did not answer in time. Try again, or choose a faster model in the settings.',
    'Aller en bas': 'Go to bottom',
    'Une génération est en cours.': 'A generation is in progress.',
    Réessayer: 'Retry',
    'Conversation introuvable.': 'Conversation not found.',
    'Supprimer cette conversation ?': 'Delete this conversation?',
    'Supprimer toutes les conversations ?': 'Delete all conversations?',
    "Vider l'historique": 'Clear history',
    'Le chargement des anciens messages a échoué.': 'Loading older messages failed.',
    'Connexion indisponible': 'Connection unavailable',
    'Impossible de contacter le serveur de mise à jour. Vérifiez votre connexion, puis réessayez.':
        'Could not reach the update server. Check your connection and try again.',
    'Rechercher une conversation': 'Search conversations',
    'La recherche de conversations a échoué.': 'Searching conversations failed.',
    "L'arrêt de la génération a échoué.": 'Stopping the generation failed.',
    "L'envoi du message a échoué.": 'Sending the message failed.',
    'La création de la conversation a échoué.': 'Creating the conversation failed.',
    'Le message est trop long. Raccourcissez-le puis réessayez.':
        'The message is too long. Shorten it and try again.',
    'Le chargement de la conversation a échoué.': 'Loading the conversation failed.',
    'Le chargement des anciennes conversations a échoué.': 'Loading older conversations failed.',
    'Le chargement des conversations a échoué.': 'Loading conversations failed.',
    'Le rafraîchissement des conversations a échoué.': 'Refreshing conversations failed.',
    "Recherche incomplète : la limite d'étapes a été atteinte.":
        'Research incomplete: the step limit was reached.',
    'Arrêté par vous.': 'Stopped by you.',
    "Le modèle n'a renvoyé aucun texte.": 'The model returned no text.',
    "L'assistant n'est pas encore configuré.": 'The assistant is not set up yet.',
    'Clé API refusée. Vérifiez-la dans les paramètres.':
        'API key refused. Check it in the settings.',
    'Modèle introuvable chez ce fournisseur. Choisissez-en un autre.':
        'Model not found at this provider. Choose another one.',
    'Trop de demandes pour le moment. Patientez un peu, puis réessayez.':
        'Too many requests right now. Wait a moment, then try again.',
    'Quota ou crédit épuisé chez le fournisseur.': 'Quota or credit used up at the provider.',
    'La conversation est trop longue pour ce modèle. Commencez une nouvelle conversation.':
        'The conversation is too long for this model. Start a new conversation.',
    'Le service IA est indisponible pour le moment.': 'The AI service is unavailable right now.',
    'Connexion perdue avec le service IA. Vérifiez votre réseau.':
        'Connection to the AI service lost. Check your network.',
    "Le service IA n'a pas répondu à temps.": 'The AI service did not answer in time.',
    'Le service IA a refusé la demande.': 'The AI service refused the request.',
    'Une erreur est survenue.': 'Something went wrong.',
    'Poursuivre la recherche': 'Continue the research',
    'Ouvrir les paramètres IA': 'Open AI settings',
    "Continue ta réponse là où elle s'est arrêtée.": 'Continue your answer where it stopped.',
    'Poursuis tes recherches, puis complète ta réponse.':
        'Continue your research, then complete your answer.',
    'Réponse en cours': 'Answer in progress',
    Renvoyer: 'Send again',
    'La suppression de la conversation a échoué.': 'Deleting the conversation failed.',
    "La suppression de l'historique a échoué.": 'Deleting the history failed.',
    'La relance de la réponse a échoué.': 'Retrying the response failed.',
    'La relance est disponible uniquement pour le dernier message utilisateur.':
        'Retry is only available for the last user message.',

    // ── AI tool results ──
    'Recherche de sermons': 'Sermon search',
    'Lecture du sermon': 'Reading sermon',
    'Recherche dans le contenu': 'Content search',
    'Versions de la Bible': 'Bible versions',
    'Passage biblique': 'Bible passage',
    'Liste des sujets': 'Subject list',
    'Création de sujet': 'Subject creation',
    'Ajout au sujet': 'Added to subject',
    'Liste des notes': 'Note list',
    'Lecture de la note': 'Reading note',
    'Création de note': 'Note creation',
    'Mise à jour de la note': 'Note update',
    'Ajout à la note': 'Added to note',
    'Rechercher dans la note': 'Search in note',
    'Rechercher dans la note…': 'Search in note…',
    'Remplacer par…': 'Replace with…',
    'Tout remplacer': 'Replace all',
    'Respecter la casse': 'Match case',
    'Résultat précédent': 'Previous result',
    'Résultat suivant': 'Next result',
    'Aucun résultat': 'No results',
    'Lecture du sujet': 'Reading subject',
    'Retrait du sujet': 'Removed from subject',
    'Modification de la note': 'Note edit',
    'Recherche dans les documents': 'Document search',
    'Recherche biblique': 'Bible search',
    'Recherche approfondie': 'In-depth research',
    'Recherche incomplète': 'Research incomplete',
    'Langues disponibles': 'Available languages',
    'Documents personnalisés': 'Custom documents',
    'Lecture du document': 'Reading document',

    // ── General tab ──
    'Langue active': 'content language',
    'Langue de la bibliothèque': 'Library language',
    Bibliothèque: 'Library',
    'Langues installées': 'Installed languages',
    "Documentation d'utilisation": 'User documentation',
    "Impossible d'ouvrir la documentation": 'Unable to open the documentation',
    Actif: 'Active',
    'En pause': 'Paused',
    'Non connecté': 'Not connected',
    'À jour': 'Up to date',
    Ouvrir: 'Open',

    // ── Library tab ──
    'Changer la langue': 'Change language',
    'Gérer la bibliothèque': 'Manage library',
    'Aucune langue installée': 'No languages installed',
    'Bibliothèque vide': 'Empty library',

    // ── TTS tab ──
    'Fournisseur actif': 'Active provider',
    'Le service qui lira le texte à voix haute.': 'The service that will read text aloud.',
    'Changer la voix automatiquement': 'Switch voice automatically',
    'Choisir automatiquement une voix adaptée à la langue du document.':
        'Automatically choose a voice that matches the document language.',
    'Mode de surlignage': 'Highlight mode',
    'Choisissez comment le texte est mis en évidence pendant la lecture.':
        'Choose how text is highlighted during reading.',
    Phrase: 'Sentence',
    Paragraphe: 'Paragraph',
    'Vitesse de lecture: {{rate}}x': 'Reading speed: {{rate}}x',
    'Pause entre les segments: {{gap}}s': 'Pause between segments: {{gap}}s',
    'Durée de la pause entre chaque phrase ou paragraphe lu.':
        'Duration of the pause between each spoken sentence or paragraph.',
    'Cache audio': 'Audio cache',
    'Les lectures passées sont conservées pour une relecture plus rapide.':
        'Past readings are cached for faster replay.',
    Utilisé: 'Used',
    Limite: 'Limit',
    Vider: 'Clear',
    'Cache audio vidé': 'Audio cache cleared',
    'Vider le cache audio ?': 'Clear audio cache?',
    'Toutes les lectures en mémoire seront supprimées.':
        'All cached audio readings will be deleted.',
    'Taille maximale du cache': 'Maximum cache size',

    // ── TTS enhanced reading ──
    'Lecture améliorée': 'Enhanced reading',
    "Lire l'introduction": 'Read introduction',
    'Annonce le titre, la date et le lieu avant de commencer la lecture.':
        'Announces the title, date, and location before starting to read.',
    'Annoncer les numéros': 'Announce numbers',
    'Annonce le numéro du verset ou du paragraphe avant de le lire.':
        'Announces the verse or paragraph number before reading it.',
    'Lire tout le livre (Bible)': 'Read entire book (Bible)',
    'Continue automatiquement au chapitre suivant après avoir terminé.':
        'Automatically continues to the next chapter after finishing.',
    'Défiler automatiquement': 'Auto-scroll',
    'Fait défiler la page pour toujours voir le texte en cours de lecture.':
        'Scrolls the page to always keep the currently read text visible.',

    // ── TTS shared ──
    'Voix du système': 'System voices',
    'Sherpa-ONNX TTS': 'Sherpa-ONNX TTS',
    'Kokoro TTS': 'Kokoro TTS',
    'ElevenLabs TTS': 'ElevenLabs TTS',
    'OpenAI TTS': 'OpenAI TTS',
    'Edge TTS (Microsoft)': 'Edge TTS (Microsoft)',
    'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.':
        'Free, works offline. Uses the voices already installed on your computer.',
    'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.':
        'Free, works offline. Supports many languages and voices. Requires an initial download.',
    'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.':
        'Free, works offline. Good quality, requires an initial download.',
    'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.':
        'Excellent quality. Allows voice cloning. Requires an account and internet connection.',
    'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.':
        'Excellent quality, many languages available. Requires an account and internet connection.',
    'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.':
        'Free, good quality, many languages. Requires an internet connection. No account needed.',
    Gratuit: 'Free',
    Local: 'Local',
    Cloud: 'Cloud',
    o: 'B',
    Ko: 'KB',
    Mo: 'MB',

    // ── TTS provider browser ──
    Voix: 'Voice',
    Volume: 'Volume',
    Version: 'Version',
    'Tester la voix': 'Test voice',
    'Les voix disponibles dépendent de celles installées sur votre ordinateur.':
        'Available voices depend on those installed on your computer.',
    'Voix par défaut du système': 'System default voice',
    'Hauteur: {{value}}': 'Pitch: {{value}}',
    'Ajuste la tonalité de la voix.': 'Adjusts the voice tone.',
    'Volume: {{value}}%': 'Volume: {{value}}%',

    // ── TTS provider Kokoro ──
    'À télécharger une seule fois. Environ 160 Mo.': 'Download once. Approximately 160 MB.',
    'Télécharger le modèle': 'Download model',
    'Toutes les voix sont disponibles. La voix par défaut correspond à la langue active.':
        'All voices are available. The default voice matches the content language.',
    'Modèle Kokoro téléchargé': 'Kokoro model downloaded',
    'Erreur: {{error}}': 'Error: {{error}}',
    'Erreur lors de la prévisualisation de la voix': 'Error previewing the voice',
    "Impossible d'enregistrer les paramètres de Lecture audio.":
        'Unable to save audio playback settings.',

    // ── TTS provider Sherpa ──
    'Voix disponible — {{lang}}': 'Voice available — {{lang}}',
    'Téléchargez une voix pour la langue active du document.':
        'Download a voice for the active document language.',
    'Télécharger « {{name}} »': 'Download "{{name}}"',
    'Voix active': 'Active voice',
    'Voix installées ({{count}})': 'Installed voices ({{count}})',
    'Ajouter une autre langue': 'Add another language',
    'Recherchez une langue ou un nom de voix.': 'Search for a language or voice name.',
    'Ex: arabe, portugais, swahili…': 'E.g.: Arabic, Portuguese, Swahili…',
    'Voix installée': 'Voice installed',
    'Voix {{number}}': 'Voice {{number}}',
    '{{count}} voix dans ce pack': '{{count}} voices in this pack',
    'Choisir une voix': 'Choose a voice',
    'Voix supprimée': 'Voice removed',
    Télécharger: 'Download',
    Téléchargement: 'Downloading',
    Extraction: 'Extracting',
    Finalisation: 'Finalizing',
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'No voice available for the content language. Use the search above to find a voice in another language.',
    // quality tags
    'Haute qualité': 'High quality',
    'Qualité moyenne': 'Medium quality',
    'Qualité légère': 'Light quality',
    'Qualité minimale': 'Minimal quality',
    Multilingue: 'Multilingual',

    // ── TTS provider ElevenLabs ──
    'Clé API ElevenLabs': 'ElevenLabs API Key',
    'Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Your secret ElevenLabs key. It is stored securely on your computer.',
    'Les voix marquées « cloné » sont vos voix personnalisées.':
        'Voices marked "cloned" are your custom voices.',
    'Le choix par défaut convient pour la plupart des usages.':
        'The default choice is suitable for most uses.',
    'Paramètres avancés': 'Advanced settings',
    'Voix clonées': 'Cloned voices',
    'Vos voix personnalisées.': 'Your custom voices.',
    'Cloner une voix': 'Clone a voice',
    'Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix.':
        'Record a WAV or MP3 audio of 10 to 60 seconds to create your own voice.',
    'Nom de la voix (ex: MaVoix)': 'Voice name (e.g.: MyVoice)',
    'Choisir un fichier audio': 'Choose an audio file',
    Cloner: 'Clone',
    'Voix clonée avec succès': 'Voice cloned successfully',
    'Voix clonée supprimée': 'Cloned voice deleted',
    'Voix de référence': 'Reference voices',
    'Voix intégrées pour le clonage vocal. Clonez-les pour les utiliser.':
        'Built-in voices for voice cloning. Clone them to use.',
    Cloné: 'Cloned',
    'Erreur lors de la lecture': 'Playback error',

    // ── TTS provider Edge ──
    'Sélectionnez une voix parmi les centaines disponibles, classées par langue.':
        'Select a voice from the hundreds available, sorted by language.',

    // ── TTS provider OpenAI ──
    'Clé API OpenAI': 'OpenAI API Key',
    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Your secret OpenAI key. It is stored securely on your computer.',
    'Le choix par défaut offre la meilleure qualité.':
        'The default choice offers the best quality.',
    'Marin et Cedar sont recommandées pour la meilleure qualité.':
        'Marin and Cedar are recommended for the best quality.',

    // ── TTS provider Cartesia ──
    'Cartesia TTS': 'Cartesia TTS',
    'Clé API Cartesia': 'Cartesia API Key',
    'Votre clé secrète Cartesia. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Your secret Cartesia key. It is stored securely on your computer.',
    'Langue de la voix': 'Voice language',
    "Sélectionnez la langue dans laquelle la voix clonée s'exprimera.":
        'Select the language in which the cloned voice will speak.',
    'Sélectionnez une voix': 'Select a voice',
    'Obtenir une clé API': 'Get API key',

    // ── TTS controls ──
    'Pause lecture': 'Pause reading',
    'Reprendre la lecture': 'Resume reading',
    'Démarrer la lecture': 'Start reading',
    'Lire à voix haute': 'Read aloud',
    'Pause voix': 'Pause voice',
    'Reprendre la voix': 'Resume voice',
    'Lecture audio indisponible': 'Audio playback unavailable',
    'Zoom arrière': 'Zoom out',
    'Zoom avant': 'Zoom in',
    "Lire à partir d'ici": 'Read from here',
    'Aucune voix disponible pour cette langue.': 'No voice available for this language.',

    // ── TTS compatibility messages ──
    "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres de Lecture audio.":
        'This provider is not configured. Add an API key in the Audio Playback settings.',
    "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres de Lecture audio.":
        'The voice model is not downloaded. Download it in the Audio Playback settings.',
    'Le modèle sélectionné ne prend pas en charge cette langue. Changez de modèle dans les paramètres de Lecture audio.':
        'The selected model does not support this language. Change the model in the Audio Playback settings.',
    'Ce fournisseur ne prend pas en charge cette langue.':
        'This provider does not support this language.',
    'Ce fournisseur ne peut pas lire cette langue.': 'This provider cannot read this language.',
    'Le navigateur ne dispose pas de voix pour cette langue.':
        'The browser has no voice for this language.',
    'La langue du document ne correspond pas à la langue active. Changez la langue dans les paramètres.':
        'The document language does not match the active language. Change the language in settings.',
    'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.':
        'The document language does not match the active language ({{language}}). Change the language in settings.',
    'Impossible de vérifier la compatibilité du fournisseur.':
        'Unable to verify provider compatibility.',
    'Connexion internet indisponible. Vérifiez votre connexion et réessayez.':
        'No internet connection. Check your connection and try again.',
    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.':
        'Audio playback failed. Check the provider configuration.',

    // ── History ──
    'Aucune historique': 'No history',

    // ── Search ──
    'Votre recherche doit comporter au moins trois caractères':
        'Your search must contain at least three characters',
    'Erreur lors de la recherche': 'Error during search',

    // ── Subject ──
    'Créer un sujet': 'Create a subject',
    'Nom sujet': 'Subject name',
    Enregistrer: 'Save',
    'Erreur lors du chargement des sujets': 'Error loading subjects',
    'Erreur lors du chargement des éléments du sujet': 'Error loading subject items',
    'Erreur lors de la réorganisation des références': 'Error while reordering subject references',
    'Sujet créé': 'Subject created',
    'Un sujet avec ce nom existe déjà.': 'A subject with this name already exists.',
    'Sujet introuvable': 'Subject not found',
    'Renommer le sujet': 'Rename subject',
    'Sujet renommé': 'Subject renamed',
    Supprimé: 'Deleted',
    'Aucune référence trouvée dans le sujet: {{name}}': 'No references found in subject: {{name}}',

    // ── Backup tab ──
    'Connectez-vous avec Google pour sauvegarder vos données sur Google Drive.':
        'Sign in with Google to back up your data to Google Drive.',
    'Vos données seront restaurées automatiquement lors de la connexion.':
        'Your data will be automatically restored upon sign-in.',
    'Connexion Google': 'Google Sign-in',
    'Synchronisation automatique': 'Automatic sync',
    'Dernière synchronisation : {{time}}': 'Last sync: {{time}}',
    'Accès limité': 'Limited access',
    "Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront.":
        'Sign in again and make sure to authorize the requested access by checking the boxes that appear.',
    'Erreur de synchronisation': 'Sync error',
    'Connexion réussie. Synchronisation en arrière-plan...':
        'Connection successful. Syncing in background...',
    "Une erreur s'est produite lors de la connexion, réessayez plus tard":
        'An error occurred during sign-in, please try again later',
    "Connexion refusée : vous devez autoriser tous les accès demandés. Reconnectez-vous et cochez toutes les cases d'autorisation.":
        'Connection refused: you must authorize all requested access. Please reconnect and check all authorization boxes.',
    'Synchronisation activée': 'Sync enabled',
    Déconnexion: 'Sign out',
    'Se déconnecter de Google ?': 'Sign out from Google?',
    'La synchronisation sera arrêtée et les données de connexion supprimées.':
        'Sync will be stopped and sign-in data deleted.',
    'Vos données locales seront conservées.': 'Your local data will be kept.',
    'Déconnexion réussie': 'Successfully signed out',
    "Une erreur s'est produite lors de la déconnexion, réessayez plus tard":
        'An error occurred during sign-out, please try again later',
    'Vous êtes connecté maintenant et pouvez fermer cette page.':
        'You are now connected and can close this page.',
    "L'autorisation a échoué. Veuillez réessayer depuis l'application.":
        'Authorization failed. Please try again from the application.',
    'Début de la récupération des données': 'Starting data recovery',
    'Préparation de la restauration des données': 'Preparing data restoration',
    "Une erreur s'est produite lors de la restauration, veuillez réessayer plus tard":
        'An error occurred during restoration, please try again later',
    'Vos données ont été restaurées avec succès.': 'Your data has been successfully restored.',
    "Redémarrer l'application": 'Restart the application',
    Restauration: 'Restoration',
    'de données': 'data',

    // ── Update tab ──
    "Mise à jour de l'application": 'Application update',
    'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.':
        'A new version is available. Click the button below to start the update process.',
    'Téléchargement de la mise à jour': 'Downloading update',
    'Téléchargement terminé': 'Download complete',
    "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.":
        'Please click the install button below to install the update.',
    'Erreur !': 'Error!',
    "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.":
        'An error occurred during the update, please try again later.',
    'Aucune mise à jour disponible': 'No updates available',
    "Vous utilisez déjà la dernière version de l'application.":
        'You are already using the latest version of the application.',
    Vérifier: 'Check',
    'Vérification des mises à jour...': 'Checking for updates...',
    'Mettre à jour': 'Update',
    'Installer la mise à jour': 'Install update',
    'Mise à jour disponible': 'Update available',
    'La version {{version}} est disponible.': 'Version {{version}} is available.',
    'Une nouvelle version est disponible.': 'A new version is available.',
    'Voir la mise à jour': 'View update',
    'Mise à jour prête': 'Update ready',
    "La mise à jour a été téléchargée. Elle sera installée au prochain redémarrage, ou vous pouvez l'installer maintenant.":
        'The update has been downloaded. It will be installed on the next restart, or you can install it now.',
    'Redémarrer et installer': 'Restart and install',
    'Aucune vérification effectuée': 'No check performed yet',
    'Vérifiez si une nouvelle version est disponible.': 'Check whether a new version is available.',
    'Préparation du téléchargement...': 'Preparing download...',
    'Mise à jour automatique indisponible': 'Automatic update unavailable',
    "Les mises à jour automatiques sont disponibles uniquement dans l'application installée.":
        'Automatic updates are only available in the installed application.',
    'Version actuelle': 'Current version',
    'Nouvelle version': 'New version',
    "La mise à jour automatique n'est pas prise en charge pour votre type d'installation. Veuillez télécharger la dernière version depuis le site.":
        'Automatic updates are not supported for your installation type. Please download the latest version from the website.',
    "Votre mot de passe administrateur sera demandé pour terminer l'installation.":
        'Your administrator password will be requested to complete the installation.',

    // ── Language manager modal ──
    'Supprimer cette langue ?': 'Delete this language?',
    'Les données de cette langue seront supprimées du disque.':
        'This language data will be deleted from disk.',
    Supprimer: 'Delete',
    Annuler: 'Cancel',
    'Langue téléchargée avec succès': 'Language downloaded successfully',
    'Langue mise à jour avec succès': 'Language updated successfully',
    'Téléchargez une langue pour commencer': 'Download a language to get started',
    'Rechercher une langue...': 'Search for a language...',
    'Aucune langue trouvée': 'No languages found',
    'Mes langues': 'My languages',
    Disponibles: 'Available',
    'Échec de la sélection de la langue': 'Failed to select language',
    'Langue supprimée': 'Language deleted',

    // ── Custom documents modal ──
    'Documents ajoutés': 'Added documents',
    'Erreur lors du chargement des documents': 'Error loading documents',
    'Rechercher...': 'Search...',
    Ajouter: 'Add',
    'Nom du document': 'Document name',
    'Ce nom existe déjà': 'This name already exists',
    'Seul le format PDF est pris en charge.': 'Only PDF format is supported.',
    'Un document avec ce nom existe déjà.': 'A document with this name already exists.',
    'Choisir un fichier PDF': 'Choose a PDF file',
    'Document supprimé': 'Document deleted',
    'Langue du document': 'Document language',
    'Langue modifiée': 'Language changed',
    'Traitement...': 'Processing...',
    Retour: 'Back',
    "Erreur lors de l'extraction du document.": 'Error extracting the document.',
    'Document ajouté': 'Document added',

    // ── Highlight modal ──
    Souligner: 'Highlight',
    Couleur: 'Color',
    Jaune: 'Yellow',
    Vert: 'Green',
    Bleu: 'Blue',
    'Vert clair': 'Light green',
    'Bleu ciel': 'Sky blue',
    Rose: 'Pink',
    Orange: 'Orange',
    Violet: 'Purple',
    Turquoise: 'Turquoise',
    Rouge: 'Red',
    Menthe: 'Mint',
    Pêche: 'Peach',
    Lavande: 'Lavender',
    Corail: 'Coral',
    Cyan: 'Cyan',
    Lime: 'Lime',
    Commentaire: 'Comment',
    'Ajouter un commentaire (optionnel)': 'Add a comment (optional)',
    'Surlignage enregistré': 'Highlight saved',
    "Erreur lors de l'enregistrement": 'Error saving',

    // ── Document audio player ──
    'Langue: {{name}}': 'Language: {{name}}',

    // ── Bible version selector ──
    'Version:': 'Version:',
    'Télécharger {{name}}': 'Download {{name}}',
    'Télécharger une version': 'Download a version',
    "Télécharger d'autres versions": 'Download other versions',
    '{{count}} versions à télécharger': '{{count}} versions to download',

    // ── Delete button ──
    'Confirmer la suppression?': 'Confirm deletion?',
    Oui: 'Yes',
    Non: 'No',

    // ── Note references modal ──
    'Lier ce paragraphe à une référence de la note :': 'Link this paragraph to a note reference:',
    "Aucune note n'est actuellement sélectionnée": 'No note is currently selected',
    'Aucune référence disponible': 'No references available',
    'Lié à : {{title}}': 'Linked to: {{title}}',
    'Aucun document attribué': 'No document assigned',
    'Ajouter à cette référence': 'Add to this reference',
    'Ajouté à la note': 'Added to note',
    "Erreur lors de l'ajout à la note": 'Error adding to note',

    // ── Other traductions modal ──
    'Traductions du document: {{title}}': 'Document translations: {{title}}',
    'Sources de traduction': 'Translation sources',
    'Traduction {{id}}': 'Translation {{id}}',
    'Basculer vers cette traduction': 'Switch to this translation',
    'Autres langues': 'Other languages',
    'Langue: {{code}}': 'Language: {{code}}',
    'Ouvrir le document': 'Open document',
    'Aucune autre traduction disponible': 'No other translations available',

    // ── Subject select modal ──
    'Choiser un sujet': 'Choose a subject',
    'Choisir un sujet': 'Choose a subject',
    'Ajouté au sujet': 'Added to subject',
    "Erreur lors de l'ajout au sujet": 'Error adding to subject',

    // ── Document tabs ──
    'Fermer tous les onglets': 'Close all tabs',
    'Voulez-vous vraiment fermer tous les onglets ?': 'Do you really want to close all tabs?',
    'Tout fermer': 'Close all',
    Fermer: 'Close',
    'Fermer les autres': 'Close others',
    'Fermer à droite': 'Close to the right',

    // ── Sync listener ──
    'Session Google expirée. Le compte a été déconnecté. Reconnectez-vous dans les paramètres de sauvegarde.':
        'Google session expired. The account has been disconnected. Please reconnect in backup settings.',

    // ── Layout ──
    'Chargement des données...': 'Loading data...',
    'Synchronisation en cours...': 'Syncing...',
    'Synchronisation... {{processed}}/{{total}}': 'Synchronizing... {{processed}}/{{total}}',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Select a paragraph',
    'Aucun paragraphe': 'No paragraphs',
    'Sélectionnez un verset': 'Select a verse',
    'Aucun verset': 'No verses',

    // ── Sermon paragraph ──
    'Surlignage supprimé': 'Highlight deleted',
    'Erreur lors de la suppression': 'Error deleting',
    'Supprimer le surlignage': 'Delete highlight',

    // ── Sermon header ──
    Pause: 'Pause',
    Écouter: 'Listen',
    "Écouter l'audio": 'Listen to audio',
    'Pause audio': 'Pause audio',
    Traductions: 'Translations',
    Rechercher: 'Search',

    // ── Bible document view ──
    'Chapitre {{chapter}}': 'Chapter {{chapter}}',
    'Chapitre précédent': 'Previous chapter',
    'Chapitre suivant': 'Next chapter',

    // ── Search result list ──
    'Trouvé dans {{count}} document': 'Found in {{count}} document',
    'Trouvé dans {{count}} documents': 'Found in {{count}} documents',
    'page ({{current}}/{{total}})': 'page ({{current}}/{{total}})',
    'Aucun résultat trouvé': 'No results found',

    // ── Bible search ──
    'Tous les testaments': 'All testaments',
    'Nouveau Testament': 'New Testament',
    'Ancien Testament': 'Old Testament',
    'Faites vos recherches biblique ici': 'Search the Bible here',
    Testaments: 'Testaments',
    'Trouvé dans {{count}} verset': 'Found in {{count}} verse',
    'Trouvé dans {{count}} versets': 'Found in {{count}} verses',

    // ── Bible content ──
    'Aucune Bible disponible pour cette langue': 'No Bible available for this language',
    'Aucune version biblique active disponible.': 'No active Bible version is available.',
    Ancien: 'Old',
    Testament: 'Testament',
    'Ajouter à un sujet': 'Add to a subject',

    // ── Notes ──
    'Erreur lors du chargement des notes': 'Error loading notes',
    'Note supprimée': 'Note deleted',
    'Note introuvable ou vide': 'Note not found or empty',
    'Aucun modèle Sherpa-ONNX installé': 'No Sherpa-ONNX model installed',
    'Aucun modèle local GGUF trouvé dans ~/.wmb-table/ai-models.':
        'No local GGUF model found in ~/.wmb-table/ai-models.',
    'Le modèle local n\u2019est pas chargé.': 'The local model is not loaded.',
    'Erreur lors de la création de la note': 'Error creating note',
    'Nouvelle note': 'New note',
    'Aucune note': 'No notes',

    // ── Inline search bar ──
    'Aller au paragraphe': 'Go to paragraph',

    // ── Langue label ──
    'Langue:': 'Language:',

    // ── Sermon content header ──
    'Date:': 'Date:',
    'Traduction:': 'Translation:',

    // ── Search input ──
    'Au moins un mot': 'At least one word',
    'Tous les mots': 'All words',
    'Phrase exacte': 'Exact phrase',
    'Faites vos recherches ici': 'Search here',

    // ── Search result item ──
    '{{count}} correspondance': '{{count}} match',
    '{{count}} correspondances': '{{count}} matches',
    'Voir moins': 'See less',
    'Voir tout ({{count}})': 'See all ({{count}})',

    // ── Editor ──
    'Le nom entré est invalid': 'The name entered is invalid',
    Modifié: 'Modified',
    Enregistré: 'Saved',
    Alerte: 'Alert',
    "Semble que votre note n'a pas de contenu, si vous continuez cette note sera inconsidérée et elle sera supprimée":
        'It seems your note has no content; if you continue, this note will be ignored and deleted',
    Continuer: 'Continue',
    'Activer le mode lecture': 'Enable reading mode',
    'Désactiver le mode lecture': 'Disable reading mode',
    Exporter: 'Export',
    'Exporter au format PDF': 'Export to PDF',
    'Exporter au format DOCX': 'Export to DOCX',
    'Exporter en PDF': 'Export to PDF',
    "Erreur lors de l'export PDF": 'Error exporting PDF',
    'PDF exporté avec succès': 'PDF exported successfully',
    'La référence est invalide': 'The reference is invalid',
    'La référence biblique est invalide': 'The biblical reference is invalid',
    'Référence supprimée': 'Reference deleted',
    'Cliquez droit sur une référence pour la supprimer': 'Right-click on a reference to delete it',
    'Référence sermon: {{label}}': 'Sermon reference: {{label}}',
    'Référence Bible: {{label}}': 'Bible reference: {{label}}',
    'Aucune sélection trouvée pour la référence': 'No selection found for the reference',
    'Référence sermon': 'Sermon reference',
    'Référence Bible': 'Bible reference',
    'Supprimer la référence': 'Delete reference',
    Français: 'French',
    English: 'English',

    // ── References modal ──
    'Référence: {{label}}': 'Reference: {{label}}',
    "Aucun document n'a été attribué pour cette référence":
        'No document has been assigned for this reference',
    'Verset supprimé': 'Verse deleted',
    'Le verset cliqué existe déjà dans la références !':
        'The clicked verse already exists in the references!',
    'Verset ajouté': 'Verse added',
    'Aucun verset sélectionné': 'No verse selected',
    'Ajouter des versets': 'Add verses',

    // ── Error boundary ──
    "Une erreur inattendue s'est produite": 'An unexpected error occurred',
    "Recharger l'application": 'Reload the application',

    // ── Native menu ──
    '&Fichier': '&File',
    '&Fermer': '&Quit',
    Éditer: 'Edit',
    Défaire: 'Undo',
    Refaire: 'Redo',
    Couper: 'Cut',
    Copier: 'Copy',
    Coller: 'Paste',
    'Tout sélectionner': 'Select all',
    '&Vue': '&View',
    'Basculer la barre latérale': 'Toggle sidebar',
    'Changer de menu': 'Switch menu',
    "Changer d'option": 'Switch option',
    'Mode lecture': 'Reading mode',
    'Quitter le mode lecture': 'Exit reading mode',
    'Basculer en plein écran': 'Toggle fullscreen',
    Aide: 'Help',
    Documentation: 'Documentation',
    'Nous contacter': 'Contact Us',
    'À propos': 'About',
    Produit: 'Product',
    'Site web': 'Website',
    Auteur: 'Author',
    Licence: 'License',
    "Aujourd'hui": 'Today',
    'Aucun document consulté ce jour': 'No document opened this day',
    Renommer: 'Rename',
    Traduction: 'Translation',
    'Texte copié': 'Text copied',
    'Copier le texte sélectionné': 'Copy selected text',
    'Impossible de copier le texte.': 'Unable to copy the text.',
    'Sélectionnez du texte à souligner': 'Select text to highlight',
    'Ajouter au sujet': 'Add to subject',
    'Ajouter à la note': 'Add to note',
    'Trouver des prédications similaires': 'Find similar sermons',
    'Prédications similaires': 'Similar sermons',
    'Aucune prédication similaire trouvée': 'No similar sermons found',
    Prédication: 'Sermon',
    Document: 'Document',
    Référence: 'Reference',
    'Sauvegarde de données': 'Backing up data',
    'Restauration de données': 'Restoring data',

    // ── General ──
    sermons: 'sermons',
    disponible: 'available',
    "Erreur lors de l'initialisation de l'application": 'Application initialization error',
    'Une erreur inattendue est survenue.': 'An unexpected error occurred.',
    'Mémoriser la position de lecture': 'Remember reading position',
    "Rouvrez un document là où vous l'aviez laissé la dernière fois.":
        'Reopen a document where you left off last time.',
    "Impossible d'enregistrer le paramètre": 'Unable to save the setting',
    "Nombre maximum d'onglets": 'Maximum number of tabs',
    'Les onglets les plus anciens seront fermés automatiquement lorsque la limite est atteinte ({{min}}-{{max}}).':
        'The oldest tabs will be closed automatically when the limit is reached ({{min}}-{{max}}).',
    chapitres: 'chapters',
    chapitre: 'chapter',

    // ── Welcome ──
    Commencer: 'Get started',
    'Bienvenue dans Wmb Table': 'Welcome to Wmb Table',
    'Votre espace pour lire, étudier et préparer vos prédications.':
        'Your workspace for reading, studying, and preparing your sermons.',
    'Prédications et Bible': 'Sermons and Bible',
    'Ouvrez les prédications et la Bible dans des onglets, naviguez par paragraphe.':
        'Open sermons and the Bible in tabs, navigate by paragraph.',
    'Prenez des notes, classez vos passages par sujets avec des références.':
        'Take notes, organize your passages by subject with references.',
    'Recherche complète': 'Full search',
    'Recherchez dans le contenu des prédications, la Bible et vos documents.':
        'Search inside sermon content, the Bible, and your documents.',
    'Surlignez les passages importants avec des couleurs et retrouvez-les facilement.':
        'Highlight important passages with colors and find them easily.',
    'Écoutez les prédications avec plusieurs voix disponibles.':
        'Listen to sermons with multiple voices available.',
    'Posez des questions et obtenez des réponses avec des références cliquables.':
        'Ask questions and get answers with clickable references.',

    // ── Theme ──
    Apparence: 'Appearance',
    'Taille du texte': 'Text size',
    "Langue de l'interface": 'Interface language',
    "Détermine la langue des menus, boutons et messages de l'application.":
        'Controls the language of menus, buttons, and messages in the app.',
    "Automatique suit la langue active de la bibliothèque quand elle est disponible pour l'interface.":
        'Automatic follows the active library language when it is available for the interface.',
    'Langue active de la bibliothèque : {{libraryLanguage}}.':
        'Active library language: {{libraryLanguage}}.',
    "Langue de l'interface actuelle : {{uiLanguage}}.":
        'Current interface language: {{uiLanguage}}.',
    "Comme la langue active de la bibliothèque n'est pas prise en charge pour l'interface, l'application utilise {{fallbackLanguage}}.":
        'Because the active library language is not supported for the interface, the app uses {{fallbackLanguage}}.',
    "Aucune langue de bibliothèque n'est définie pour le moment.":
        'No library language is currently set.',
    "L'interface est verrouillée sur {{uiLanguage}}.": 'The interface is locked to {{uiLanguage}}.',
    'La langue active de la bibliothèque est aussi {{libraryLanguage}}.':
        'The active library language is also {{libraryLanguage}}.',
    "Utilisez Automatique si vous voulez garder la langue de l'interface synchronisée avec la langue active de la bibliothèque.":
        'Use Automatic if you want to keep the interface language synced with the active library language.',
    'Automatique suit la langue active de la bibliothèque. Actuellement : {{uiLanguage}}.':
        'Automatic follows the active library language. Currently: {{uiLanguage}}.',
    "La langue active de la bibliothèque, {{libraryLanguage}}, n'est pas disponible pour l'interface. L'application utilise {{fallbackLanguage}}.":
        'The active library language, {{libraryLanguage}}, is not available for the interface. The app uses {{fallbackLanguage}}.',
    'Automatique utilise actuellement {{uiLanguage}}.':
        'Automatic is currently using {{uiLanguage}}.',
    "L'interface est fixée sur {{uiLanguage}}. Utilisez Automatique pour la garder synchronisée avec la bibliothèque.":
        'The interface is fixed to {{uiLanguage}}. Use Automatic to keep it synced with the library.',
    "L'interface est fixée sur {{uiLanguage}}. Bibliothèque : {{libraryLanguage}}.":
        'The interface is fixed to {{uiLanguage}}. Library: {{libraryLanguage}}.',
    "L'interface est fixée sur {{uiLanguage}}.": 'The interface is fixed to {{uiLanguage}}.',
    Automatique: 'Automatic',
    Petit: 'Small',
    Normal: 'Normal',
    Grand: 'Large',
    'Très grand': 'Extra large',
    Clair: 'Light',
    Sombre: 'Dark',
    Système: 'System',
    'Utilise le thème clair en journée et le thème sombre le soir.':
        'Uses the light theme during the day and the dark theme in the evening.',
    "Suit automatiquement l'apparence définie par votre système.":
        'Automatically follows the appearance defined by your system.',
    'Utilise toujours le thème clair.': 'Always uses the light theme.',
    'Utilise toujours le thème sombre.': 'Always uses the dark theme.',

    // ── Inline help ──
    'Comprendre cette page': 'Understand this page',
    'Regroupez vos versets et passages par thème.': 'Group your verses and passages by theme.',
    'À quoi servent les sujets ?': 'What are subjects for?',
    "Les sujets rassemblent des versets, passages de prédications et extraits de documents autour d'un même thème.":
        'Subjects gather verses, sermon passages, and document excerpts around the same theme.',
    'Créez un sujet pour chaque thème important que vous préparez.':
        'Create one subject for each important theme you are preparing.',
    'Ajoutez des références depuis la lecture ou depuis la Bible.':
        'Add references from reading view or from the Bible.',
    "Réorganisez les références dans l'ordre qui vous aide le mieux.":
        'Reorder references in the way that helps you most.',
    'Utilisez plutôt les notes pour écrire vos idées longues, vos plans et vos commentaires personnels.':
        'Use notes instead for longer ideas, outlines, and personal comments.',
    'Gardez vos plans, idées et références dans un seul endroit.':
        'Keep your outlines, ideas, and references in one place.',
    'À quoi servent les notes ?': 'What are notes for?',
    'Les notes gardent vos idées, plans et repères de préparation dans un seul endroit.':
        'Notes keep your ideas, outlines, and preparation markers in one place.',
    'Créez une note par message, étude ou projet.':
        'Create one note per sermon, study, or project.',
    'Ajoutez des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'Add references to the Bible or sermons so you can find the source later.',
    'Utilisez les sujets pour classer des références, et les notes pour développer votre pensée.':
        'Use subjects to organize references, and notes to develop your thinking.',
    'Que fait cette page Bible ?': 'What does this Bible page do?',
    'Cette page sert surtout à rechercher dans la Bible et à gérer les versions bibliques.':
        'This page is mainly for searching the Bible and managing Bible versions.',
    'Retrouvez vite un mot, une expression ou un passage biblique.':
        'Quickly find a word, phrase, or Bible passage.',
    'Filtrez la recherche par testament pour aller plus vite.':
        'Filter search by testament to get there faster.',
    'Comparez ou téléchargez des versions bibliques selon vos besoins.':
        'Compare or download Bible versions according to your needs.',
    'Par rapport à la Bible dans la barre latérale': 'Compared with the Bible in the sidebar',
    'La barre latérale est plus adaptée pour ouvrir et lire un chapitre. Cette page est plus utile pour la recherche et la gestion des versions.':
        'The sidebar is better suited to opening and reading a chapter. This page is more useful for search and version management.',
    'À quoi servent les réglages de Lecture audio ?': 'What are the Text-to-Speech settings for?',
    'Cet onglet configure la voix qui lira vos prédications, chapitres bibliques et documents personnels.':
        'This tab configures the voice that reads your sermons, Bible chapters, and personal documents.',
    'Choisissez un fournisseur et une voix.': 'Choose a provider and a voice.',
    'Testez la lecture et ajustez la vitesse.': 'Test playback and adjust the speed.',
    "Réglez le surlignage, l'introduction et le cache audio.":
        'Adjust highlighting, introduction, and audio cache.',
    'Si vous voulez quelque chose de simple, gardez le fournisseur proposé puis testez une voix.':
        'If you want something simple, keep the suggested provider and test a voice.',
    "À quoi servent les réglages de l'assistant ?": 'What are the assistant settings for?',
    "Cet onglet choisit le service d'IA de l'assistant et la façon dont il répond.":
        "This tab chooses the assistant's AI service and how it responds.",
    'Sélectionnez un fournisseur local, cloud ou personnalisé.':
        'Select a local, cloud, or custom provider.',
    'Définissez la langue et le modèle utilisés pour les réponses.':
        'Set the language and model used for responses.',
    'Comment fonctionne la recherche ?': 'How does search work?',
    'Cette page recherche dans les prédications de votre bibliothèque et vous ramène directement au bon passage.':
        'This page searches through the sermons in your library and takes you straight to the right passage.',
    'Entrez au moins trois caractères pour lancer une recherche.':
        'Enter at least three characters to start a search.',
    'Choisissez le mode selon que vous cherchez un mot, plusieurs mots ou une phrase exacte.':
        'Choose the mode depending on whether you are looking for one word, several words, or an exact phrase.',
    'Ouvrez un résultat pour aller directement au paragraphe correspondant.':
        'Open a result to jump directly to the matching paragraph.',
    'Retrouvez rapidement un mot, une expression ou un thème dans les prédications.':
        'Quickly find a word, phrase, or theme in sermons.',
    'À quoi servent les soulignages ?': 'What are highlights for?',
    'Cette page rassemble tous les passages marqués pendant vos lectures.':
        'This page gathers all passages marked during your reading.',
    'Retrouvez rapidement les passages importants que vous avez gardés.':
        'Quickly find the important passages you kept.',
    'Filtrez par mot-clé dans le texte, le titre ou le commentaire.':
        'Filter by keyword in the text, title, or comment.',
    'Rouvrez le document exact ou exportez la liste en PDF.':
        'Reopen the exact document or export the list as PDF.',
    'Les soulignages se créent dans la vue de lecture, pas sur cette page.':
        'Highlights are created in reading view, not on this page.',
    'Revoyez tous les passages marqués pendant vos lectures.':
        'Review all passages marked during your reading.',
    'La Bible vous aide à ouvrir rapidement un chapitre dans la lecture, comparer les versions et retrouver un passage sans quitter votre préparation.':
        'The Bible helps you quickly open a chapter in reading view, compare versions, and find a passage without leaving your preparation.',
    "Elle sert de point d'entrée vers la lecture biblique dans l'application.":
        'It serves as an entry point to Bible reading in the application.',
    'Une fois le chapitre ouvert, vous profitez des outils de lecture du document.':
        'Once the chapter is open, you benefit from the document reading tools.',
    'Elle vous aide aussi à parcourir les livres, comparer les versions et lancer une recherche biblique dédiée.':
        'It also helps you browse books, compare versions, and run a dedicated Bible search.',
    "C'est le chemin le plus direct pour ouvrir un livre ou un chapitre dans la vue de lecture.":
        'It is the most direct path to open a book or chapter in reading view.',
    'Utilisez cette page pour parcourir la Bible plus calmement.':
        'Use this page to browse the Bible more deliberately.',
    'Utilisez la barre latérale pour ouvrir vite un chapitre. Utilisez cette page quand vous voulez explorer, comparer ou rechercher plus précisément.':
        'Use the sidebar to quickly open a chapter. Use this page when you want to explore, compare, or search more precisely.',
    'Ce que cette fonction vous apporte': 'What this feature gives you',
    'Pour commencer': 'To get started',
    'Elle évite de refaire les mêmes recherches chaque fois que vous préparez un thème.':
        'It helps you avoid repeating the same searches every time you prepare a theme.',
    'Elle garde ensemble vos meilleures références bibliques et vos passages de prédications.':
        'It keeps your best Bible references and sermon passages together.',
    "Elle vous aide à construire un ordre clair pour l'étude, la prédication ou l'export PDF.":
        'It helps you build a clear order for study, preaching, or PDF export.',
    "Elle aide à organiser vos références dans un ordre utile pour l'étude, la prédication ou l'export PDF.":
        'It helps organize your references in an order that is useful for study, preaching, or PDF export.',
    'Elle sert à développer votre pensée, vos plans et vos commentaires personnels.':
        'It is meant for developing your thoughts, outlines, and personal comments.',
    'Elle sert à développer vos idées, vos plans et vos commentaires personnels.':
        'It is meant for developing your ideas, outlines, and personal comments.',
    'Elle vous aide à garder vos idées de préparation dans un espace plus libre que les sujets.':
        'It helps you keep your preparation ideas in a more flexible space than subjects.',
    'Elle vous offre un espace de préparation plus libre et plus personnel que les sujets.':
        'It gives you a preparation space that is freer and more personal than subjects.',
    'Elle peut aussi contenir des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'It can also contain references to the Bible or sermons so you can find the source later.',
    'Elle peut garder des références vers la Bible ou les prédications pour retrouver vos sources rapidement.':
        'It can keep references to the Bible or sermons so you can find your sources quickly.',
    'Elle vous permet de confirmer rapidement un passage, comparer des versets et garder la Bible dans votre flux de travail.':
        'It lets you quickly confirm a passage, compare verses, and keep the Bible in your workflow.',
    'Elle réunit la lecture, les versions bibliques et la recherche au même endroit.':
        'It brings reading, Bible versions, and search together in one place.',
    "Elle permet d'écouter vos contenus au lieu de seulement les lire.":
        'It lets you listen to your content instead of only reading it.',
    'Elle est utile pour suivre un texte, relire pendant un déplacement ou continuer votre étude en audio.':
        'It is useful for following a text, reviewing while traveling, or continuing your study in audio.',
    "Elle contrôle aussi l'expérience de lecture: voix, vitesse, surlignage et comportement audio.":
        'It also controls the listening experience: voice, speed, highlighting, and audio behavior.',
    "L'assistant peut aider à explorer un thème, retrouver des références et comparer plus vite plusieurs contenus.":
        'The assistant can help explore a theme, find references, and compare multiple contents faster.',
    'Cet onglet détermine quel service il utilise et dans quelle langue il travaille.':
        'This tab determines which service it uses and which language it works in.',
    'Vous pouvez choisir une solution locale, cloud ou personnalisée selon vos besoins.':
        'You can choose a local, cloud, or custom solution depending on your needs.',
    'Ajoutez votre clé API si le service en demande une.':
        'Add your API key if the service asks for one.',
    'Elle sert à retrouver rapidement un mot, un thème, un lieu ou une expression dans les prédications.':
        'It is used to quickly find a word, theme, place, or expression in sermons.',
    'Elle évite de parcourir manuellement plusieurs documents quand vous savez déjà ce que vous cherchez.':
        'It avoids manually browsing multiple documents when you already know what you are looking for.',
    'Elle vous ramène directement au paragraphe utile quand vous ouvrez un résultat.':
        'It takes you directly to the useful paragraph when you open a result.',
    'Elle vous donne une vue unique de tous les passages importants que vous avez repérés.':
        'It gives you a single view of all the important passages you marked.',
    'Elle aide à revoir vos découvertes sans devoir rouvrir chaque document un par un.':
        'It helps you review your findings without reopening every document one by one.',
    'Elle permet aussi de filtrer, rouvrir la source exacte ou exporter la liste en PDF.':
        'It also lets you filter, reopen the exact source, or export the list as PDF.',

    // ── Notes editor toolbar (Tiptap) ──
    'Annuler la modification': 'Undo',
    Rétablir: 'Redo',
    'Style de paragraphe': 'Paragraph style',
    Police: 'Font',
    'Taille de la police': 'Font size',
    'Langue du texte': 'Text language',
    Gras: 'Bold',
    Italique: 'Italic',
    Souligné: 'Underline',
    Barré: 'Strikethrough',
    Indice: 'Subscript',
    Exposant: 'Superscript',
    'Couleur du texte': 'Text color',
    Surlignage: 'Highlight',
    'Aligner à gauche': 'Align left',
    Centrer: 'Center',
    'Aligner à droite': 'Align right',
    Justifier: 'Justify',
    'Liste à puces': 'Bulleted list',
    'Liste numérotée': 'Numbered list',
    'Liste de tâches': 'Task list',
    'Réduire le retrait': 'Decrease indent',
    'Augmenter le retrait': 'Increase indent',
    'Supprimer le lien': 'Remove link',
    'Ajouter un lien': 'Add link',
    'Modifier le lien': 'Edit link',
    Citation: 'Quote',
    'Insérer un tableau': 'Insert table',
    'Supprimer le tableau': 'Delete table',
    'Ligne horizontale': 'Horizontal line',
    'Saut de page': 'Page break',
    'Adresse du lien': 'Link URL',
    'Langue par défaut': 'Default language',
    'Par défaut': 'Default',
    'Titre {{n}}': 'Heading {{n}}',
    'Commencez à écrire votre note…': 'Start writing your note…',
    'Code en ligne': 'Inline code',
    'Bloc de code': 'Code block',
    'Effacer la mise en forme': 'Clear formatting',
    'Ajouter une ligne': 'Add row',
    'Ajouter une colonne': 'Add column',
    'Supprimer la ligne': 'Delete row',
    'Supprimer la colonne': 'Delete column',
    'Fusionner les cellules': 'Merge cells',
    'Séparer la cellule': 'Split cell',
    "La note n'a pas de contenu à exporter": 'The note has no content to export',
    "Impossible d'exporter la note en PDF": 'Unable to export the note as PDF',
    "Impossible d'exporter la note en DOCX": 'Unable to export the note as DOCX',

    // ── Misc UI labels ──
    'Aucun résultat pour "{{query}}"': 'No results for "{{query}}"',
    'Connexion réussie': 'Connection successful',
    'Échec de la connexion': 'Connection failed',
    'Génération en cours': 'Generation in progress',
    "La version {{version}} est disponible. La mise à jour automatique n'est pas prise en charge pour votre type d'installation. Veuillez télécharger la nouvelle version depuis le site.":
        'Version {{version}} is available. Automatic updates are not supported for your installation type. Please download the new version from the website.',
    Langue: 'Language',
    'Non défini': 'Not set',
    'Notes et sujets': 'Notes and subjects',
    'Télécharger depuis le site': 'Download from the website',

    // ── wmb:// reference modal ──
    'Référence introuvable': 'Reference not found',
    'Chargement de la référence…': 'Loading reference…',
    'Paragraphe {{n}}': 'Paragraph {{n}}',
    Sermon: 'Sermon',
    'Document personnalisé': 'Custom document',
};

export default en;
