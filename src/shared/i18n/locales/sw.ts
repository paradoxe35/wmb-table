const sw: Record<string, string> = {
    // ── Sidebar menu ──
    Historique: 'Historia',
    Recherche: 'Tafuta',
    Sujets: 'Mada',
    Notes: 'Vidokezo',
    Soulignages: 'Maandishi yaliyoangaziwa',
    'Aucun soulignage': 'Hakuna maandishi yaliyoangaziwa',
    'Supprimer ce soulignage ?': 'Futa uangaziaji huu?',
    'Soulignage supprimé': 'Uangaziaji umefutwa',
    'Erreur lors du chargement des soulignages':
        'Hitilafu wakati wa kupakia maandishi yaliyoangaziwa',
    'Charger plus': 'Pakia zaidi',
    Paramètres: 'Mipangilio',

    // ── Viewer menu ──
    Outils: 'Zana',
    Lecture: 'Usomaji',

    // ── Sidebar documents ──
    Prédications: 'Mahubiri',
    Bible: 'Biblia',
    Documents: 'Nyaraka',
    'Aucun document ajouté': 'Hakuna waraka ulioongezwa',
    'Ajouter un document': 'Ongeza waraka',
    'Choisir un document': 'Chagua waraka',
    Gérer: 'Dhibiti',
    Alphabet: 'Alfabeti',
    Année: 'Mwaka',
    Années: 'Miaka',
    'A-Z': 'A-Z',
    'Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.':
        'Miundo inayotumika: PDF, TXT, MD, DOCX, EPUB.',
    "Erreur lors de l'import du document.": 'Hitilafu wakati wa kuingiza waraka.',
    'Format de document non pris en charge.': 'Muundo wa waraka hautumiki.',
    'Le fichier est trop volumineux.': 'Faili ni kubwa mno.',

    // ── Settings index ──
    Général: 'Jumla',
    'Vue document': 'Mwonekano wa waraka',
    Langues: 'Lugha',
    'Lecture audio': 'Usomaji wa sauti',
    Sauvegarde: 'Hifadhi nakala',
    'Mise à jour': 'Sasisho',
    'Gérez les préférences de votre application.': 'Dhibiti mapendeleo ya programu yako.',
    Assistant: 'Msaidizi',
    'Assistant IA': 'Msaidizi wa AI',
    "Activer l'assistant IA": 'Washa msaidizi wa AI',
    "Une fois activé, l'assistant apparaît dans la barre latérale.":
        'Baada ya kuwashwa, msaidizi huonekana kwenye upau wa pembeni.',
    'Clé API': 'Ufunguo wa API',
    'URL de base': 'URL ya msingi',
    Modèle: 'Mfano',
    Identifiant: 'Kitambulisho',
    'Nom affiché': 'Jina linaloonekana',
    Optionnel: 'Hiari',
    'Modèle par défaut': 'Mfano chaguomsingi',
    Recommandé: 'Inapendekezwa',
    Installé: 'Imesakinishwa',
    Nouveau: 'Mpya',

    // ── AI settings ──
    'Choisissez le service à utiliser pour le chat IA.':
        'Chagua huduma ya kutumia kwa mazungumzo ya AI.',
    'Choisir un fournisseur': 'Chagua mtoa huduma',
    Personnalisé: 'Maalum',
    'Comportement des langues': 'Tabia ya lugha',
    "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.":
        'Msaidizi hufuata lugha ya maudhui, isipokuwa ukiombe wazi lugha nyingine.',
    'Suivre la langue active': 'Fuata lugha iliyo hai',
    'Changer uniquement sur demande': 'Badilisha tu unapoombwa',
    "Utilisez l'identifiant exact du modèle fourni par ce service.":
        'Tumia kitambulisho halisi cha mfano kilichotolewa na huduma hii.',

    // ── AI provider descriptions ──
    'Fonctionne sans connexion internet, directement sur votre ordinateur.':
        'Hufanya kazi bila intaneti, moja kwa moja kwenye kompyuta yako.',
    'Accédez à plusieurs modèles avec une seule clé API.':
        'Pata mifano mingi kwa ufunguo mmoja wa API.',
    'ChatGPT et autres modèles OpenAI.': 'ChatGPT na mifano mingine ya OpenAI.',
    'Les modèles Gemini de Google.': 'Mifano ya Gemini ya Google.',
    "Les modèles Claude d'Anthropic.": 'Mifano ya Claude ya Anthropic.',

    // ── AI local models ──
    'Modèle local': 'Mfano wa ndani',
    Actualiser: 'Onyesha upya',
    'Choisir un modèle': 'Chagua mfano',
    Utiliser: 'Tumia',
    'Modèle téléchargé': 'Mfano umepakuliwa',
    'Le téléchargement a échoué.': 'Upakuaji umeshindwa.',
    '~{{size}} Mo': '~{{size}} MB',
    'Léger et rapide. Idéal pour un usage quotidien sur la plupart des ordinateurs.':
        'Mwepesi na wa haraka. Bora kwa matumizi ya kila siku kwenye kompyuta nyingi.',
    'Plus complet, meilleure compréhension. Nécessite un peu plus de mémoire.':
        'Una uwezo zaidi na uelewa bora. Unahitaji kumbukumbu zaidi kidogo.',
    'Fonctionne sans connexion internet, directement sur votre ordinateur. Téléchargez un modèle pour commencer.':
        'Hufanya kazi bila intaneti, moja kwa moja kwenye kompyuta yako. Pakua mfano ili kuanza.',
    'Le mode local est plus limité': 'Hali ya ndani ina mipaka zaidi',
    'Le mode local peut répondre plus lentement et avec moins de précision, surtout pour les questions longues ou difficiles.':
        'Hali ya ndani inaweza kujibu polepole zaidi na kwa usahihi mdogo, hasa kwa maswali marefu au magumu.',
    'Utiliser la carte graphique (GPU)': 'Tumia kadi ya picha (GPU)',
    'Accélère les réponses si votre ordinateur possède une carte graphique compatible. Désactivez cette option en cas de problème.':
        'Huongeza kasi ya majibu ikiwa kompyuta yako ina kadi ya picha inayotumika. Zima chaguo hili ukipata matatizo.',

    // ── AI custom providers ──
    'Ajouter un fournisseur': 'Ongeza mtoa huduma',
    'Ajouter un fournisseur personnalisé': 'Ongeza mtoa huduma maalum',
    'Supprimer ce fournisseur ?': 'Futa mtoa huduma huyu?',
    'Un fournisseur avec ce nom existe déjà.': 'Mtoa huduma mwenye jina hili tayari yupo.',
    'ex: Mon Service IA': 'mf.: Huduma Yangu ya AI',
    'ex: gpt-4o-mini': 'mf.: gpt-4o-mini',
    'Taille du contexte (tokens)': 'Ukubwa wa muktadha (tokeni)',

    // ── AI provider test ──
    'Tester la connexion': 'Pima muunganisho',
    Connecté: 'Imeunganishwa',
    Échec: 'Imeshindwa',
    'La connexion a échoué.': 'Muunganisho umeshindwa.',
    'La clé API est manquante pour ce fournisseur.': 'Ufunguo wa API haupo kwa mtoa huduma huyu.',
    'Fournisseur IA inconnu.': 'Mtoa huduma wa AI hajulikani.',
    'Validation du fournisseur impossible.': 'Haiwezekani kuthibitisha mtoa huduma.',
    'Le mode local nécessite une langue par défaut et un moteur local actif.':
        'Hali ya ndani inahitaji lugha chaguomsingi na injini ya ndani inayofanya kazi.',
    'La synthèse du navigateur est gérée dans le processus renderer.':
        'Usanisi wa sauti wa kivinjari unasimamiwa katika mchakato wa renderer.',
    'La prévisualisation du navigateur est gérée dans le processus renderer.':
        'Muhtasari wa kivinjari unasimamiwa katika mchakato wa renderer.',
    'Fournisseur TTS inconnu.': 'Mtoa huduma wa TTS hajulikani.',
    'Fournisseur TTS introuvable.': 'Mtoa huduma wa TTS hakupatikana.',
    'Ce fournisseur ne prend pas en charge le téléchargement de modèles.':
        'Mtoa huduma huyu hauungi mkono upakuaji wa mifano.',
    'Ce fournisseur ne prend pas en charge la suppression de modèles.':
        'Mtoa huduma huyu hauungi mkono ufutaji wa mifano.',
    'Ce fournisseur ne prend pas en charge le clonage de voix.':
        'Mtoa huduma huyu hauungi mkono uundaji wa nakala ya sauti.',
    'Voix de référence introuvable.': 'Sauti ya rejea haikupatikana.',
    "La clé API OpenAI n'est pas configurée.": 'Ufunguo wa API wa OpenAI haujasanidiwa.',
    "La clé API ElevenLabs n'est pas configurée.": 'Ufunguo wa API wa ElevenLabs haujasanidiwa.',
    "La clé API Cartesia n'est pas configurée.": 'Ufunguo wa API wa Cartesia haujasanidiwa.',
    "Aucune voix Cartesia n'est sélectionnée.": 'Hakuna sauti ya Cartesia iliyochaguliwa.',
    'La langue est requise pour cloner une voix Cartesia.':
        'Lugha inahitajika ili kunakili sauti ya Cartesia.',
    'Le nom du modèle est requis pour le téléchargement Sherpa.':
        'Jina la mfano linahitajika kwa upakuaji wa Sherpa.',
    'Modèle Sherpa inconnu.': 'Mfano wa Sherpa haujulikani.',

    // ── AI errors ──
    "L'assistant IA est désactivé dans les paramètres.":
        'Msaidizi wa AI amezimwa kwenye mipangilio.',
    'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.':
        'Hakuna mtoa huduma wa AI aliyesanidiwa. Chagua mtoa huduma kwenye mipangilio.',
    'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.':
        'Hakuna mfano uliosanidiwa kwa mtoa huduma huyu. Weka mfano kwenye mipangilio.',

    // ── AI chat ──
    "L'assistant IA est désactivé.": 'Msaidizi wa AI amezimwa.',
    'Ouvrir les paramètres': 'Fungua mipangilio',
    'Le saviez-vous ? <u>{{feature}}</u> peut vous aider à explorer un sujet et comprendre plus vite ce que vous cherchez.':
        'Je, unajua? <u>{{feature}}</u> inaweza kukusaidia kuchunguza mada na kuelewa haraka zaidi unachotafuta.',
    'Activez <u>{{feature}}</u> pour poser vos questions, approfondir un thème, comparer plusieurs prédications, retrouver des passages bibliques et obtenir des réponses claires sans tout parcourir manuellement.':
        'Washa <u>{{feature}}</u> ili kuuliza maswali, kuchunguza mada kwa kina, kulinganisha mahubiri mengi, kupata vifungu vya Biblia na kupata majibu wazi bila kupitia kila kitu kwa mkono.',
    "Ouvrir les réglages de l'assistant": 'Fungua mipangilio ya msaidizi',
    'Le saviez-vous ? <u>{{feature}}</u> peut lire vos documents.':
        'Je, unajua? <u>{{feature}}</u> inaweza kusoma nyaraka zako kwa sauti.',
    'Choisissez une voix pour <u>{{feature}}</u>, puis lancez la lecture directement depuis vos documents.':
        'Chagua sauti kwa <u>{{feature}}</u>, kisha anza usomaji moja kwa moja kutoka kwenye nyaraka zako.',
    'Ouvrir les réglages audio': 'Fungua mipangilio ya sauti',
    'Le saviez-vous ? <u>{{feature}}</u> peut protéger vos données.':
        'Je, unajua? <u>{{feature}}</u> inaweza kulinda data zako.',
    'Connectez Google Drive pour que <u>{{feature}}</u> garde vos notes, sujets et réglages synchronisés.':
        'Unganisha Google Drive ili <u>{{feature}}</u> iweke vidokezo, mada na mipangilio yako katika usawazishaji.',
    'Ouvrir les réglages de sauvegarde': 'Fungua mipangilio ya hifadhi nakala',
    'Posez votre question...': 'Uliza swali lako...',
    Envoyer: 'Tuma',
    Arrêter: 'Simamisha',
    Conversations: 'Mazungumzo',
    'Aucune conversation': 'Hakuna mazungumzo',
    'Aucun sujet': 'Hakuna mada',
    'Sélectionner ou saisir un modèle': 'Chagua au andika mfano',
    'Voir le raisonnement': 'Onyesha hoja',
    'Masquer le raisonnement': 'Ficha hoja',
    '{{count}} dernières lignes': 'mistari {{count}} ya mwisho',
    '+{{count}} autre': '+{{count}} nyingine',
    '+{{count}} autres': '+{{count}} nyingine',
    Conversation: 'Mazungumzo',
    maintenant: 'sasa',
    'Supprimer cette conversation ?': 'Futa mazungumzo haya?',
    'Supprimer toutes les conversations ?': 'Futa mazungumzo yote?',
    "Vider l'historique": 'Futa historia',

    // ── AI tool results ──
    'Recherche de sermons': 'Utafutaji wa mahubiri',
    'Lecture du sermon': 'Usomaji wa hubiri',
    'Recherche dans le contenu': 'Utafutaji ndani ya maudhui',
    'Versions de la Bible': 'Matoleo ya Biblia',
    'Passage biblique': 'Kifungu cha Biblia',
    'Liste des sujets': 'Orodha ya mada',
    'Création de sujet': 'Uundaji wa mada',
    'Ajout au sujet': 'Imeongezwa kwenye mada',
    'Liste des notes': 'Orodha ya vidokezo',
    'Lecture de la note': 'Usomaji wa kidokezo',
    'Création de note': 'Uundaji wa kidokezo',
    'Mise à jour de la note': 'Usasishaji wa kidokezo',
    'Ajout à la note': 'Imeongezwa kwenye kidokezo',
    'Recherche biblique': 'Utafutaji wa Biblia',
    'Recherche approfondie': 'Utafiti wa kina',
    'Langues disponibles': 'Lugha zinazopatikana',
    'Documents personnalisés': 'Nyaraka maalum',
    'Lecture du document': 'Usomaji wa waraka',

    // ── General tab ──
    'Langue active': 'lugha ya maudhui',
    'Langue des prédications': 'Lugha ya mahubiri',
    Bibliothèque: 'Maktaba',
    'Langues installées': 'Lugha zilizosakinishwa',
    "Documentation d'utilisation": 'Nyaraka za mtumiaji',
    "Impossible d'ouvrir la documentation": 'Haiwezekani kufungua nyaraka',
    Actif: 'Inatumika',
    'En pause': 'Imesitishwa',
    'Non connecté': 'Haijaunganishwa',
    'À jour': 'Imesasishwa',
    Ouvrir: 'Fungua',

    // ── Library tab ──
    'Changer la langue': 'Badilisha lugha',
    'Gérer la bibliothèque': 'Dhibiti maktaba',
    'Aucune langue installée': 'Hakuna lugha iliyosakinishwa',
    'Bibliothèque vide': 'Maktaba tupu',

    // ── TTS tab ──
    'Fournisseur actif': 'Mtoa huduma anayefanya kazi',
    'Le service qui lira le texte à voix haute.': 'Huduma itakayosoma maandishi kwa sauti.',
    'Changer la voix automatiquement': 'Badilisha sauti kiotomatiki',
    'Choisir automatiquement une voix adaptée à la langue du document.':
        'Chagua kiotomatiki sauti inayolingana na lugha ya waraka.',
    'Mode de surlignage': 'Hali ya uangaziaji',
    'Choisissez comment le texte est mis en évidence pendant la lecture.':
        'Chagua jinsi maandishi yataangaziwa wakati wa usomaji.',
    Phrase: 'Sentensi',
    Paragraphe: 'Aya',
    'Vitesse de lecture: {{rate}}x': 'Kasi ya usomaji: {{rate}}x',
    'Pause entre les segments: {{gap}}s': 'Pumziko kati ya sehemu: {{gap}}s',
    'Durée de la pause entre chaque phrase ou paragraphe lu.':
        'Muda wa pumziko kati ya kila sentensi au aya inayosomwa.',
    'Cache audio': 'Akiba ya sauti',
    'Les lectures passées sont conservées pour une relecture plus rapide.':
        'Usomaji wa awali huwekwa akibani kwa urejeshaji wa haraka zaidi.',
    Utilisé: 'Imetumika',
    Limite: 'Kikomo',
    Vider: 'Futa',
    'Cache audio vidé': 'Akiba ya sauti imefutwa',
    'Vider le cache audio ?': 'Futa akiba ya sauti?',
    'Toutes les lectures en mémoire seront supprimées.': 'Usomaji wote uliowekwa akibani utafutwa.',
    'Taille maximale du cache': 'Ukubwa wa juu wa akiba',

    // ── TTS enhanced reading ──
    'Lecture améliorée': 'Usomaji ulioboreshwa',
    "Lire l'introduction": 'Soma utangulizi',
    'Annonce le titre, la date et le lieu avant de commencer la lecture.':
        'Hutangaza kichwa, tarehe na mahali kabla ya kuanza kusoma.',
    'Annoncer les numéros': 'Tangaza namba',
    'Annonce le numéro du verset ou du paragraphe avant de le lire.':
        'Hutangaza namba ya mstari au aya kabla ya kuisoma.',
    'Lire tout le livre (Bible)': 'Soma kitabu chote (Biblia)',
    'Continue automatiquement au chapitre suivant après avoir terminé.':
        'Huendelea kiotomatiki kwenye sura inayofuata baada ya kumaliza.',
    'Défiler automatiquement': 'Telezesha kiotomatiki',
    'Fait défiler la page pour toujours voir le texte en cours de lecture.':
        'Huteleza ukurasa ili maandishi yanayosomwa yaendelee kuonekana.',

    // ── TTS shared ──
    'Voix du système': 'Sauti za mfumo',
    'Sherpa-ONNX TTS': 'Sherpa-ONNX TTS',
    'Kokoro TTS': 'Kokoro TTS',
    'ElevenLabs TTS': 'ElevenLabs TTS',
    'OpenAI TTS': 'OpenAI TTS',
    'Edge TTS (Microsoft)': 'Edge TTS (Microsoft)',
    'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.':
        'Bure, hufanya kazi bila intaneti. Hutumia sauti ambazo tayari zimesakinishwa kwenye kompyuta yako.',
    'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.':
        'Bure, hufanya kazi bila intaneti. Inasaidia lugha na sauti nyingi. Inahitaji upakuaji wa kwanza.',
    'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.':
        'Bure, hufanya kazi bila intaneti. Ubora mzuri, inahitaji upakuaji wa kwanza.',
    'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.':
        'Ubora bora sana. Huruhusu kunakili sauti yako. Inahitaji akaunti na intaneti.',
    'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.':
        'Ubora bora sana, lugha nyingi zinapatikana. Inahitaji akaunti na intaneti.',
    'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.':
        'Bure, ubora mzuri, lugha nyingi. Inahitaji intaneti. Hakuna akaunti inayohitajika.',
    Gratuit: 'Bure',
    Local: 'Ndani',
    Cloud: 'Wingu',
    o: 'B',
    Ko: 'KB',
    Mo: 'MB',

    // ── TTS provider browser ──
    Voix: 'Sauti',
    Volume: 'Sauti',
    Version: 'Toleo',
    'Tester la voix': 'Pima sauti',
    'Les voix disponibles dépendent de celles installées sur votre ordinateur.':
        'Sauti zinazopatikana hutegemea zile zilizosakinishwa kwenye kompyuta yako.',
    'Voix par défaut du système': 'Sauti chaguomsingi ya mfumo',
    'Hauteur: {{value}}': 'Toni: {{value}}',
    'Ajuste la tonalité de la voix.': 'Hurekebisha toni ya sauti.',
    'Volume: {{value}}%': 'Kiasi cha sauti: {{value}}%',

    // ── TTS provider Kokoro ──
    'À télécharger une seule fois. Environ 160 Mo.': 'Pakua mara moja tu. Takribani MB 160.',
    'Télécharger le modèle': 'Pakua mfano',
    'Toutes les voix sont disponibles. La voix par défaut correspond à la langue active.':
        'Sauti zote zinapatikana. Sauti chaguomsingi inalingana na lugha ya maudhui.',
    'Modèle Kokoro téléchargé': 'Mfano wa Kokoro umepakuliwa',
    'Erreur: {{error}}': 'Hitilafu: {{error}}',
    'Erreur lors de la prévisualisation de la voix': 'Hitilafu wakati wa kusikiliza sauti kabla',
    "Impossible d'enregistrer les paramètres de Lecture audio.":
        'Haiwezekani kuhifadhi mipangilio ya usomaji wa sauti.',

    // ── TTS provider Sherpa ──
    'Voix disponible — {{lang}}': 'Sauti inapatikana — {{lang}}',
    'Téléchargez une voix pour la langue active du document.':
        'Pakua sauti kwa lugha inayotumika ya waraka.',
    'Télécharger « {{name}} »': 'Pakua "{{name}}"',
    'Voix active': 'Sauti inayotumika',
    'Voix installées ({{count}})': 'Sauti zilizosakinishwa ({{count}})',
    'Ajouter une autre langue': 'Ongeza lugha nyingine',
    'Recherchez une langue ou un nom de voix.': 'Tafuta lugha au jina la sauti.',
    'Ex: arabe, portugais, swahili…': 'Mf.: Kiarabu, Kireno, Kiswahili…',
    'Aucun résultat': 'Hakuna matokeo',
    'Voix installée': 'Sauti imesakinishwa',
    'Voix supprimée': 'Sauti imeondolewa',
    Télécharger: 'Pakua',
    Téléchargement: 'Inapakua',
    Extraction: 'Inatoa',
    Finalisation: 'Inakamilisha',
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'Hakuna sauti inayopatikana kwa lugha inayotumika. Tumia utafutaji hapo juu kupata sauti katika lugha nyingine.',
    // quality tags
    'Haute qualité': 'Ubora wa juu',
    'Qualité moyenne': 'Ubora wa kati',
    'Qualité légère': 'Ubora mwepesi',
    Multilingue: 'Lugha nyingi',

    // ── TTS provider ElevenLabs ──
    'Clé API ElevenLabs': 'Ufunguo wa API wa ElevenLabs',
    'Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Ufunguo wako wa siri wa ElevenLabs. Umehifadhiwa kwa usalama kwenye kompyuta yako.',
    'Les voix marquées « cloné » sont vos voix personnalisées.':
        'Sauti zilizoandikwa "zilizonakiliwa" ni sauti zako maalum.',
    'Le choix par défaut convient pour la plupart des usages.':
        'Chaguo chaguomsingi linafaa kwa matumizi mengi.',
    'Paramètres avancés': 'Mipangilio ya juu',
    'Voix clonées': 'Sauti zilizonakiliwa',
    'Vos voix personnalisées.': 'Sauti zako maalum.',
    'Cloner une voix': 'Nakili sauti',
    'Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix.':
        'Rekodi sauti ya WAV au MP3 ya sekunde 10 hadi 60 ili kuunda sauti yako mwenyewe.',
    'Nom de la voix (ex: MaVoix)': 'Jina la sauti (mf.: SautiYangu)',
    'Choisir un fichier audio': 'Chagua faili ya sauti',
    Cloner: 'Nakili',
    'Voix clonée avec succès': 'Sauti imenakiliwa kwa mafanikio',
    'Voix clonée supprimée': 'Sauti iliyonakiliwa imefutwa',
    'Voix de référence': 'Sauti za rejea',
    'Voix intégrées pour le clonage vocal. Clonez-les pour les utiliser.':
        'Sauti zilizojengewa ndani kwa kunakili sauti. Zinakili ili uzitumie.',
    Cloné: 'Imenakiliwa',
    'Erreur lors de la lecture': 'Hitilafu ya uchezaji',

    // ── TTS provider Edge ──
    'Sélectionnez une voix parmi les centaines disponibles, classées par langue.':
        'Chagua sauti moja kati ya mamia yanayopatikana, yaliyopangwa kwa lugha.',

    // ── TTS provider OpenAI ──
    'Clé API OpenAI': 'Ufunguo wa API wa OpenAI',
    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Ufunguo wako wa siri wa OpenAI. Umehifadhiwa kwa usalama kwenye kompyuta yako.',
    'Le choix par défaut offre la meilleure qualité.':
        'Chaguo chaguomsingi hutoa ubora bora zaidi.',
    'Marin et Cedar sont recommandées pour la meilleure qualité.':
        'Marin na Cedar yanapendekezwa kwa ubora bora zaidi.',

    // ── TTS provider Cartesia ──
    'Cartesia TTS': 'Cartesia TTS',
    'Clé API Cartesia': 'Ufunguo wa API wa Cartesia',
    'Votre clé secrète Cartesia. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Ufunguo wako wa siri wa Cartesia. Umehifadhiwa kwa usalama kwenye kompyuta yako.',
    'Langue de la voix': 'Lugha ya sauti',
    "Sélectionnez la langue dans laquelle la voix clonée s'exprimera.":
        'Chagua lugha ambayo sauti iliyonakiliwa itatumia kuzungumza.',
    'Sélectionnez une voix': 'Chagua sauti',
    'Obtenir une clé API': 'Pata ufunguo wa API',

    // ── TTS controls ──
    'Pause lecture': 'Sitisha usomaji',
    'Reprendre la lecture': 'Endelea na usomaji',
    'Démarrer la lecture': 'Anza usomaji',
    'Lire à voix haute': 'Soma kwa sauti',
    'Pause voix': 'Sitisha sauti',
    'Reprendre la voix': 'Endelea na sauti',
    'Lecture audio indisponible': 'Usomaji wa sauti haupatikani',
    'Zoom arrière': 'Punguza ukubwa',
    'Zoom avant': 'Ongeza ukubwa',
    "Lire à partir d'ici": 'Soma kuanzia hapa',
    'Aucune voix disponible pour cette langue.': 'Hakuna sauti inayopatikana kwa lugha hii.',

    // ── TTS compatibility messages ──
    "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres de Lecture audio.":
        'Mtoa huduma huyu hajasetiwa. Ongeza ufunguo wa API kwenye mipangilio ya usomaji wa sauti.',
    "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres de Lecture audio.":
        'Mfano wa sauti haujapakuliwa. Pakua kwenye mipangilio ya usomaji wa sauti.',
    'Le modèle sélectionné ne prend pas en charge cette langue. Changez de modèle dans les paramètres de Lecture audio.':
        'Mfano uliochaguliwa hauungi mkono lugha hii. Badilisha mfano kwenye mipangilio ya usomaji wa sauti.',
    'Ce fournisseur ne prend pas en charge cette langue.':
        'Mtoa huduma huyu hauungi mkono lugha hii.',
    'Ce fournisseur ne peut pas lire cette langue.': 'Mtoa huduma huyu hawezi kusoma lugha hii.',
    'Le navigateur ne dispose pas de voix pour cette langue.':
        'Kivinjari hakina sauti kwa lugha hii.',
    'La langue du document ne correspond pas à la langue active. Changez la langue dans les paramètres.':
        'Lugha ya waraka hailingani na lugha inayotumika. Badilisha lugha kwenye mipangilio.',
    'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.':
        'Lugha ya waraka hailingani na lugha inayotumika ({{language}}). Badilisha lugha kwenye mipangilio.',
    'Impossible de vérifier la compatibilité du fournisseur.':
        'Haiwezekani kuthibitisha uoanifu wa mtoa huduma.',
    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.':
        'Usomaji wa sauti umeshindwa. Angalia usanidi wa mtoa huduma.',

    // ── History ──
    'Aucune historique': 'Hakuna historia',

    // ── Search ──
    'Votre recherche doit comporter au moins trois caractères':
        'Utafutaji wako lazima uwe na angalau herufi tatu',
    'Erreur lors de la recherche': 'Hitilafu wakati wa kutafuta',

    // ── Subject ──
    'Créer un sujet': 'Unda mada',
    'Nom sujet': 'Jina la mada',
    Enregistrer: 'Hifadhi',
    'Erreur lors du chargement des sujets': 'Hitilafu wakati wa kupakia mada',
    'Erreur lors du chargement des éléments du sujet':
        'Hitilafu wakati wa kupakia vipengele vya mada',
    'Erreur lors de la réorganisation des références':
        'Hitilafu wakati wa kupanga upya marejeo ya mada',
    'Sujet créé': 'Mada imeundwa',
    'Un sujet avec ce nom existe déjà.': 'Mada yenye jina hili tayari ipo.',
    'Sujet introuvable': 'Mada haikupatikana',
    'Renommer le sujet': 'Badili jina la mada',
    'Sujet renommé': 'Mada imebadiliwa jina',
    Supprimé: 'Imefutwa',
    'Aucune référence trouvée dans le sujet: {{name}}':
        'Hakuna rejeo lililopatikana kwenye mada: {{name}}',

    // ── Backup tab ──
    'Connectez-vous avec Google pour sauvegarder vos données sur Google Drive.':
        'Ingia kwa Google ili kuhifadhi data zako kwenye Google Drive.',
    'Vos données seront restaurées automatiquement lors de la connexion.':
        'Data zako zitarejeshwa kiotomatiki unapoingia.',
    'Connexion Google': 'Kuingia kwa Google',
    'Synchronisation automatique': 'Usawazishaji wa kiotomatiki',
    'Dernière synchronisation : {{time}}': 'Usawazishaji wa mwisho: {{time}}',
    'Accès limité': 'Ufikiaji mdogo',
    "Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront.":
        'Ingia tena na uhakikishe umeruhusu ufikiaji unaohitajika kwa kuweka alama kwenye visanduku vitakavyoonekana.',
    'Erreur de synchronisation': 'Hitilafu ya usawazishaji',
    'Connexion réussie. Synchronisation en arrière-plan...':
        'Muunganisho umefaulu. Inasawazisha chinichini...',
    "Une erreur s'est produite lors de la connexion, réessayez plus tard":
        'Hitilafu imetokea wakati wa kuingia, jaribu tena baadaye',
    "Connexion refusée : vous devez autoriser tous les accès demandés. Reconnectez-vous et cochez toutes les cases d'autorisation.":
        'Muunganisho umekataliwa: lazima uidhinishe ufikiaji wote unaohitajika. Unganisha tena na uweke alama kwenye visanduku vyote vya idhini.',
    'Synchronisation activée': 'Usawazishaji umewashwa',
    Déconnexion: 'Toka',
    'Se déconnecter de Google ?': 'Toka kwenye Google?',
    'La synchronisation sera arrêtée et les données de connexion supprimées.':
        'Usawazishaji utasimamishwa na data ya kuingia itafutwa.',
    'Vos données locales seront conservées.': 'Data zako za ndani zitaendelea kuwepo.',
    'Déconnexion réussie': 'Umetoka kwa mafanikio',
    "Une erreur s'est produite lors de la déconnexion, réessayez plus tard":
        'Hitilafu imetokea wakati wa kutoka, jaribu tena baadaye',
    'Vous êtes connecté maintenant et pouvez fermer cette page.':
        'Sasa umeunganishwa na unaweza kufunga ukurasa huu.',
    "L'autorisation a échoué. Veuillez réessayer depuis l'application.":
        'Uidhinishaji umeshindwa. Tafadhali jaribu tena kutoka kwenye programu.',
    'Début de la récupération des données': 'Kuanza kurejesha data',
    'Préparation de la restauration des données': 'Kuandaa urejeshaji wa data',
    "Une erreur s'est produite lors de la restauration, veuillez réessayer plus tard":
        'Hitilafu imetokea wakati wa urejeshaji, tafadhali jaribu tena baadaye',
    'Vos données ont été restaurées avec succès.': 'Data zako zimerejeshwa kwa mafanikio.',
    "Redémarrer l'application": 'Anzisha upya programu',
    Restauration: 'Urejeshaji',
    'de données': 'wa data',

    // ── Update tab ──
    "Mise à jour de l'application": 'Sasisho la programu',
    'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.':
        'Toleo jipya linapatikana. Bofya kitufe kilicho hapa chini ili kuanza mchakato wa kusasisha.',
    'Téléchargement de la mise à jour': 'Inapakua sasisho',
    'Téléchargement terminé': 'Upakuaji umekamilika',
    "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.":
        'Tafadhali bofya kitufe cha usakinishaji hapa chini ili kusakinisha sasisho.',
    'Erreur !': 'Hitilafu!',
    "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.":
        'Hitilafu imetokea wakati wa kusasisha, tafadhali jaribu tena baadaye.',
    'Aucune mise à jour disponible': 'Hakuna sasisho linalopatikana',
    "Vous utilisez déjà la dernière version de l'application.":
        'Tayari unatumia toleo la hivi karibuni la programu.',
    Vérifier: 'Angalia',
    'Vérification des mises à jour...': 'Inaangalia masasisho...',
    'Mettre à jour': 'Sasisha',
    'Installer la mise à jour': 'Sakinisha sasisho',
    'Mise à jour disponible': 'Sasisho linapatikana',
    'La version {{version}} est disponible.': 'Toleo {{version}} linapatikana.',
    'Une nouvelle version est disponible.': 'Toleo jipya linapatikana.',
    'Voir la mise à jour': 'Tazama sasisho',
    'Mise à jour prête': 'Sasisho liko tayari',
    "La mise à jour a été téléchargée. Elle sera installée au prochain redémarrage, ou vous pouvez l'installer maintenant.":
        'Sasisho limepakuliwa. Litasakinishwa kwenye kuwasha upya ijayo, au unaweza kulisakinisha sasa.',
    'Redémarrer et installer': 'Anzisha upya na usakinishe',

    // ── Language manager modal ──
    'Supprimer cette langue ?': 'Futa lugha hii?',
    'Les données de cette langue seront supprimées du disque.':
        'Data ya lugha hii itafutwa kutoka kwenye diski.',
    Supprimer: 'Futa',
    Annuler: 'Ghairi',
    'Langue téléchargée avec succès': 'Lugha imepakuliwa kwa mafanikio',
    'Langue mise à jour avec succès': 'Lugha imesasishwa kwa mafanikio',
    'Téléchargez une langue pour commencer': 'Pakua lugha ili kuanza',
    'Rechercher une langue...': 'Tafuta lugha...',
    'Aucune langue trouvée': 'Hakuna lugha iliyopatikana',
    'Mes langues': 'Lugha zangu',
    Disponibles: 'Zinazopatikana',
    'Échec de la sélection de la langue': 'Imeshindwa kuchagua lugha',
    'Langue supprimée': 'Lugha imefutwa',

    // ── Custom documents modal ──
    'Documents ajoutés': 'Nyaraka zilizoongezwa',
    'Erreur lors du chargement des documents': 'Hitilafu wakati wa kupakia nyaraka',
    'Rechercher...': 'Tafuta...',
    Ajouter: 'Ongeza',
    'Nom du document': 'Jina la waraka',
    'Ce nom existe déjà': 'Jina hili tayari lipo',
    'Seul le format PDF est pris en charge.': 'Muundo wa PDF tu ndio unaotumika.',
    'Un document avec ce nom existe déjà.': 'Waraka wenye jina hili tayari upo.',
    'Choisir un fichier PDF': 'Chagua faili ya PDF',
    'Document supprimé': 'Waraka umefutwa',
    'Langue du document': 'Lugha ya waraka',
    'Langue modifiée': 'Lugha imebadilishwa',
    'Traitement...': 'Inachakata...',
    Retour: 'Rudi',
    "Erreur lors de l'extraction du document.": 'Hitilafu wakati wa kutoa waraka.',
    'Document ajouté': 'Waraka umeongezwa',

    // ── Highlight modal ──
    Souligner: 'Angazia',
    Couleur: 'Rangi',
    Jaune: 'Njano',
    'Vert clair': 'Kijani hafifu',
    'Bleu ciel': 'Bluu ya anga',
    Rose: 'Waridi',
    Orange: 'Machungwa',
    Violet: 'Zambarau',
    Menthe: 'Mnanaa',
    Pêche: 'Pichi',
    Lavande: 'Lavenda',
    Corail: 'Matumbawe',
    Cyan: 'Samawati',
    Lime: 'Limau',
    Commentaire: 'Maoni',
    'Ajouter un commentaire (optionnel)': 'Ongeza maoni (hiari)',
    'Surlignage enregistré': 'Uangaziaji umehifadhiwa',
    "Erreur lors de l'enregistrement": 'Hitilafu wakati wa kuhifadhi',

    // ── Document audio player ──
    'Langue: {{name}}': 'Lugha: {{name}}',

    // ── Bible version selector ──
    'Version:': 'Toleo:',
    'Télécharger {{name}}': 'Pakua {{name}}',

    // ── Delete button ──
    'Confirmer la suppression?': 'Thibitisha kufuta?',
    Oui: 'Ndiyo',
    Non: 'Hapana',

    // ── Note references modal ──
    'Lier ce paragraphe à une référence de la note :': 'Unganisha aya hii na rejeo la kidokezo:',
    "Aucune note n'est actuellement sélectionnée": 'Hakuna kidokezo kilichochaguliwa kwa sasa',
    'Aucune référence disponible': 'Hakuna rejeo linalopatikana',
    'Lié à : {{title}}': 'Imeunganishwa na: {{title}}',
    'Aucun document attribué': 'Hakuna waraka uliowekwa',
    'Ajouter à cette référence': 'Ongeza kwenye rejeo hili',
    'Ajouté à la note': 'Imeongezwa kwenye kidokezo',
    "Erreur lors de l'ajout à la note": 'Hitilafu wakati wa kuongeza kwenye kidokezo',

    // ── Other traductions modal ──
    'Traductions du document: {{title}}': 'Tafsiri za waraka: {{title}}',
    'Sources de traduction': 'Vyanzo vya tafsiri',
    'Traduction {{id}}': 'Tafsiri {{id}}',
    'Basculer vers cette traduction': 'Badilisha hadi tafsiri hii',
    'Autres langues': 'Lugha nyingine',
    'Langue: {{code}}': 'Lugha: {{code}}',
    'Ouvrir le document': 'Fungua waraka',
    'Aucune autre traduction disponible': 'Hakuna tafsiri nyingine inayopatikana',

    // ── Subject select modal ──
    'Choiser un sujet': 'Chagua mada',
    'Choisir un sujet': 'Chagua mada',
    'Ajouté au sujet': 'Imeongezwa kwenye mada',
    "Erreur lors de l'ajout au sujet": 'Hitilafu wakati wa kuongeza kwenye mada',

    // ── Document tabs ──
    'Fermer tous les onglets': 'Funga vichupo vyote',
    'Voulez-vous vraiment fermer tous les onglets ?': 'Je, kweli unataka kufunga vichupo vyote?',
    'Tout fermer': 'Funga vyote',
    Fermer: 'Funga',
    'Fermer les autres': 'Funga vingine',
    'Fermer à droite': 'Funga vilivyo kulia',

    // ── Sync listener ──
    'Session Google expirée. Le compte a été déconnecté. Reconnectez-vous dans les paramètres de sauvegarde.':
        'Kikao cha Google kimeisha muda wake. Akaunti imetenganishwa. Tafadhali unganisha tena katika mipangilio ya hifadhi nakala.',

    // ── Layout ──
    'Chargement des données...': 'Inapakia data...',
    'Synchronisation en cours...': 'Inasawazisha...',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Chagua aya',
    'Aucun paragraphe': 'Hakuna aya',
    'Sélectionnez un verset': 'Chagua mstari',
    'Aucun verset': 'Hakuna mistari',

    // ── Sermon paragraph ──
    'Surlignage supprimé': 'Uangaziaji umefutwa',
    'Erreur lors de la suppression': 'Hitilafu wakati wa kufuta',
    'Supprimer le surlignage': 'Futa uangaziaji',

    // ── Sermon header ──
    Pause: 'Sitisha',
    Écouter: 'Sikiliza',
    "Écouter l'audio": 'Sikiliza sauti',
    'Pause audio': 'Sitisha sauti',
    Traductions: 'Tafsiri',
    Rechercher: 'Tafuta',

    // ── Bible document view ──
    'Chapitre {{chapter}}': 'Sura {{chapter}}',
    'Chapitre précédent': 'Sura iliyotangulia',
    'Chapitre suivant': 'Sura inayofuata',

    // ── Search result list ──
    'Trouvé dans {{count}} document': 'Imepatikana katika waraka {{count}}',
    'Trouvé dans {{count}} documents': 'Imepatikana katika nyaraka {{count}}',
    'page ({{current}}/{{total}})': 'ukurasa ({{current}}/{{total}})',
    'Aucun résultat trouvé': 'Hakuna matokeo yaliyopatikana',

    // ── Bible search ──
    'Tous les testaments': 'Agano zote',
    'Nouveau Testament': 'Agano Jipya',
    'Ancien Testament': 'Agano la Kale',
    'Faites vos recherches biblique ici': 'Tafuta Biblia hapa',
    Testaments: 'Agano',
    'Trouvé dans {{count}} verset': 'Imepatikana katika mstari {{count}}',
    'Trouvé dans {{count}} versets': 'Imepatikana katika mistari {{count}}',

    // ── Bible content ──
    'Aucune Bible disponible pour cette langue': 'Hakuna Biblia inayopatikana kwa lugha hii',
    'Aucune version biblique active disponible.':
        'Hakuna toleo la Biblia linalotumika linalopatikana.',
    Ancien: 'Kale',
    Testament: 'Agano',
    'Ajouter à un sujet': 'Ongeza kwenye mada',

    // ── Notes ──
    'Erreur lors du chargement des notes': 'Hitilafu wakati wa kupakia vidokezo',
    'Note supprimée': 'Kidokezo kimefutwa',
    'Note introuvable ou vide': 'Kidokezo hakikupatikana au kiko tupu',
    'Aucun modèle Sherpa-ONNX installé': 'Hakuna mfano wa Sherpa-ONNX uliosakinishwa',
    'Aucun modèle local GGUF trouvé dans ~/.wmb-table/ai-models.':
        'Hakuna mfano wa ndani wa GGUF uliopatikana katika ~/.wmb-table/ai-models.',
    'Le modèle local n\u2019est pas chargé.': 'Mfano wa ndani haujapakiwa.',
    'Erreur lors de la création de la note': 'Hitilafu wakati wa kuunda kidokezo',
    'Nouvelle note': 'Kidokezo kipya',
    'Aucune note': 'Hakuna vidokezo',

    // ── Inline search bar ──
    'Aller au paragraphe': 'Nenda kwenye aya',

    // ── Langue label ──
    'Langue:': 'Lugha:',

    // ── Sermon content header ──
    'Date:': 'Tarehe:',
    'Traduction:': 'Tafsiri:',

    // ── Search input ──
    'Au moins un mot': 'Angalau neno moja',
    'Tous les mots': 'Maneno yote',
    'Phrase exacte': 'Kifungu halisi',
    'Faites vos recherches ici': 'Tafuta hapa',

    // ── Search result item ──
    '{{count}} correspondance': 'mfanano {{count}}',
    '{{count}} correspondances': 'mifanano {{count}}',
    'Voir moins': 'Ona kidogo',
    'Voir tout ({{count}})': 'Ona yote ({{count}})',

    // ── Editor ──
    'Le nom entré est invalid': 'Jina lililoingizwa si sahihi',
    Modifié: 'Imerekebishwa',
    Enregistré: 'Imehifadhiwa',
    Alerte: 'Tahadhari',
    "Semble que votre note n'a pas de contenu, si vous continuez cette note sera inconsidérée et elle sera supprimée":
        'Inaonekana kidokezo chako hakina maudhui; ukiendelea, kidokezo hiki kitapuzwa na kitafutwa',
    Continuer: 'Endelea',
    'Activer le mode lecture': 'Washa hali ya kusoma',
    'Désactiver le mode lecture': 'Zima hali ya kusoma',
    'Exporter au format PDF': 'Hamisha kama PDF',
    'Exporter en PDF': 'Hamisha kama PDF',
    "Erreur lors de l'export PDF": 'Hitilafu wakati wa kuhamisha PDF',
    'PDF exporté avec succès': 'PDF imehamishwa kwa mafanikio',
    'La référence est invalide': 'Rejeo si sahihi',
    'La référence biblique est invalide': 'Rejeo la Biblia si sahihi',
    'Référence supprimée': 'Rejeo limefutwa',
    'Cliquez droit sur une référence pour la supprimer': 'Bofya kulia kwenye rejeo ili kulifuta',
    'Référence document: {{label}}': 'Rejeo la waraka: {{label}}',
    'Référence biblique: {{label}}': 'Rejeo la Biblia: {{label}}',
    'Aucune sélection trouvée pour la référence': 'Hakuna chaguo lililopatikana kwa rejeo',
    'Référence document': 'Rejeo la waraka',
    'Référence biblique': 'Rejeo la Biblia',
    'Supprimer la référence': 'Futa rejeo',
    Français: 'Kifaransa',
    English: 'Kiingereza',

    // ── References modal ──
    'Référence: {{label}}': 'Rejeo: {{label}}',
    "Aucun document n'a été attribué pour cette référence":
        'Hakuna waraka uliowekwa kwa rejeo hili',
    'Verset supprimé': 'Mstari umefutwa',
    'Le verset cliqué existe déjà dans la références !':
        'Mstari uliobofywa tayari upo kwenye marejeo!',
    'Verset ajouté': 'Mstari umeongezwa',
    'Aucun verset sélectionné': 'Hakuna mstari uliochaguliwa',
    'Ajouter des versets': 'Ongeza mistari',

    // ── Error boundary ──
    "Une erreur inattendue s'est produite": 'Hitilafu isiyotarajiwa imetokea',
    "Recharger l'application": 'Pakia tena programu',

    // ── Native menu ──
    '&Fichier': '&Faili',
    '&Fermer': '&Toka',
    Éditer: 'Hariri',
    Défaire: 'Tendua',
    Refaire: 'Rudia',
    Couper: 'Kata',
    Copier: 'Nakili',
    Coller: 'Bandika',
    'Tout sélectionner': 'Chagua yote',
    '&Vue': '&Mwonekano',
    'Basculer la barre latérale': 'Badilisha upau wa pembeni',
    'Changer de menu': 'Badilisha menyu',
    "Changer d'option": 'Badilisha chaguo',
    'Mode lecture': 'Hali ya kusoma',
    'Quitter le mode lecture': 'Toka kwenye hali ya kusoma',
    'Basculer en plein écran': 'Badilisha skrini nzima',
    Aide: 'Msaada',
    Documentation: 'Nyaraka',
    'Nous contacter': 'Wasiliana nasi',
    'À propos': 'Kuhusu',
    Produit: 'Bidhaa',
    'Site web': 'Tovuti',
    Auteur: 'Mwandishi',
    Licence: 'Leseni',
    "Aujourd'hui": 'Leo',
    'Aucun document consulté ce jour': 'Hakuna waraka uliofunguliwa leo',
    Renommer: 'Badili jina',
    Traduction: 'Tafsiri',
    'Texte copié': 'Maandishi yamenakiliwa',
    'Sélectionnez du texte à souligner': 'Chagua maandishi ya kuangazia',
    'Ajouter au sujet': 'Ongeza kwenye mada',
    'Ajouter à la note': 'Ongeza kwenye kidokezo',
    'Trouver des prédications similaires': 'Pata mahubiri yanayofanana',
    'Prédications similaires': 'Mahubiri yanayofanana',
    'Aucune prédication similaire trouvée': 'Hakuna mahubiri yanayofanana yaliyopatikana',
    Prédication: 'Hubiri',
    Document: 'Waraka',
    Référence: 'Rejeo',
    'Sauvegarde de données': 'Inahifadhi data',
    'Restauration de données': 'Inarejesha data',

    // ── General ──
    sermons: 'mahubiri',
    disponible: 'inapatikana',
    "Erreur lors de l'initialisation de l'application": 'Hitilafu wakati wa kuanzisha programu',
    'Une erreur inattendue est survenue.': 'Hitilafu isiyotarajiwa imetokea.',
    'Mémoriser la position de lecture': 'Kumbuka mahali pa kusoma',
    "Rouvrez un document là où vous l'aviez laissé la dernière fois.":
        'Fungua tena waraka pale ulipoishia mara ya mwisho.',
    "Impossible d'enregistrer le paramètre": 'Haiwezekani kuhifadhi mpangilio',
    "Nombre maximum d'onglets": 'Idadi ya juu ya vichupo',
    'Les onglets les plus anciens seront fermés automatiquement lorsque la limite est atteinte ({{min}}-{{max}}).':
        'Vichupo vya zamani zaidi vitafungwa kiotomatiki kikomo kinapofikiwa ({{min}}-{{max}}).',
    chapitres: 'sura',
    chapitre: 'sura',

    // ── Welcome ──
    Commencer: 'Anza',
    'Bienvenue dans Wmb Table': 'Karibu kwenye Wmb Table',
    'Votre espace pour lire, étudier et préparer vos prédications.':
        'Nafasi yako ya kusoma, kujifunza na kuandaa mahubiri yako.',
    'Prédications et Bible': 'Mahubiri na Biblia',
    'Ouvrez les prédications et la Bible dans des onglets, naviguez par paragraphe.':
        'Fungua mahubiri na Biblia katika vichupo, na usogee kwa aya.',
    'Prenez des notes, classez vos passages par sujets avec des références.':
        'Andika vidokezo, panga vifungu vyako kwa mada pamoja na marejeo.',
    'Recherche complète': 'Utafutaji kamili',
    'Recherchez dans le contenu des prédications, la Bible et vos documents.':
        'Tafuta ndani ya maudhui ya mahubiri, Biblia na nyaraka zako.',
    'Surlignez les passages importants avec des couleurs et retrouvez-les facilement.':
        'Angazia vifungu muhimu kwa rangi na uvipate kwa urahisi.',
    'Écoutez les prédications avec plusieurs voix disponibles.':
        'Sikiliza mahubiri kwa sauti nyingi zinazopatikana.',
    'Posez des questions et obtenez des réponses avec des références cliquables.':
        'Uliza maswali na upate majibu yenye marejeo yanayobofyeka.',

    // ── Theme ──
    Apparence: 'Mwonekano',
    'Taille du texte': 'Ukubwa wa maandishi',
    "Langue de l'interface": 'Lugha ya kiolesura',
    "Détermine la langue des menus, boutons et messages de l'application.":
        'Hudhibiti lugha ya menyu, vitufe na ujumbe katika programu.',
    Automatique: 'Kiotomatiki',
    Petit: 'Ndogo',
    Normal: 'Kawaida',
    Grand: 'Kubwa',
    'Très grand': 'Kubwa sana',
    Clair: 'Angavu',
    Sombre: 'Giza',
    Système: 'Mfumo',
    'Utilise le thème clair en journée et le thème sombre le soir.':
        'Hutumia mandhari angavu mchana na mandhari ya giza jioni.',
    "Suit automatiquement l'apparence définie par votre système.":
        'Hufuata kiotomatiki mwonekano uliowekwa na mfumo wako.',
    'Utilise toujours le thème clair.': 'Hutumia mandhari angavu kila wakati.',
    'Utilise toujours le thème sombre.': 'Hutumia mandhari ya giza kila wakati.',
};

export default sw;
