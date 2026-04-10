const es: Record<string, string> = {
    // ── Sidebar menu ──
    Historique: 'Historial',
    Recherche: 'Búsqueda',
    Sujets: 'Temas',
    Notes: 'Notas',
    Soulignages: 'Subrayados',
    'Aucun soulignage': 'Sin subrayados',
    'Supprimer ce soulignage ?': '¿Eliminar este subrayado?',
    'Soulignage supprimé': 'Subrayado eliminado',
    'Erreur lors du chargement des soulignages': 'Error al cargar los subrayados',
    'Charger plus': 'Cargar más',
    Paramètres: 'Configuración',

    // ── Viewer menu ──
    Outils: 'Herramientas',
    Lecture: 'Lectura',

    // ── Sidebar documents ──
    Prédications: 'Predicaciones',
    Bible: 'Biblia',
    Documents: 'Documentos',
    'Aucun document ajouté': 'Ningún documento añadido',
    'Ajouter un document': 'Añadir un documento',
    'Choisir un document': 'Elegir un documento',
    Gérer: 'Gestionar',
    Alphabet: 'Alfabeto',
    Année: 'Año',
    Années: 'Años',
    'A-Z': 'A-Z',
    'Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.':
        'Formatos compatibles: PDF, TXT, MD, DOCX, EPUB.',
    "Erreur lors de l'import du document.": 'Error al importar el documento.',
    'Format de document non pris en charge.': 'Formato de documento no compatible.',
    'Le fichier est trop volumineux.': 'El archivo es demasiado grande.',

    // ── Settings index ──
    Général: 'General',
    'Vue document': 'Vista del documento',
    Langues: 'Idiomas',
    'Lecture audio': 'Texto a voz',
    Sauvegarde: 'Copia de seguridad',
    'Mise à jour': 'Actualización',
    'Gérez les préférences de votre application.': 'Gestione las preferencias de su aplicación.',
    Assistant: 'Asistente',
    'Assistant IA': 'Asistente IA',
    "Activer l'assistant IA": 'Activar el asistente IA',
    "Une fois activé, l'assistant apparaît dans la barre latérale.":
        'Una vez activado, el asistente aparece en la barra lateral.',
    'Clé API': 'Clave API',
    'URL de base': 'URL base',
    Modèle: 'Modelo',
    Identifiant: 'Identificador',
    'Nom affiché': 'Nombre visible',
    Optionnel: 'Opcional',
    'Modèle par défaut': 'Modelo predeterminado',
    Recommandé: 'Recomendado',
    Installé: 'Instalado',
    Nouveau: 'Nuevo',

    // ── AI settings ──
    'Choisissez le service à utiliser pour le chat IA.':
        'Elija el servicio a usar para el chat de IA.',
    'Choisir un fournisseur': 'Elegir un proveedor',
    Personnalisé: 'Personalizado',
    'Comportement des langues': 'Comportamiento de idiomas',
    "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.":
        'El asistente sigue el idioma activo, salvo que pida explícitamente otro idioma.',
    'Suivre la langue active': 'Seguir el idioma activo',
    'Changer uniquement sur demande': 'Cambiar solo a petición',
    "Utilisez l'identifiant exact du modèle fourni par ce service.":
        'Use el identificador exacto del modelo proporcionado por este servicio.',

    // ── AI provider descriptions ──
    'Fonctionne sans connexion internet, directement sur votre ordinateur.':
        'Funciona sin conexión a internet, directamente en su ordenador.',
    'Accédez à plusieurs modèles avec une seule clé API.':
        'Acceda a varios modelos con una sola clave API.',
    'ChatGPT et autres modèles OpenAI.': 'ChatGPT y otros modelos de OpenAI.',
    'Les modèles Gemini de Google.': 'Los modelos Gemini de Google.',
    "Les modèles Claude d'Anthropic.": 'Los modelos Claude de Anthropic.',

    // ── AI local models ──
    'Modèle local': 'Modelo local',
    Actualiser: 'Actualizar',
    'Choisir un modèle': 'Elegir un modelo',
    Utiliser: 'Usar',
    'Modèle téléchargé': 'Modelo descargado',
    'Le téléchargement a échoué.': 'La descarga ha fallado.',
    '~{{size}} Mo': '~{{size}} MB',
    'Léger et rapide. Idéal pour un usage quotidien sur la plupart des ordinateurs.':
        'Ligero y rápido. Ideal para uso diario en la mayoría de los ordenadores.',
    'Plus complet, meilleure compréhension. Nécessite un peu plus de mémoire.':
        'Más completo, mejor comprensión. Requiere un poco más de memoria.',
    'Fonctionne sans connexion internet, directement sur votre ordinateur. Téléchargez un modèle pour commencer.':
        'Funciona sin conexión a internet, directamente en su ordenador. Descargue un modelo para comenzar.',
    'Le mode local est plus limité': 'El modo local es más limitado',
    'Le mode local peut répondre plus lentement et avec moins de précision, surtout pour les questions longues ou difficiles.':
        'El modo local puede responder más lentamente y con menos precisión, especialmente en preguntas largas o difíciles.',
    'Utiliser la carte graphique (GPU)': 'Usar tarjeta gráfica (GPU)',
    'Accélère les réponses si votre ordinateur possède une carte graphique compatible. Désactivez cette option en cas de problème.':
        'Acelera las respuestas si su ordenador tiene una tarjeta gráfica compatible. Desactive esta opción en caso de problemas.',

    // ── AI custom providers ──
    'Ajouter un fournisseur': 'Añadir un proveedor',
    'Ajouter un fournisseur personnalisé': 'Añadir un proveedor personalizado',
    'Supprimer ce fournisseur ?': '¿Eliminar este proveedor?',
    'Un fournisseur avec ce nom existe déjà.': 'Ya existe un proveedor con este nombre.',
    'ex: Mon Service IA': 'ej.: Mi Servicio IA',
    'ex: gpt-4o-mini': 'ej.: gpt-4o-mini',
    'Taille du contexte (tokens)': 'Tamaño del contexto (tokens)',

    // ── AI provider test ──
    'Tester la connexion': 'Probar conexión',
    Connecté: 'Conectado',
    Échec: 'Error',
    'La connexion a échoué.': 'La conexión ha fallado.',
    'La clé API est manquante pour ce fournisseur.': 'Falta la clave API para este proveedor.',
    'Fournisseur IA inconnu.': 'Proveedor IA desconocido.',
    'Validation du fournisseur impossible.': 'No se pudo validar el proveedor.',
    'Le mode local nécessite une langue par défaut et un moteur local actif.':
        'El modo local requiere un idioma predeterminado y un motor local activo.',
    'La synthèse du navigateur est gérée dans le processus renderer.':
        'La síntesis del navegador se gestiona en el proceso renderer.',
    'La prévisualisation du navigateur est gérée dans le processus renderer.':
        'La vista previa del navegador se gestiona en el proceso renderer.',
    'Fournisseur TTS inconnu.': 'Proveedor TTS desconocido.',
    'Fournisseur TTS introuvable.': 'Proveedor TTS no encontrado.',
    'Ce fournisseur ne prend pas en charge le téléchargement de modèles.':
        'Este proveedor no admite la descarga de modelos.',
    'Ce fournisseur ne prend pas en charge la suppression de modèles.':
        'Este proveedor no admite la eliminación de modelos.',
    'Ce fournisseur ne prend pas en charge le clonage de voix.':
        'Este proveedor no admite la clonación de voces.',
    'Voix de référence introuvable.': 'Voz de referencia no encontrada.',
    "La clé API OpenAI n'est pas configurée.": 'La clave API de OpenAI no está configurada.',
    "La clé API ElevenLabs n'est pas configurée.":
        'La clave API de ElevenLabs no está configurada.',
    "La clé API Cartesia n'est pas configurée.": 'La clave API de Cartesia no está configurada.',
    "Aucune voix Cartesia n'est sélectionnée.": 'No hay ninguna voz de Cartesia seleccionada.',
    'La langue est requise pour cloner une voix Cartesia.':
        'El idioma es obligatorio para clonar una voz de Cartesia.',
    'Le nom du modèle est requis pour le téléchargement Sherpa.':
        'Se requiere un nombre de modelo para la descarga de Sherpa.',
    'Modèle Sherpa inconnu.': 'Modelo Sherpa desconocido.',

    // ── AI errors ──
    "L'assistant IA est désactivé dans les paramètres.":
        'El asistente IA está desactivado en la configuración.',
    'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.':
        'Ningún proveedor IA configurado. Seleccione un proveedor en la configuración.',
    'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.':
        'Ningún modelo configurado para este proveedor. Defina un modelo en la configuración.',

    // ── AI chat ──
    "L'assistant IA est désactivé.": 'El asistente IA está desactivado.',
    'Ouvrir les paramètres': 'Abrir configuración',
    'Le saviez-vous ? <u>{{feature}}</u> peut vous aider à explorer un sujet et comprendre plus vite ce que vous cherchez.':
        '¿Sabía que <u>{{feature}}</u> puede ayudarle a explorar un tema y comprender más rápido lo que está buscando?',
    'Activez <u>{{feature}}</u> pour poser vos questions, approfondir un thème, comparer plusieurs prédications, retrouver des passages bibliques et obtenir des réponses claires sans tout parcourir manuellement.':
        'Active <u>{{feature}}</u> para hacer preguntas, profundizar en un tema, comparar varias predicaciones, encontrar pasajes bíblicos y obtener respuestas claras sin tener que recorrerlo todo manualmente.',
    "Ouvrir les réglages de l'assistant": 'Abrir ajustes del asistente',
    'Le saviez-vous ? <u>{{feature}}</u> peut lire vos documents.':
        '¿Sabía que <u>{{feature}}</u> puede leer sus documentos?',
    'Choisissez une voix pour <u>{{feature}}</u>, puis lancez la lecture directement depuis vos documents.':
        'Elija una voz para <u>{{feature}}</u> y luego inicie la lectura directamente desde sus documentos.',
    'Ouvrir les réglages audio': 'Abrir ajustes de audio',
    'Le saviez-vous ? <u>{{feature}}</u> peut protéger vos données.':
        '¿Sabía que <u>{{feature}}</u> puede proteger sus datos?',
    'Connectez Google Drive pour que <u>{{feature}}</u> garde vos notes, sujets et réglages synchronisés.':
        'Conecte Google Drive para que <u>{{feature}}</u> mantenga sincronizados sus notas, temas y ajustes.',
    'Ouvrir les réglages de sauvegarde': 'Abrir ajustes de copia de seguridad',
    'Posez votre question...': 'Haga su pregunta...',
    'Essayez une question pour commencer': 'Pruebe una pregunta para empezar',
    'Suggère-moi un thème à étudier.': 'Sugiérame un tema para estudiar.',
    'Aide-moi à formuler une question de recherche.':
        'Ayúdeme a formular una pregunta de investigación.',
    'Trouve-moi quelques références utiles sur un sujet.':
        'Encuéntreme algunas referencias útiles sobre un tema.',
    'Compare plusieurs références sur un même sujet.':
        'Compare varias referencias sobre un mismo tema.',
    Envoyer: 'Enviar',
    Arrêter: 'Detener',
    '{{count}} message en attente': '{{count}} mensaje pendiente',
    '{{count}} messages en attente': '{{count}} mensajes pendientes',
    'Ils seront envoyés dès que cette réponse se termine.':
        'Se enviarán en cuanto termine esta respuesta.',
    "En attente d'envoi.": 'Pendientes de envío.',
    "Ajoutez un message à la file d'attente...": 'Añada un mensaje a la cola...',
    "Ajouter à la file d'attente": 'Añadir a la cola',
    'Retirer de la file': 'Quitar de la cola',
    Conversations: 'Conversaciones',
    'Aucune conversation': 'Sin conversaciones',
    'Aucun sujet': 'Sin temas',
    'Sélectionner ou saisir un modèle': 'Seleccionar o escribir un modelo',
    'Voir le raisonnement': 'Ver razonamiento',
    'Masquer le raisonnement': 'Ocultar razonamiento',
    '{{count}} dernières lignes': 'últimas {{count}} líneas',
    '+{{count}} autre': '+{{count}} otro',
    '+{{count}} autres': '+{{count}} otros',
    Conversation: 'Conversación',
    'Nom de la conversation': 'Nombre de la conversación',
    maintenant: 'ahora',
    '{{count}} min': '{{count}} min',
    '{{count}} h': '{{count}} h',
    '{{count}} j': '{{count}} d',
    'Cette conversation est vide.': 'Esta conversación está vacía.',
    Vous: 'Tú',
    'Créé le': 'Creado el',
    'Mis à jour le': 'Actualizado el',
    'Exporté le': 'Exportado el',
    'Réponse sans texte': 'Respuesta sin texto',
    'Conversation introuvable.': 'Conversación no encontrada.',
    'Supprimer cette conversation ?': '¿Eliminar esta conversación?',
    'Supprimer toutes les conversations ?': '¿Eliminar todas las conversaciones?',
    "Vider l'historique": 'Vaciar historial',

    // ── AI tool results ──
    'Recherche de sermons': 'Búsqueda de predicaciones',
    'Lecture du sermon': 'Lectura de predicación',
    'Recherche dans le contenu': 'Búsqueda en el contenido',
    'Versions de la Bible': 'Versiones de la Biblia',
    'Passage biblique': 'Pasaje bíblico',
    'Liste des sujets': 'Lista de temas',
    'Création de sujet': 'Creación de tema',
    'Ajout au sujet': 'Añadido al tema',
    'Liste des notes': 'Lista de notas',
    'Lecture de la note': 'Lectura de nota',
    'Création de note': 'Creación de nota',
    'Mise à jour de la note': 'Actualización de nota',
    'Ajout à la note': 'Añadido a la nota',
    'Recherche biblique': 'Búsqueda bíblica',
    'Recherche approfondie': 'Investigación profunda',
    'Langues disponibles': 'Idiomas disponibles',
    'Documents personnalisés': 'Documentos personalizados',
    'Lecture du document': 'Lectura del documento',

    // ── General tab ──
    'Langue active': 'Idioma activo',
    'Langue des prédications': 'Idioma de las predicaciones',
    Bibliothèque: 'Biblioteca',
    'Langues installées': 'Idiomas instalados',
    "Documentation d'utilisation": 'Documentación de uso',
    "Impossible d'ouvrir la documentation": 'No se puede abrir la documentación',
    Actif: 'Activo',
    'En pause': 'En pausa',
    'Non connecté': 'No conectado',
    'À jour': 'Actualizado',
    Ouvrir: 'Abrir',

    // ── Library tab ──
    'Changer la langue': 'Cambiar idioma',
    'Gérer la bibliothèque': 'Gestionar biblioteca',
    'Aucune langue installée': 'Ningún idioma instalado',
    'Bibliothèque vide': 'Biblioteca vacía',

    // ── TTS tab ──
    'Fournisseur actif': 'Proveedor activo',
    'Le service qui lira le texte à voix haute.': 'El servicio que leerá el texto en voz alta.',
    'Changer la voix automatiquement': 'Cambiar la voz automáticamente',
    'Choisir automatiquement une voix adaptée à la langue du document.':
        'Elegir automáticamente una voz adaptada al idioma del documento.',
    'Mode de surlignage': 'Modo de resaltado',
    'Choisissez comment le texte est mis en évidence pendant la lecture.':
        'Elija cómo se resalta el texto durante la lectura.',
    Phrase: 'Frase',
    Paragraphe: 'Párrafo',
    'Vitesse de lecture: {{rate}}x': 'Velocidad de lectura: {{rate}}x',
    'Pause entre les segments: {{gap}}s': 'Pausa entre segmentos: {{gap}}s',
    'Durée de la pause entre chaque phrase ou paragraphe lu.':
        'Duración de la pausa entre cada frase o párrafo leído.',
    'Cache audio': 'Caché de audio',
    'Les lectures passées sont conservées pour une relecture plus rapide.':
        'Las lecturas anteriores se conservan para una reproducción más rápida.',
    Utilisé: 'Usado',
    Limite: 'Límite',
    Vider: 'Vaciar',
    'Cache audio vidé': 'Caché de audio vaciado',
    'Vider le cache audio ?': '¿Vaciar el caché de audio?',
    'Toutes les lectures en mémoire seront supprimées.':
        'Todas las lecturas en memoria serán eliminadas.',
    'Taille maximale du cache': 'Tamaño máximo del caché',

    // ── TTS enhanced reading ──
    'Lecture améliorée': 'Lectura mejorada',
    "Lire l'introduction": 'Leer la introducción',
    'Annonce le titre, la date et le lieu avant de commencer la lecture.':
        'Anuncia el título, la fecha y el lugar antes de comenzar la lectura.',
    'Annoncer les numéros': 'Anunciar números',
    'Annonce le numéro du verset ou du paragraphe avant de le lire.':
        'Anuncia el número del versículo o párrafo antes de leerlo.',
    'Lire tout le livre (Bible)': 'Leer el libro completo (Biblia)',
    'Continue automatiquement au chapitre suivant après avoir terminé.':
        'Continúa automáticamente al siguiente capítulo al terminar.',
    'Défiler automatiquement': 'Desplazamiento automático',
    'Fait défiler la page pour toujours voir le texte en cours de lecture.':
        'Desplaza la página para mantener siempre visible el texto que se está leyendo.',

    // ── TTS shared ──
    'Voix du système': 'Voces del sistema',
    'Sherpa-ONNX TTS': 'Sherpa-ONNX TTS',
    'Kokoro TTS': 'Kokoro TTS',
    'ElevenLabs TTS': 'ElevenLabs TTS',
    'OpenAI TTS': 'OpenAI TTS',
    'Edge TTS (Microsoft)': 'Edge TTS (Microsoft)',
    'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.':
        'Gratis, funciona sin conexión a internet. Usa las voces instaladas en su ordenador.',
    'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.':
        'Gratis, funciona sin conexión. Soporta muchos idiomas y voces. Requiere una descarga inicial.',
    'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.':
        'Gratis, funciona sin conexión. Buena calidad, requiere una descarga inicial.',
    'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.':
        'Excelente calidad. Permite clonar su voz. Requiere una cuenta y conexión a internet.',
    'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.':
        'Excelente calidad, muchos idiomas disponibles. Requiere una cuenta y conexión a internet.',
    'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.':
        'Gratis, buena calidad, muchos idiomas. Requiere conexión a internet. No se necesita cuenta.',
    Gratuit: 'Gratis',
    Local: 'Local',
    Cloud: 'Nube',
    o: 'B',
    Ko: 'KB',
    Mo: 'MB',

    // ── TTS provider browser ──
    Voix: 'Voz',
    Volume: 'Volumen',
    Version: 'Versión',
    'Tester la voix': 'Probar la voz',
    'Les voix disponibles dépendent de celles installées sur votre ordinateur.':
        'Las voces disponibles dependen de las instaladas en su ordenador.',
    'Voix par défaut du système': 'Voz predeterminada del sistema',
    'Hauteur: {{value}}': 'Tono: {{value}}',
    'Ajuste la tonalité de la voix.': 'Ajusta el tono de la voz.',
    'Volume: {{value}}%': 'Volumen: {{value}}%',

    // ── TTS provider Kokoro ──
    'À télécharger une seule fois. Environ 160 Mo.':
        'Descargar una sola vez. Aproximadamente 160 MB.',
    'Télécharger le modèle': 'Descargar modelo',
    'Toutes les voix sont disponibles. La voix par défaut correspond à la langue active.':
        'Todas las voces están disponibles. La voz predeterminada corresponde al idioma activo.',
    'Modèle Kokoro téléchargé': 'Modelo Kokoro descargado',
    'Erreur: {{error}}': 'Error: {{error}}',
    'Erreur lors de la prévisualisation de la voix': 'Error al probar la voz',
    "Impossible d'enregistrer les paramètres de Lecture audio.":
        'No se pudieron guardar los ajustes de texto a voz.',

    // ── TTS provider Sherpa ──
    'Voix disponible — {{lang}}': 'Voz disponible — {{lang}}',
    'Téléchargez une voix pour la langue active du document.':
        'Descargue una voz para el idioma activo del documento.',
    'Télécharger « {{name}} »': 'Descargar "{{name}}"',
    'Voix active': 'Voz activa',
    'Voix installées ({{count}})': 'Voces instaladas ({{count}})',
    'Ajouter une autre langue': 'Añadir otro idioma',
    'Recherchez une langue ou un nom de voix.': 'Busque un idioma o nombre de voz.',
    'Ex: arabe, portugais, swahili…': 'Ej: árabe, portugués, suajili…',
    'Aucun résultat': 'Sin resultados',
    'Voix installée': 'Voz instalada',
    'Voix supprimée': 'Voz eliminada',
    Télécharger: 'Descargar',
    Téléchargement: 'Descargando',
    Extraction: 'Extrayendo',
    Finalisation: 'Finalizando',
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'No hay voces disponibles para el idioma activo. Use la búsqueda anterior para encontrar una voz en otro idioma.',

    // quality tags
    'Haute qualité': 'Alta calidad',
    'Qualité moyenne': 'Calidad media',
    'Qualité légère': 'Calidad ligera',
    Multilingue: 'Multilingüe',

    // ── TTS provider ElevenLabs ──
    'Clé API ElevenLabs': 'Clave API ElevenLabs',
    'Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Su clave secreta de ElevenLabs. Se almacena de forma segura en su ordenador.',
    'Les voix marquées « cloné » sont vos voix personnalisées.':
        'Las voces marcadas como "clonadas" son sus voces personalizadas.',
    'Le choix par défaut convient pour la plupart des usages.':
        'La opción predeterminada es adecuada para la mayoría de usos.',
    'Paramètres avancés': 'Configuración avanzada',
    'Voix clonées': 'Voces clonadas',
    'Vos voix personnalisées.': 'Sus voces personalizadas.',
    'Cloner une voix': 'Clonar una voz',
    'Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix.':
        'Grabe un audio WAV o MP3 de 10 a 60 segundos para crear su propia voz.',
    'Nom de la voix (ex: MaVoix)': 'Nombre de la voz (ej: MiVoz)',
    'Choisir un fichier audio': 'Elegir un archivo de audio',
    Cloner: 'Clonar',
    'Voix clonée avec succès': 'Voz clonada con éxito',
    'Voix clonée supprimée': 'Voz clonada eliminada',
    'Voix de référence': 'Voces de referencia',
    'Voix intégrées pour le clonage vocal. Clonez-les pour les utiliser.':
        'Voces integradas para la clonación vocal. Clónalas para usarlas.',
    Cloné: 'Clonado',
    'Erreur lors de la lecture': 'Error de reproducción',

    // ── TTS provider Edge ──
    'Sélectionnez une voix parmi les centaines disponibles, classées par langue.':
        'Seleccione una voz entre las cientos disponibles, organizadas por idioma.',

    // ── TTS provider OpenAI ──
    'Clé API OpenAI': 'Clave API OpenAI',
    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Su clave secreta de OpenAI. Se almacena de forma segura en su ordenador.',
    'Le choix par défaut offre la meilleure qualité.':
        'La opción predeterminada ofrece la mejor calidad.',
    'Marin et Cedar sont recommandées pour la meilleure qualité.':
        'Marin y Cedar son recomendadas para la mejor calidad.',

    // ── TTS provider Cartesia ──
    'Cartesia TTS': 'Cartesia TTS',
    'Clé API Cartesia': 'Clave API Cartesia',
    'Votre clé secrète Cartesia. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Su clave secreta de Cartesia. Se almacena de forma segura en su ordenador.',
    'Langue de la voix': 'Idioma de la voz',
    "Sélectionnez la langue dans laquelle la voix clonée s'exprimera.":
        'Seleccione el idioma en el que la voz clonada hablará.',
    'Sélectionnez une voix': 'Seleccione una voz',
    'Obtenir une clé API': 'Obtener clave API',

    // ── TTS controls ──
    'Pause lecture': 'Pausar lectura',
    'Reprendre la lecture': 'Reanudar lectura',
    'Démarrer la lecture': 'Iniciar lectura',
    'Lire à voix haute': 'Leer en voz alta',
    'Pause voix': 'Pausar voz',
    'Reprendre la voix': 'Reanudar voz',
    'Lecture audio indisponible': 'Audio no disponible',
    'Zoom arrière': 'Alejar',
    'Zoom avant': 'Acercar',
    "Lire à partir d'ici": 'Leer desde aquí',
    'Aucune voix disponible pour cette langue.': 'No hay voz disponible para este idioma.',

    // ── TTS compatibility messages ──
    "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres de Lecture audio.":
        'Este proveedor no está configurado. Añada una clave API en los ajustes de Lectura en voz alta.',
    "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres de Lecture audio.":
        'El modelo de voz no está descargado. Descárguelo en los ajustes de Lectura en voz alta.',
    'Le modèle sélectionné ne prend pas en charge cette langue. Changez de modèle dans les paramètres de Lecture audio.':
        'El modelo seleccionado no es compatible con este idioma. Cambie el modelo en los ajustes de Lectura en voz alta.',
    'Ce fournisseur ne prend pas en charge cette langue.':
        'Este proveedor no es compatible con este idioma.',
    'Ce fournisseur ne peut pas lire cette langue.': 'Este proveedor no puede leer este idioma.',
    'Le navigateur ne dispose pas de voix pour cette langue.':
        'El navegador no tiene voz para este idioma.',
    'Impossible de vérifier la compatibilité du fournisseur.':
        'No se puede verificar la compatibilidad del proveedor.',
    'Connexion internet indisponible. Vérifiez votre connexion et réessayez.':
        'No hay conexión a internet. Verifique su conexión e inténtelo de nuevo.',
    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.':
        'La reproducción de audio falló. Verifique la configuración del proveedor.',

    // ── History ──
    'Aucune historique': 'Sin historial',

    // ── Search ──
    'Votre recherche doit comporter au moins trois caractères':
        'Su búsqueda debe contener al menos tres caracteres',
    'Erreur lors de la recherche': 'Error durante la búsqueda',

    // ── Subject ──
    'Créer un sujet': 'Crear un tema',
    'Nom sujet': 'Nombre del tema',
    Enregistrer: 'Guardar',
    'Erreur lors du chargement des sujets': 'Error al cargar los temas',
    'Erreur lors du chargement des éléments du sujet': 'Error al cargar los elementos del tema',
    'Erreur lors de la réorganisation des références':
        'Error al reorganizar las referencias del tema',
    'Sujet créé': 'Tema creado',
    'Un sujet avec ce nom existe déjà.': 'Ya existe un tema con este nombre.',
    'Sujet introuvable': 'Tema no encontrado',
    'Renommer le sujet': 'Renombrar tema',
    'Sujet renommé': 'Tema renombrado',
    Supprimé: 'Eliminado',
    'Aucune référence trouvée dans le sujet: {{name}}':
        'Ninguna referencia encontrada en el tema: {{name}}',

    // ── Backup tab ──
    'Connectez-vous avec Google pour sauvegarder vos données sur Google Drive.':
        'Inicie sesión con Google para guardar sus datos en Google Drive.',
    'Vos données seront restaurées automatiquement lors de la connexion.':
        'Sus datos se restaurarán automáticamente al iniciar sesión.',
    'Connexion Google': 'Inicio de sesión con Google',
    'Synchronisation automatique': 'Sincronización automática',
    'Dernière synchronisation : {{time}}': 'Última sincronización: {{time}}',
    'Accès limité': 'Acceso limitado',
    "Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront.":
        'Inicie sesión de nuevo y asegúrese de autorizar el acceso solicitado marcando las casillas que aparecerán.',
    'Erreur de synchronisation': 'Error de sincronización',
    'Connexion réussie. Synchronisation en arrière-plan...':
        'Conexión exitosa. Sincronizando en segundo plano...',
    "Une erreur s'est produite lors de la connexion, réessayez plus tard":
        'Ocurrió un error durante la conexión, inténtelo más tarde',
    "Connexion refusée : vous devez autoriser tous les accès demandés. Reconnectez-vous et cochez toutes les cases d'autorisation.":
        'Conexión rechazada: debe autorizar todos los accesos solicitados. Vuelva a conectarse y marque todas las casillas de autorización.',
    'Synchronisation activée': 'Sincronización activada',
    Déconnexion: 'Cerrar sesión',
    'Se déconnecter de Google ?': '¿Cerrar sesión de Google?',
    'La synchronisation sera arrêtée et les données de connexion supprimées.':
        'La sincronización se detendrá y los datos de inicio de sesión se eliminarán.',
    'Vos données locales seront conservées.': 'Tus datos locales se conservarán.',
    'Déconnexion réussie': 'Sesión cerrada correctamente',
    "Une erreur s'est produite lors de la déconnexion, réessayez plus tard":
        'Ocurrió un error al cerrar sesión, intenta más tarde',
    'Vous êtes connecté maintenant et pouvez fermer cette page.':
        'Ya estás conectado y puedes cerrar esta página.',
    "L'autorisation a échoué. Veuillez réessayer depuis l'application.":
        'La autorización falló. Por favor, inténtalo de nuevo desde la aplicación.',
    'Début de la récupération des données': 'Iniciando recuperación de datos',
    'Préparation de la restauration des données': 'Preparando restauración de datos',
    "Une erreur s'est produite lors de la restauration, veuillez réessayer plus tard":
        'Ocurrió un error durante la restauración, inténtelo más tarde',
    'Vos données ont été restaurées avec succès.': 'Sus datos han sido restaurados con éxito.',
    "Redémarrer l'application": 'Reiniciar la aplicación',
    Restauration: 'Restauración',
    'de données': 'de datos',

    // ── Update tab ──
    "Mise à jour de l'application": 'Actualización de la aplicación',
    'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.':
        'Una nueva versión está disponible. Haga clic en el botón de abajo para iniciar la actualización.',
    'Téléchargement de la mise à jour': 'Descargando actualización',
    'Téléchargement terminé': 'Descarga completada',
    "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.":
        'Haga clic en el botón de instalación a continuación para instalar la actualización.',
    'Erreur !': '¡Error!',
    "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.":
        'Ocurrió un error durante la actualización, inténtelo más tarde.',
    'Aucune mise à jour disponible': 'No hay actualizaciones disponibles',
    "Vous utilisez déjà la dernière version de l'application.":
        'Ya está utilizando la última versión de la aplicación.',
    Vérifier: 'Verificar',
    'Vérification des mises à jour...': 'Verificando actualizaciones...',
    'Mettre à jour': 'Actualizar',
    'Installer la mise à jour': 'Instalar actualización',
    'Mise à jour disponible': 'Actualización disponible',
    'La version {{version}} est disponible.': 'La versión {{version}} está disponible.',
    'Une nouvelle version est disponible.': 'Una nueva versión está disponible.',
    'Voir la mise à jour': 'Ver actualización',
    'Mise à jour prête': 'Actualización lista',
    "La mise à jour a été téléchargée. Elle sera installée au prochain redémarrage, ou vous pouvez l'installer maintenant.":
        'La actualización se ha descargado. Se instalará en el próximo reinicio, o puede instalarla ahora.',
    'Redémarrer et installer': 'Reiniciar e instalar',

    // ── Language manager modal ──
    'Supprimer cette langue ?': '¿Eliminar este idioma?',
    'Les données de cette langue seront supprimées du disque.':
        'Los datos de este idioma se eliminarán del disco.',
    Supprimer: 'Eliminar',
    Annuler: 'Cancelar',
    'Langue téléchargée avec succès': 'Idioma descargado con éxito',
    'Langue mise à jour avec succès': 'Idioma actualizado con éxito',
    'Téléchargez une langue pour commencer': 'Descargue un idioma para comenzar',
    'Rechercher une langue...': 'Buscar un idioma...',
    'Aucune langue trouvée': 'Ningún idioma encontrado',
    'Mes langues': 'Mis idiomas',
    Disponibles: 'Disponibles',
    'Échec de la sélection de la langue': 'Error al seleccionar el idioma',
    'Langue supprimée': 'Idioma eliminado',

    // ── Custom documents modal ──
    'Documents ajoutés': 'Documentos añadidos',
    'Erreur lors du chargement des documents': 'Error al cargar los documentos',
    'Rechercher...': 'Buscar...',
    Ajouter: 'Añadir',
    'Nom du document': 'Nombre del documento',
    'Ce nom existe déjà': 'Este nombre ya existe',
    'Seul le format PDF est pris en charge.': 'Solo se admite el formato PDF.',
    'Un document avec ce nom existe déjà.': 'Ya existe un documento con este nombre.',
    'Choisir un fichier PDF': 'Elegir un archivo PDF',
    'Document supprimé': 'Documento eliminado',
    'Langue du document': 'Idioma del documento',
    'Langue modifiée': 'Idioma cambiado',
    'La langue du document ne correspond pas à la langue active. Changez la langue dans les paramètres.':
        'El idioma del documento no coincide con el idioma activo. Cambie el idioma en los ajustes.',
    'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.':
        'El idioma del documento no coincide con el idioma activo ({{language}}). Cambie el idioma en los ajustes.',
    'Traitement...': 'Procesando...',
    Retour: 'Volver',
    "Erreur lors de l'extraction du document.": 'Error al extraer el documento.',
    'Document ajouté': 'Documento añadido',

    // ── Highlight modal ──
    Souligner: 'Resaltar',
    Couleur: 'Color',
    Jaune: 'Amarillo',
    'Vert clair': 'Verde claro',
    'Bleu ciel': 'Azul cielo',
    Rose: 'Rosa',
    Orange: 'Naranja',
    Violet: 'Violeta',
    Menthe: 'Menta',
    Pêche: 'Melocotón',
    Lavande: 'Lavanda',
    Corail: 'Coral',
    Cyan: 'Cian',
    Lime: 'Lima',
    Commentaire: 'Comentario',
    'Ajouter un commentaire (optionnel)': 'Añadir un comentario (opcional)',
    'Surlignage enregistré': 'Resaltado guardado',
    "Erreur lors de l'enregistrement": 'Error al guardar',

    // ── Document audio player ──
    'Langue: {{name}}': 'Idioma: {{name}}',

    // ── Bible version selector ──
    'Version:': 'Versión:',
    'Télécharger {{name}}': 'Descargar {{name}}',

    // ── Delete button ──
    'Confirmer la suppression?': '¿Confirmar eliminación?',
    Oui: 'Sí',
    Non: 'No',

    // ── Note references modal ──
    'Lier ce paragraphe à une référence de la note :':
        'Vincular este párrafo a una referencia de la nota:',
    "Aucune note n'est actuellement sélectionnée": 'Ninguna nota está seleccionada actualmente',
    'Aucune référence disponible': 'Ninguna referencia disponible',
    'Lié à : {{title}}': 'Vinculado a: {{title}}',
    'Aucun document attribué': 'Ningún documento asignado',
    'Ajouter à cette référence': 'Añadir a esta referencia',
    'Ajouté à la note': 'Añadido a la nota',
    "Erreur lors de l'ajout à la note": 'Error al añadir a la nota',

    // ── Other traductions modal ──
    'Traductions du document: {{title}}': 'Traducciones del documento: {{title}}',
    'Sources de traduction': 'Fuentes de traducción',
    'Traduction {{id}}': 'Traducción {{id}}',
    'Basculer vers cette traduction': 'Cambiar a esta traducción',
    'Autres langues': 'Otros idiomas',
    'Langue: {{code}}': 'Idioma: {{code}}',
    'Ouvrir le document': 'Abrir documento',
    'Aucune autre traduction disponible': 'No hay otras traducciones disponibles',

    // ── Subject select modal ──
    'Choiser un sujet': 'Elegir un tema',
    'Choisir un sujet': 'Elegir un tema',
    'Ajouté au sujet': 'Añadido al tema',
    "Erreur lors de l'ajout au sujet": 'Error al añadir al tema',

    // ── Document tabs ──
    'Fermer tous les onglets': 'Cerrar todas las pestañas',
    'Voulez-vous vraiment fermer tous les onglets ?': '¿Realmente desea cerrar todas las pestañas?',
    'Tout fermer': 'Cerrar todo',
    Fermer: 'Cerrar',
    'Fermer les autres': 'Cerrar las demás',
    'Fermer à droite': 'Cerrar a la derecha',

    // ── Sync listener ──
    'Session Google expirée. Le compte a été déconnecté. Reconnectez-vous dans les paramètres de sauvegarde.':
        'Sesión de Google expirada. La cuenta ha sido desconectada. Reconéctese en la configuración de copia de seguridad.',

    // ── Layout ──
    'Chargement des données...': 'Cargando datos...',
    'Synchronisation en cours...': 'Sincronizando...',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Seleccione un párrafo',
    'Aucun paragraphe': 'Sin párrafos',
    'Sélectionnez un verset': 'Seleccione un versículo',
    'Aucun verset': 'Sin versículos',

    // ── Sermon paragraph ──
    'Surlignage supprimé': 'Resaltado eliminado',
    'Erreur lors de la suppression': 'Error al eliminar',
    'Supprimer le surlignage': 'Eliminar resaltado',

    // ── Sermon header ──
    Pause: 'Pausa',
    Écouter: 'Escuchar',
    "Écouter l'audio": 'Escuchar audio',
    'Pause audio': 'Pausar audio',
    Traductions: 'Traducciones',
    Rechercher: 'Buscar',

    // ── Bible document view ──
    'Chapitre {{chapter}}': 'Capítulo {{chapter}}',
    'Chapitre précédent': 'Capítulo anterior',
    'Chapitre suivant': 'Capítulo siguiente',

    // ── Search result list ──
    'Trouvé dans {{count}} document': 'Encontrado en {{count}} documento',
    'Trouvé dans {{count}} documents': 'Encontrado en {{count}} documentos',
    'page ({{current}}/{{total}})': 'página ({{current}}/{{total}})',
    'Aucun résultat trouvé': 'Ningún resultado encontrado',

    // ── Bible search ──
    'Tous les testaments': 'Todos los testamentos',
    'Nouveau Testament': 'Nuevo Testamento',
    'Ancien Testament': 'Antiguo Testamento',
    'Faites vos recherches biblique ici': 'Busque en la Biblia aquí',
    Testaments: 'Testamentos',
    'Trouvé dans {{count}} verset': 'Encontrado en {{count}} versículo',
    'Trouvé dans {{count}} versets': 'Encontrado en {{count}} versículos',

    // ── Bible content ──
    'Aucune Bible disponible pour cette langue': 'No hay Biblia disponible para este idioma',
    'Aucune version biblique active disponible.':
        'No hay ninguna versión bíblica activa disponible.',
    Ancien: 'Antiguo',
    Testament: 'Testamento',
    'Ajouter à un sujet': 'Añadir a un tema',

    // ── Notes ──
    'Erreur lors du chargement des notes': 'Error al cargar las notas',
    'Note supprimée': 'Nota eliminada',
    'Note introuvable ou vide': 'Nota no encontrada o vacía',
    'Aucun modèle Sherpa-ONNX installé': 'Ningún modelo Sherpa-ONNX instalado',
    'Aucun modèle local GGUF trouvé dans ~/.wmb-table/ai-models.':
        'No se encontró ningún modelo local GGUF en ~/.wmb-table/ai-models.',
    'Le modèle local n\u2019est pas chargé.': 'El modelo local no está cargado.',
    'Erreur lors de la création de la note': 'Error al crear la nota',
    'Nouvelle note': 'Nueva nota',
    'Aucune note': 'Sin notas',

    // ── Inline search bar ──
    'Aller au paragraphe': 'Ir al párrafo',

    // ── Langue label ──
    'Langue:': 'Idioma:',

    // ── Sermon content header ──
    'Date:': 'Fecha:',
    'Traduction:': 'Traducción:',

    // ── Search input ──
    'Au moins un mot': 'Al menos una palabra',
    'Tous les mots': 'Todas las palabras',
    'Phrase exacte': 'Frase exacta',
    'Faites vos recherches ici': 'Busque aquí',

    // ── Search result item ──
    '{{count}} correspondance': '{{count}} coincidencia',
    '{{count}} correspondances': '{{count}} coincidencias',
    'Voir moins': 'Ver menos',
    'Voir tout ({{count}})': 'Ver todo ({{count}})',

    // ── Editor ──
    'Le nom entré est invalid': 'El nombre ingresado no es válido',
    Modifié: 'Modificado',
    Enregistré: 'Guardado',
    Alerte: 'Alerta',
    "Semble que votre note n'a pas de contenu, si vous continuez cette note sera inconsidérée et elle sera supprimée":
        'Parece que su nota no tiene contenido; si continúa, esta nota será ignorada y eliminada',
    Continuer: 'Continuar',
    'Activer le mode lecture': 'Activar modo lectura',
    'Désactiver le mode lecture': 'Desactivar modo lectura',
    'Exporter au format PDF': 'Exportar a PDF',
    'Exporter en PDF': 'Exportar a PDF',
    "Erreur lors de l'export PDF": 'Error al exportar PDF',
    'PDF exporté avec succès': 'PDF exportado con éxito',
    'La référence est invalide': 'La referencia no es válida',
    'La référence biblique est invalide': 'La referencia bíblica no es válida',
    'Référence supprimée': 'Referencia eliminada',
    'Cliquez droit sur une référence pour la supprimer':
        'Haga clic derecho en una referencia para eliminarla',
    'Référence document: {{label}}': 'Referencia de documento: {{label}}',
    'Référence biblique: {{label}}': 'Referencia bíblica: {{label}}',
    'Aucune sélection trouvée pour la référence': 'No se encontró selección para la referencia',
    'Référence document': 'Referencia de documento',
    'Référence biblique': 'Referencia bíblica',
    'Supprimer la référence': 'Eliminar referencia',
    Français: 'Francés',
    English: 'Inglés',

    // ── References modal ──
    'Référence: {{label}}': 'Referencia: {{label}}',
    "Aucun document n'a été attribué pour cette référence":
        'No se ha asignado ningún documento para esta referencia',
    'Verset supprimé': 'Versículo eliminado',
    'Le verset cliqué existe déjà dans la références !':
        '¡El versículo seleccionado ya existe en las referencias!',
    'Verset ajouté': 'Versículo añadido',
    'Aucun verset sélectionné': 'Ningún versículo seleccionado',
    'Ajouter des versets': 'Añadir versículos',

    // ── Error boundary ──
    "Une erreur inattendue s'est produite": 'Se produjo un error inesperado',
    "Recharger l'application": 'Recargar la aplicación',

    // ── Native menu ──
    '&Fichier': '&Archivo',
    '&Fermer': '&Salir',
    Éditer: 'Editar',
    Défaire: 'Deshacer',
    Refaire: 'Rehacer',
    Couper: 'Cortar',
    Copier: 'Copiar',
    Coller: 'Pegar',
    'Tout sélectionner': 'Seleccionar todo',
    '&Vue': '&Vista',
    'Basculer la barre latérale': 'Alternar barra lateral',
    'Changer de menu': 'Cambiar menú',
    "Changer d'option": 'Cambiar opción',
    'Mode lecture': 'Modo lectura',
    'Quitter le mode lecture': 'Salir del modo lectura',
    'Basculer en plein écran': 'Pantalla completa',
    Aide: 'Ayuda',
    Documentation: 'Documentación',
    'Nous contacter': 'Contáctenos',
    'À propos': 'Acerca de',
    Produit: 'Producto',
    'Site web': 'Sitio web',
    Auteur: 'Autor',
    Licence: 'Licencia',
    "Aujourd'hui": 'Hoy',
    'Aucun document consulté ce jour': 'Ningún documento consultado este día',
    Renommer: 'Renombrar',
    Traduction: 'Traducción',
    'Texte copié': 'Texto copiado',
    'Copier le texte sélectionné': 'Copiar el texto seleccionado',
    'Impossible de copier le texte.': 'No se pudo copiar el texto.',
    'Sélectionnez du texte à souligner': 'Seleccione texto para resaltar',
    'Ajouter au sujet': 'Añadir al tema',
    'Ajouter à la note': 'Añadir a la nota',
    'Trouver des prédications similaires': 'Buscar predicaciones similares',
    'Prédications similaires': 'Predicaciones similares',
    'Aucune prédication similaire trouvée': 'No se encontraron predicaciones similares',
    Prédication: 'Predicación',
    Document: 'Documento',
    Référence: 'Referencia',
    'Sauvegarde de données': 'Guardando datos',
    'Restauration de données': 'Restaurando datos',

    // ── General ──
    sermons: 'sermones',
    disponible: 'disponible',
    "Erreur lors de l'initialisation de l'application": 'Error de inicialización de la aplicación',
    'Une erreur inattendue est survenue.': 'Se produjo un error inesperado.',
    'Mémoriser la position de lecture': 'Recordar la posición de lectura',
    "Rouvrez un document là où vous l'aviez laissé la dernière fois.":
        'Reabra un documento donde lo dejó la última vez.',
    "Impossible d'enregistrer le paramètre": 'No se pudo guardar la configuración',
    "Nombre maximum d'onglets": 'Número máximo de pestañas',
    'Les onglets les plus anciens seront fermés automatiquement lorsque la limite est atteinte ({{min}}-{{max}}).':
        'Las pestañas más antiguas se cerrarán automáticamente cuando se alcance el límite ({{min}}-{{max}}).',
    chapitres: 'capítulos',
    chapitre: 'capítulo',

    // ── Welcome ──
    Commencer: 'Comenzar',
    'Bienvenue dans Wmb Table': 'Bienvenido a Wmb Table',
    'Votre espace pour lire, étudier et préparer vos prédications.':
        'Su espacio para leer, estudiar y preparar sus predicaciones.',
    'Prédications et Bible': 'Predicaciones y Biblia',
    'Ouvrez les prédications et la Bible dans des onglets, naviguez par paragraphe.':
        'Abra las predicaciones y la Biblia en pestañas, navegue por párrafo.',
    'Prenez des notes, classez vos passages par sujets avec des références.':
        'Tome notas, organice sus pasajes por tema con referencias.',
    'Recherche complète': 'Búsqueda completa',
    'Recherchez dans le contenu des prédications, la Bible et vos documents.':
        'Busque dentro del contenido de las predicaciones, la Biblia y sus documentos.',
    'Surlignez les passages importants avec des couleurs et retrouvez-les facilement.':
        'Resalte los pasajes importantes con colores y encuéntrelos fácilmente.',
    'Écoutez les prédications avec plusieurs voix disponibles.':
        'Escuche las predicaciones con varias voces disponibles.',
    'Posez des questions et obtenez des réponses avec des références cliquables.':
        'Haga preguntas y obtenga respuestas con referencias clicables.',

    // ── Theme ──
    Apparence: 'Apariencia',
    'Taille du texte': 'Tamaño del texto',
    "Langue de l'interface": 'Idioma de la interfaz',
    "Détermine la langue des menus, boutons et messages de l'application.":
        'Controla el idioma de menús, botones y mensajes de la aplicación.',
    Automatique: 'Automático',
    Petit: 'Pequeño',
    Normal: 'Normal',
    Grand: 'Grande',
    'Très grand': 'Muy grande',
    Clair: 'Claro',
    Sombre: 'Oscuro',
    Système: 'Sistema',
    'Utilise le thème clair en journée et le thème sombre le soir.':
        'Usa el tema claro durante el día y el tema oscuro por la noche.',
    "Suit automatiquement l'apparence définie par votre système.":
        'Sigue automáticamente la apariencia definida por su sistema.',
    'Utilise toujours le thème clair.': 'Usa siempre el tema claro.',
    'Utilise toujours le thème sombre.': 'Usa siempre el tema oscuro.',

    // ── Inline help ──
    'Comprendre cette page': 'Entender esta página',
    'Regroupez vos versets et passages par thème.': 'Agrupe sus versículos y pasajes por tema.',
    'À quoi servent les sujets ?': '¿Para qué sirven los temas?',
    "Les sujets rassemblent des versets, passages de prédications et extraits de documents autour d'un même thème.":
        'Los temas reúnen versículos, pasajes de predicaciones y extractos de documentos alrededor de un mismo tema.',
    'Créez un sujet pour chaque thème important que vous préparez.':
        'Cree un tema para cada asunto importante que esté preparando.',
    'Ajoutez des références depuis la lecture ou depuis la Bible.':
        'Añada referencias desde la lectura o desde la Biblia.',
    "Réorganisez les références dans l'ordre qui vous aide le mieux.":
        'Reorganice las referencias en el orden que más le ayude.',
    'Utilisez plutôt les notes pour écrire vos idées longues, vos plans et vos commentaires personnels.':
        'Use más bien las notas para escribir sus ideas largas, esquemas y comentarios personales.',
    'Gardez vos plans, idées et références dans un seul endroit.':
        'Guarde sus esquemas, ideas y referencias en un solo lugar.',
    'À quoi servent les notes ?': '¿Para qué sirven las notas?',
    'Les notes gardent vos idées, plans et repères de préparation dans un seul endroit.':
        'Las notas guardan sus ideas, esquemas y referencias de preparación en un solo lugar.',
    'Créez une note par message, étude ou projet.':
        'Cree una nota por mensaje, estudio o proyecto.',
    'Ajoutez des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'Añada referencias hacia la Biblia o las predicaciones para encontrar la fuente más tarde.',
    'Utilisez les sujets pour classer des références, et les notes pour développer votre pensée.':
        'Use los temas para clasificar referencias y las notas para desarrollar su pensamiento.',
    'Que fait cette page Bible ?': '¿Qué hace esta página de Biblia?',
    'Cette page sert surtout à rechercher dans la Bible et à gérer les versions bibliques.':
        'Esta página sirve sobre todo para buscar en la Biblia y gestionar las versiones bíblicas.',
    'Retrouvez vite un mot, une expression ou un passage biblique.':
        'Encuentre rápidamente una palabra, una expresión o un pasaje bíblico.',
    'Filtrez la recherche par testament pour aller plus vite.':
        'Filtre la búsqueda por testamento para ir más rápido.',
    'Comparez ou téléchargez des versions bibliques selon vos besoins.':
        'Compare o descargue versiones bíblicas según sus necesidades.',
    'Par rapport à la Bible dans la barre latérale':
        'En comparación con la Biblia en la barra lateral',
    'La barre latérale est plus adaptée pour ouvrir et lire un chapitre. Cette page est plus utile pour la recherche et la gestion des versions.':
        'La barra lateral se adapta mejor para abrir y leer un capítulo. Esta página es más útil para la búsqueda y la gestión de versiones.',
    'À quoi servent les réglages de Lecture audio ?':
        '¿Para qué sirven los ajustes de Texto a voz?',
    'Cet onglet configure la voix qui lira vos prédications, chapitres bibliques et documents personnels.':
        'Esta pestaña configura la voz que leerá sus predicaciones, capítulos bíblicos y documentos personales.',
    'Choisissez un fournisseur et une voix.': 'Elija un proveedor y una voz.',
    'Testez la lecture et ajustez la vitesse.': 'Pruebe la lectura y ajuste la velocidad.',
    "Réglez le surlignage, l'introduction et le cache audio.":
        'Ajuste el resaltado, la introducción y la caché de audio.',
    'Si vous voulez quelque chose de simple, gardez le fournisseur proposé puis testez une voix.':
        'Si quiere algo sencillo, mantenga el proveedor propuesto y luego pruebe una voz.',
    "À quoi servent les réglages de l'assistant ?": '¿Para qué sirven los ajustes del asistente?',
    "Cet onglet active l'assistant IA et choisit comment il répond dans l'application.":
        'Esta pestaña activa el asistente de IA y define cómo responde en la aplicación.',
    "Activez ou masquez l'assistant dans la barre latérale.":
        'Active u oculte el asistente en la barra lateral.',
    'Sélectionnez un fournisseur local, cloud ou personnalisé.':
        'Seleccione un proveedor local, en la nube o personalizado.',
    'Définissez la langue et le modèle utilisés pour les réponses.':
        'Defina el idioma y el modelo usados para las respuestas.',
    'Comment fonctionne la recherche ?': '¿Cómo funciona la búsqueda?',
    'Cette page recherche dans les prédications de votre bibliothèque et vous ramène directement au bon passage.':
        'Esta página busca en las predicaciones de su biblioteca y le lleva directamente al pasaje correcto.',
    'Entrez au moins trois caractères pour lancer une recherche.':
        'Introduzca al menos tres caracteres para iniciar una búsqueda.',
    'Choisissez le mode selon que vous cherchez un mot, plusieurs mots ou une phrase exacte.':
        'Elija el modo según busque una palabra, varias palabras o una frase exacta.',
    'Ouvrez un résultat pour aller directement au paragraphe correspondant.':
        'Abra un resultado para ir directamente al párrafo correspondiente.',
    'Retrouvez rapidement un mot, une expression ou un thème dans les prédications.':
        'Encuentre rápidamente una palabra, una expresión o un tema en las predicaciones.',
    'À quoi servent les soulignages ?': '¿Para qué sirven los subrayados?',
    'Cette page rassemble tous les passages marqués pendant vos lectures.':
        'Esta página reúne todos los pasajes marcados durante sus lecturas.',
    'Retrouvez rapidement les passages importants que vous avez gardés.':
        'Recupere rápidamente los pasajes importantes que guardó.',
    'Filtrez par mot-clé dans le texte, le titre ou le commentaire.':
        'Filtre por palabra clave en el texto, el título o el comentario.',
    'Rouvrez le document exact ou exportez la liste en PDF.':
        'Vuelva a abrir el documento exacto o exporte la lista en PDF.',
    'Les soulignages se créent dans la vue de lecture, pas sur cette page.':
        'Los subrayados se crean en la vista de lectura, no en esta página.',
    'Revoyez tous les passages marqués pendant vos lectures.':
        'Revise todos los pasajes marcados durante sus lecturas.',
    'La Bible vous aide à ouvrir rapidement un chapitre dans la lecture, comparer les versions et retrouver un passage sans quitter votre préparation.':
        'La Biblia le ayuda a abrir rápidamente un capítulo en la lectura, comparar versiones y encontrar un pasaje sin salir de su preparación.',
    "Elle sert de point d'entrée vers la lecture biblique dans l'application.":
        'Sirve como punto de entrada hacia la lectura bíblica en la aplicación.',
    'Une fois le chapitre ouvert, vous profitez des outils de lecture du document.':
        'Una vez abierto el capítulo, aprovecha las herramientas de lectura del documento.',
    'Elle vous aide aussi à parcourir les livres, comparer les versions et lancer une recherche biblique dédiée.':
        'También le ayuda a recorrer los libros, comparar versiones y lanzar una búsqueda bíblica dedicada.',
    "C'est le chemin le plus direct pour ouvrir un livre ou un chapitre dans la vue de lecture.":
        'Es el camino más directo para abrir un libro o un capítulo en la vista de lectura.',
    'Utilisez cette page pour parcourir la Bible plus calmement.':
        'Use esta página para recorrer la Biblia con más calma.',
    'Utilisez la barre latérale pour ouvrir vite un chapitre. Utilisez cette page quand vous voulez explorer, comparer ou rechercher plus précisément.':
        'Use la barra lateral para abrir rápido un capítulo. Use esta página cuando quiera explorar, comparar o buscar con más precisión.',
    'Ce que cette fonction vous apporte': 'Lo que esta función le aporta',
    'Pour commencer': 'Para empezar',
    'Elle évite de refaire les mêmes recherches chaque fois que vous préparez un thème.':
        'Evita repetir las mismas búsquedas cada vez que prepara un tema.',
    'Elle garde ensemble vos meilleures références bibliques et vos passages de prédications.':
        'Mantiene juntas sus mejores referencias bíblicas y sus pasajes de predicaciones.',
    "Elle vous aide à construire un ordre clair pour l'étude, la prédication ou l'export PDF.":
        'Le ayuda a construir un orden claro para el estudio, la predicación o la exportación en PDF.',
    "Elle aide à organiser vos références dans un ordre utile pour l'étude, la prédication ou l'export PDF.":
        'Ayuda a organizar sus referencias en un orden útil para el estudio, la predicación o la exportación en PDF.',
    'Elle sert à développer votre pensée, vos plans et vos commentaires personnels.':
        'Sirve para desarrollar su pensamiento, sus esquemas y sus comentarios personales.',
    'Elle sert à développer vos idées, vos plans et vos commentaires personnels.':
        'Sirve para desarrollar sus ideas, sus esquemas y sus comentarios personales.',
    'Elle vous aide à garder vos idées de préparation dans un espace plus libre que les sujets.':
        'Le ayuda a guardar sus ideas de preparación en un espacio más libre que los temas.',
    'Elle vous offre un espace de préparation plus libre et plus personnel que les sujets.':
        'Le ofrece un espacio de preparación más libre y más personal que los temas.',
    'Elle peut aussi contenir des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'También puede contener referencias hacia la Biblia o las predicaciones para encontrar la fuente más tarde.',
    'Elle peut garder des références vers la Bible ou les prédications pour retrouver vos sources rapidement.':
        'Puede guardar referencias hacia la Biblia o las predicaciones para encontrar sus fuentes rápidamente.',
    'Elle vous permet de confirmer rapidement un passage, comparer des versets et garder la Bible dans votre flux de travail.':
        'Le permite confirmar rápidamente un pasaje, comparar versículos y mantener la Biblia dentro de su flujo de trabajo.',
    'Elle réunit la lecture, les versions bibliques et la recherche au même endroit.':
        'Reúne la lectura, las versiones bíblicas y la búsqueda en un mismo lugar.',
    "Elle permet d'écouter vos contenus au lieu de seulement les lire.":
        'Permite escuchar sus contenidos en lugar de solo leerlos.',
    'Elle est utile pour suivre un texte, relire pendant un déplacement ou continuer votre étude en audio.':
        'Es útil para seguir un texto, repasar durante un desplazamiento o continuar su estudio en audio.',
    "Elle contrôle aussi l'expérience de lecture: voix, vitesse, surlignage et comportement audio.":
        'También controla la experiencia de escucha: voz, velocidad, resaltado y comportamiento de audio.',
    "L'assistant peut aider à explorer un thème, retrouver des références et comparer plus vite plusieurs contenus.":
        'El asistente puede ayudar a explorar un tema, encontrar referencias y comparar varios contenidos más rápido.',
    "Cet onglet détermine s'il est disponible, quel service il utilise et dans quelle langue il travaille.":
        'Esta pestaña determina si está disponible, qué servicio usa y en qué idioma trabaja.',
    'Vous pouvez choisir une solution locale, cloud ou personnalisée selon vos besoins.':
        'Puede elegir una solución local, en la nube o personalizada según sus necesidades.',
    "Activez l'assistant pour le rendre disponible dans la barre latérale.":
        'Active el asistente para hacerlo disponible en la barra lateral.',
    'Elle sert à retrouver rapidement un mot, un thème, un lieu ou une expression dans les prédications.':
        'Sirve para encontrar rápidamente una palabra, un tema, un lugar o una expresión en las predicaciones.',
    'Elle évite de parcourir manuellement plusieurs documents quand vous savez déjà ce que vous cherchez.':
        'Evita recorrer manualmente varios documentos cuando ya sabe lo que está buscando.',
    'Elle vous ramène directement au paragraphe utile quand vous ouvrez un résultat.':
        'Le lleva directamente al párrafo útil cuando abre un resultado.',
    'Elle vous donne une vue unique de tous les passages importants que vous avez repérés.':
        'Le ofrece una vista única de todos los pasajes importantes que ha marcado.',
    'Elle aide à revoir vos découvertes sans devoir rouvrir chaque document un par un.':
        'Ayuda a revisar sus hallazgos sin tener que reabrir cada documento uno por uno.',
    'Elle permet aussi de filtrer, rouvrir la source exacte ou exporter la liste en PDF.':
        'También permite filtrar, reabrir la fuente exacta o exportar la lista en PDF.',
};

export default es;
