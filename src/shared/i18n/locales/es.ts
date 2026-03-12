const es: Record<string, string> = {
    // ── Sidebar menu ──
    Historique: 'Historial',
    Recherche: 'Búsqueda',
    Sujets: 'Temas',
    Notes: 'Notas',
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
    Gérer: 'Gestionar',
    Alphabet: 'Alfabeto',
    Année: 'Año',
    Années: 'Años',
    'A-Z': 'A-Z',

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
    'Rapide et léger, idéal pour la recherche et les réponses courtes.':
        'Rápido y ligero, ideal para búsquedas y respuestas cortas.',
    'Polyvalent, adapté aux réponses courtes et au travail hors ligne.':
        'Versátil, adecuado para respuestas cortas y trabajo sin conexión.',

    // ── AI custom providers ──
    'Fournisseurs personnalisés': 'Proveedores personalizados',
    'Ajouter un fournisseur': 'Añadir un proveedor',
    'Ajoutez un service compatible OpenAI API.': 'Añada un servicio compatible con OpenAI API.',
    'Aucun fournisseur personnalisé.': 'Ningún proveedor personalizado.',
    'Supprimer ce fournisseur ?': '¿Eliminar este proveedor?',
    'ex: mon-service': 'ej.: mi-servicio',
    'ex: gpt-4o-mini': 'ej.: gpt-4o-mini',

    // ── AI chat ──
    "L'assistant IA est désactivé.": 'El asistente IA está desactivado.',
    'Ouvrir les paramètres': 'Abrir configuración',
    'Posez votre question...': 'Haga su pregunta...',
    Envoyer: 'Enviar',
    Arrêter: 'Detener',
    Conversations: 'Conversaciones',
    'Aucune conversation': 'Sin conversaciones',
    Conversation: 'Conversación',
    maintenant: 'ahora',
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
    'Langues disponibles': 'Idiomas disponibles',
    'Documents personnalisés': 'Documentos personalizados',
    'Lecture du document': 'Lectura del documento',

    // ── General tab ──
    'Langue active': 'Idioma activo',
    'Langues installées': 'Idiomas instalados',
    "Documentation d'utilisation": 'Documentación de uso',
    "Impossible d'ouvrir la documentation": 'No se puede abrir la documentación',
    Actif: 'Activo',
    'En pause': 'En pausa',
    'Non connecté': 'No conectado',
    'À jour': 'Actualizado',
    Ouvrir: 'Abrir',

    // ── Languages tab ──
    'Changer la langue': 'Cambiar idioma',
    'Aucune langue installée': 'Ningún idioma instalado',

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
    'Lecture automatique': 'Reproducción automática',
    "Démarrer la lecture automatiquement à l'ouverture d'un document.":
        'Iniciar la lectura automáticamente al abrir un documento.',
    'Cache audio': 'Caché de audio',
    'Les lectures passées sont conservées pour une relecture plus rapide.':
        'Las lecturas anteriores se conservan para una reproducción más rápida.',
    Utilisé: 'Usado',
    Limite: 'Límite',
    Vider: 'Vaciar',
    'Cache audio vidé': 'Caché de audio vaciado',
    'Taille maximale du cache': 'Tamaño máximo del caché',

    // ── TTS shared ──
    'Navigateur (SpeechSynthesis)': 'Navegador (SpeechSynthesis)',
    'Sherpa-ONNX TTS (local)': 'Sherpa-ONNX TTS (local)',
    'Kokoro TTS (local)': 'Kokoro TTS (local)',
    'ElevenLabs TTS': 'ElevenLabs TTS',
    'OpenAI TTS': 'OpenAI TTS',
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
    Local: 'Local',
    Cloud: 'Nube',
    o: 'B',
    Ko: 'KB',
    Mo: 'MB',

    // ── TTS provider browser ──
    Voix: 'Voz',
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
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'No hay voces disponibles para el idioma activo. Use la búsqueda anterior para encontrar una voz en otro idioma.',

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

    // ── TTS provider OpenAI ──
    'Clé API OpenAI': 'Clave API OpenAI',
    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Su clave secreta de OpenAI. Se almacena de forma segura en su ordenador.',
    'Le choix par défaut offre la meilleure qualité.':
        'La opción predeterminada ofrece la mejor calidad.',
    'Marin et Cedar sont recommandées pour la meilleure qualité.':
        'Marin y Cedar son recomendadas para la mejor calidad.',

    // ── TTS controls ──
    'Pause lecture': 'Pausar lectura',
    'Reprendre la lecture': 'Reanudar lectura',
    'Démarrer la lecture': 'Iniciar lectura',
    'Lire à voix haute': 'Leer en voz alta',
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
    'Sujet créé': 'Tema creado',
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
    'Synchronisation activée': 'Sincronización activada',
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

    // ── Language manager modal ──
    'Supprimer cette langue ?': '¿Eliminar este idioma?',
    'Les données de cette langue seront supprimées du disque.':
        'Los datos de este idioma se eliminarán del disco.',
    Supprimer: 'Eliminar',
    Annuler: 'Cancelar',
    'Langue téléchargée avec succès': 'Idioma descargado con éxito',
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

    // ── Other traductions modal ──
    'Traductions du document: {{title}}': 'Traducciones del documento: {{title}}',
    'Sources de traduction': 'Fuentes de traducción',
    'Traduction {{id}}': 'Traducción {{id}}',
    'Basculer vers cette traduction': 'Cambiar a esta traducción',
    'Autres langues': 'Otros idiomas',
    'Langue: {{code}}': 'Idioma: {{code}}',
    'Ouvrir le document': 'Abrir documento',

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
    'Session Google expirée. Veuillez vous reconnecter dans les paramètres de sauvegarde.':
        'Sesión de Google expirada. Reconéctese en la configuración de copia de seguridad.',

    // ── Layout ──
    'Chargement des données...': 'Cargando datos...',
    'Synchronisation en cours...': 'Sincronizando...',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Seleccione un párrafo',
    'Aucun paragraphe': 'Sin párrafos',

    // ── Sermon paragraph ──
    'Surlignage supprimé': 'Resaltado eliminado',
    'Erreur lors de la suppression': 'Error al eliminar',
    'Supprimer le surlignage': 'Eliminar resaltado',

    // ── Sermon header ──
    Pause: 'Pausa',
    Écouter: 'Escuchar',
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
    'Nouveau Testament': 'Nuevo Testamento',
    'Ancien Testament': 'Antiguo Testamento',
    'Faites vos recherches biblique ici': 'Busque en la Biblia aquí',
    Testaments: 'Testamentos',
    'Trouvé dans {{count}} verset': 'Encontrado en {{count}} versículo',
    'Trouvé dans {{count}} versets': 'Encontrado en {{count}} versículos',

    // ── Bible content ──
    'Aucune Bible disponible pour cette langue': 'No hay Biblia disponible para este idioma',
    Ancien: 'Antiguo',
    Testament: 'Testamento',
    'Ajouter à un sujet': 'Añadir a un tema',

    // ── Notes ──
    'Erreur lors du chargement des notes': 'Error al cargar las notas',
    'Note supprimée': 'Nota eliminada',
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
    'Basculer en plein écran': 'Pantalla completa',
    Aide: 'Ayuda',
    Documentation: 'Documentación',
    'À propos': 'Acerca de',

    // ── General ──
    sermons: 'sermones',
    disponible: 'disponible',
    "Erreur lors de l'initialisation de l'application": 'Error de inicialización de la aplicación',
    'Une erreur inattendue est survenue.': 'Se produjo un error inesperado.',
    'Mémoriser la position de lecture': 'Recordar la posición de lectura',
    "Rouvrez un document là où vous l'aviez laissé la dernière fois.":
        'Reabra un documento donde lo dejó la última vez.',
    "Impossible d'enregistrer le paramètre": 'No se pudo guardar la configuración',
    chapitres: 'capítulos',
    chapitre: 'capítulo',
};

export default es;
