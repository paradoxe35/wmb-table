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
    Gérer: 'Manage',
    Alphabet: 'Alphabet',
    Année: 'Year',
    Années: 'Years',
    'A-Z': 'A-Z',

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
    "Activer l'assistant IA": 'Enable AI assistant',
    "Une fois activé, l'assistant apparaît dans la barre latérale.":
        'Once enabled, the assistant appears in the sidebar.',
    'Clé API': 'API key',
    'URL de base': 'Base URL',
    Modèle: 'Model',
    Identifiant: 'Identifier',
    'Nom affiché': 'Display name',
    Optionnel: 'Optional',
    'Modèle par défaut': 'Default model',
    Recommandé: 'Recommended',
    Installé: 'Installed',
    Nouveau: 'New',

    // ── AI settings ──
    'Choisissez le service à utiliser pour le chat IA.': 'Choose the service to use for AI chat.',
    'Choisir un fournisseur': 'Choose a provider',
    Personnalisé: 'Custom',
    'Comportement des langues': 'Language behavior',
    "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.":
        'The assistant follows the content language unless you explicitly ask for another one.',
    'Suivre la langue active': 'Follow the content language',
    'Changer uniquement sur demande': 'Switch only on request',
    "Utilisez l'identifiant exact du modèle fourni par ce service.":
        'Use the exact model identifier provided by this service.',

    // ── AI provider descriptions ──
    'Fonctionne sans connexion internet, directement sur votre ordinateur.':
        'Works offline, directly on your computer.',
    'Accédez à plusieurs modèles avec une seule clé API.':
        'Access multiple models with a single API key.',
    'ChatGPT et autres modèles OpenAI.': 'ChatGPT and other OpenAI models.',
    'Les modèles Gemini de Google.': 'Google Gemini models.',
    "Les modèles Claude d'Anthropic.": 'Anthropic Claude models.',

    // ── AI local models ──
    'Modèle local': 'Local model',
    Actualiser: 'Refresh',
    'Choisir un modèle': 'Choose a model',
    Utiliser: 'Use',
    'Modèle téléchargé': 'Model downloaded',
    'Le téléchargement a échoué.': 'Download failed.',
    '~{{size}} Mo': '~{{size}} MB',
    'Léger et rapide. Idéal pour un usage quotidien sur la plupart des ordinateurs.':
        'Lightweight and fast. Ideal for daily use on most computers.',
    'Plus complet, meilleure compréhension. Nécessite un peu plus de mémoire.':
        'More capable, better understanding. Requires a bit more memory.',
    'Fonctionne sans connexion internet, directement sur votre ordinateur. Téléchargez un modèle pour commencer.':
        'Works offline, directly on your computer. Download a model to get started.',
    'Le mode local est plus limité': 'Local mode is more limited',
    'Le mode local peut répondre plus lentement et avec moins de précision, surtout pour les questions longues ou difficiles.':
        'Local mode may respond more slowly and with less accuracy, especially for long or difficult questions.',
    'Utiliser la carte graphique (GPU)': 'Use graphics card (GPU)',
    'Accélère les réponses si votre ordinateur possède une carte graphique compatible. Désactivez cette option en cas de problème.':
        'Speeds up responses if your computer has a compatible graphics card. Disable this option if you experience issues.',

    // ── AI custom providers ──
    'Ajouter un fournisseur': 'Add a provider',
    'Ajouter un fournisseur personnalisé': 'Add a custom provider',
    'Supprimer ce fournisseur ?': 'Delete this provider?',
    'Un fournisseur avec ce nom existe déjà.': 'A provider with this name already exists.',
    'ex: Mon Service IA': 'e.g. My AI Service',
    'ex: gpt-4o-mini': 'e.g. gpt-4o-mini',
    'Taille du contexte (tokens)': 'Context size (tokens)',

    // ── AI provider test ──
    'Tester la connexion': 'Test connection',
    Connecté: 'Connected',
    Échec: 'Failed',
    'La connexion a échoué.': 'Connection failed.',

    // ── AI errors ──
    "L'assistant IA est désactivé dans les paramètres.":
        'The AI assistant is disabled in settings.',
    'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.':
        'No AI provider configured. Select a provider in settings.',
    'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.':
        'No model configured for this provider. Set a model in settings.',

    // ── AI chat ──
    "L'assistant IA est désactivé.": 'The AI assistant is disabled.',
    'Ouvrir les paramètres': 'Open settings',
    'Posez votre question...': 'Ask your question...',
    Envoyer: 'Send',
    Arrêter: 'Stop',
    Conversations: 'Conversations',
    'Aucune conversation': 'No conversations',
    'Aucun sujet': 'No subjects',
    'Sélectionner ou saisir un modèle': 'Select or type a model',
    'Voir le raisonnement': 'Show reasoning',
    'Masquer le raisonnement': 'Hide reasoning',
    '{{count}} dernières lignes': 'last {{count}} lines',
    '+{{count}} autre': '+{{count}} other',
    '+{{count}} autres': '+{{count}} others',
    Conversation: 'Conversation',
    maintenant: 'now',
    'Supprimer cette conversation ?': 'Delete this conversation?',
    'Supprimer toutes les conversations ?': 'Delete all conversations?',
    "Vider l'historique": 'Clear history',

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
    'Recherche biblique': 'Bible search',
    'Recherche approfondie': 'In-depth research',
    'Langues disponibles': 'Available languages',
    'Documents personnalisés': 'Custom documents',
    'Lecture du document': 'Reading document',

    // ── General tab ──
    'Langue active': 'content language',
    'Langue des prédications': 'Sermon language',
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
    'Lecture automatique': 'Auto-play',
    "Démarrer la lecture automatiquement à l'ouverture d'un document.":
        'Automatically start reading when a document is opened.',
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
    'Aucun résultat': 'No results',
    'Voix installée': 'Voice installed',
    'Voix supprimée': 'Voice removed',
    Télécharger: 'Download',
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'No voice available for the content language. Use the search above to find a voice in another language.',
    // quality tags
    'Haute qualité': 'High quality',
    'Qualité moyenne': 'Medium quality',
    'Qualité légère': 'Light quality',
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
    'Impossible de vérifier la compatibilité du fournisseur.':
        'Unable to verify provider compatibility.',
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

    // ── Language manager modal ──
    'Supprimer cette langue ?': 'Delete this language?',
    'Les données de cette langue seront supprimées du disque.':
        'This language data will be deleted from disk.',
    Supprimer: 'Delete',
    Annuler: 'Cancel',
    'Langue téléchargée avec succès': 'Language downloaded successfully',
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
    'Vert clair': 'Light green',
    'Bleu ciel': 'Sky blue',
    Rose: 'Pink',
    Orange: 'Orange',
    Violet: 'Purple',
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
    'Session Google expirée. Veuillez vous reconnecter dans les paramètres de sauvegarde.':
        'Google session expired. Please reconnect in backup settings.',

    // ── Layout ──
    'Chargement des données...': 'Loading data...',
    'Synchronisation en cours...': 'Syncing...',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Select a paragraph',
    'Aucun paragraphe': 'No paragraphs',

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
    'Exporter au format PDF': 'Export to PDF',
    'Exporter en PDF': 'Export to PDF',
    "Erreur lors de l'export PDF": 'Error exporting PDF',
    'PDF exporté avec succès': 'PDF exported successfully',
    'La référence est invalide': 'The reference is invalid',
    'La référence biblique est invalide': 'The biblical reference is invalid',
    'Référence supprimée': 'Reference deleted',
    'Cliquez droit sur une référence pour la supprimer': 'Right-click on a reference to delete it',
    'Référence document: {{label}}': 'Document reference: {{label}}',
    'Référence biblique: {{label}}': 'Biblical reference: {{label}}',
    'Aucune sélection trouvée pour la référence': 'No selection found for the reference',
    'Référence document': 'Document reference',
    'Référence biblique': 'Biblical reference',
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
    'Sélectionnez du texte à souligner': 'Select text to highlight',
    'Ajouter au sujet': 'Add to subject',
    'Ajouter à la note': 'Add to note',
    'Trouver des prédications similaires': 'Find similar sermons',
    'Prédications similaires': 'Similar sermons',
    'Aucune prédication similaire trouvée': 'No similar sermons found',
    Prédication: 'Sermon',
    Document: 'Document',
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
    Automatique: 'Automatic',
    Petit: 'Small',
    Normal: 'Normal',
    Grand: 'Large',
    'Très grand': 'Extra large',
    Clair: 'Light',
    Sombre: 'Dark',
    Système: 'System',
};

export default en;
