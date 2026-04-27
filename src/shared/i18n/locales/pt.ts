const pt: Record<string, string> = {
    // ── Sidebar menu ──
    Historique: 'Histórico',
    Recherche: 'Pesquisar',
    Sujets: 'Assuntos',
    Notes: 'Notas',
    Soulignages: 'Destaques',
    'Aucun soulignage': 'Nenhum destaque',
    'Supprimer ce soulignage ?': 'Excluir este destaque?',
    'Soulignage supprimé': 'Destaque excluído',
    'Erreur lors du chargement des soulignages': 'Erro ao carregar os destaques',
    'Charger plus': 'Carregar mais',
    Paramètres: 'Configurações',

    // ── Viewer menu ──
    Outils: 'Ferramentas',
    Lecture: 'Leitura',

    // ── Sidebar documents ──
    Prédications: 'Sermões',
    Bible: 'Bíblia',
    Documents: 'Documentos',
    'Aucun document ajouté': 'Nenhum documento adicionado',
    'Ajouter un document': 'Adicionar um documento',
    'Choisir un document': 'Escolher um documento',
    'Mes documents': 'Meus documentos',
    Gérer: 'Gerenciar',
    'Gérer mes documents': 'Gerenciar meus documentos',
    Alphabet: 'Alfabeto',
    Année: 'Ano',
    Années: 'Anos',
    'A-Z': 'A-Z',
    'Formats pris en charge : PDF, TXT, MD, DOCX, EPUB.':
        'Formatos suportados: PDF, TXT, MD, DOCX, EPUB.',
    'Importer un document': 'Importar um documento',
    'Document importé dans la note': 'Documento importado para a nota',
    'Cette note contient déjà du contenu.': 'Esta nota já contém conteúdo.',
    'Note introuvable.': 'Nota não encontrada.',
    "Erreur lors de l'import du document.": 'Erro ao importar o documento.',
    'Format de document non pris en charge.': 'Formato de documento não suportado.',
    'Le fichier est trop volumineux.': 'O arquivo é grande demais.',

    // ── Settings index ──
    Général: 'Geral',
    'Vue document': 'Visualização do documento',
    Langues: 'Idiomas',
    'Lecture audio': 'Leitura em voz alta',
    Sauvegarde: 'Backup',
    'Mise à jour': 'Atualização',
    'Gérez les préférences de votre application.': 'Gerencie as preferências do seu aplicativo.',
    Assistant: 'Assistente',
    'Assistant IA': 'Assistente de IA',
    "Activer l'assistant IA": 'Ativar o assistente de IA',
    "Une fois activé, l'assistant apparaît dans la barre latérale.":
        'Depois de ativado, o assistente aparece na barra lateral.',
    'Clé API': 'Chave de API',
    'URL de base': 'URL base',
    Modèle: 'Modelo',
    Identifiant: 'Identificador',
    'Nom affiché': 'Nome exibido',
    Optionnel: 'Opcional',
    'Modèle par défaut': 'Modelo padrão',
    Recommandé: 'Recomendado',
    Installé: 'Instalado',
    Nouveau: 'Novo',

    // ── AI settings ──
    'Choisissez le service à utiliser pour le chat IA.':
        'Escolha o serviço a ser usado para o chat de IA.',
    'Choisir un fournisseur': 'Escolher um provedor',
    Personnalisé: 'Personalizado',
    'Comportement des langues': 'Comportamento dos idiomas',
    "L'assistant suit la langue active, sauf si vous demandez explicitement une autre langue.":
        'O assistente segue o idioma do conteúdo, a menos que você peça explicitamente outro.',
    'Suivre la langue active': 'Seguir o idioma ativo',
    'Changer uniquement sur demande': 'Mudar somente quando solicitado',
    "Utilisez l'identifiant exact du modèle fourni par ce service.":
        'Use o identificador exato do modelo fornecido por este serviço.',

    // ── AI provider descriptions ──
    'Fonctionne sans connexion internet, directement sur votre ordinateur.':
        'Funciona sem conexão com a internet, diretamente no seu computador.',
    'Accédez à plusieurs modèles avec une seule clé API.':
        'Acesse vários modelos com uma única chave de API.',
    'ChatGPT et autres modèles OpenAI.': 'ChatGPT e outros modelos OpenAI.',
    'Les modèles Gemini de Google.': 'Os modelos Gemini do Google.',
    "Les modèles Claude d'Anthropic.": 'Os modelos Claude da Anthropic.',

    // ── AI local models ──
    'Modèle local': 'Modelo local',
    Actualiser: 'Atualizar',
    'Choisir un modèle': 'Escolher um modelo',
    Utiliser: 'Usar',
    'Modèle téléchargé': 'Modelo baixado',
    'Le téléchargement a échoué.': 'O download falhou.',
    '~{{size}} Mo': '~{{size}} MB',
    'Léger et rapide. Idéal pour un usage quotidien sur la plupart des ordinateurs.':
        'Leve e rápido. Ideal para uso diário na maioria dos computadores.',
    'Plus complet, meilleure compréhension. Nécessite un peu plus de mémoire.':
        'Mais completo, melhor compreensão. Requer um pouco mais de memória.',
    'Fonctionne sans connexion internet, directement sur votre ordinateur. Téléchargez un modèle pour commencer.':
        'Funciona sem conexão com a internet, diretamente no seu computador. Baixe um modelo para começar.',
    'Le mode local est plus limité': 'O modo local é mais limitado',
    'Le mode local peut répondre plus lentement et avec moins de précision, surtout pour les questions longues ou difficiles.':
        'O modo local pode responder mais lentamente e com menos precisão, especialmente para perguntas longas ou difíceis.',
    'Utiliser la carte graphique (GPU)': 'Usar placa gráfica (GPU)',
    'Accélère les réponses si votre ordinateur possède une carte graphique compatible. Désactivez cette option en cas de problème.':
        'Acelera as respostas se o seu computador tiver uma placa gráfica compatível. Desative esta opção se houver problemas.',

    // ── AI custom providers ──
    'Ajouter un fournisseur': 'Adicionar um provedor',
    'Ajouter un fournisseur personnalisé': 'Adicionar um provedor personalizado',
    'Supprimer ce fournisseur ?': 'Excluir este provedor?',
    'Un fournisseur avec ce nom existe déjà.': 'Já existe um provedor com este nome.',
    'ex: Mon Service IA': 'ex.: Meu Serviço de IA',
    'ex: gpt-4o-mini': 'ex.: gpt-4o-mini',
    'Taille du contexte (tokens)': 'Tamanho do contexto (tokens)',

    // ── AI provider test ──
    'Tester la connexion': 'Testar conexão',
    Connecté: 'Conectado',
    Échec: 'Falha',
    'La connexion a échoué.': 'A conexão falhou.',
    'La clé API est manquante pour ce fournisseur.':
        'A chave de API está faltando para este provedor.',
    'Fournisseur IA inconnu.': 'Provedor de IA desconhecido.',
    'Validation du fournisseur impossible.': 'Não foi possível validar o provedor.',
    'Le mode local nécessite une langue par défaut et un moteur local actif.':
        'O modo local exige um idioma padrão e um mecanismo local ativo.',
    'La synthèse du navigateur est gérée dans le processus renderer.':
        'A síntese de voz do navegador é gerenciada no processo renderer.',
    'La prévisualisation du navigateur est gérée dans le processus renderer.':
        'A pré-visualização do navegador é gerenciada no processo renderer.',
    'Fournisseur TTS inconnu.': 'Provedor TTS desconhecido.',
    'Fournisseur TTS introuvable.': 'Provedor TTS não encontrado.',
    'Ce fournisseur ne prend pas en charge le téléchargement de modèles.':
        'Este provedor não oferece suporte ao download de modelos.',
    'Ce fournisseur ne prend pas en charge la suppression de modèles.':
        'Este provedor não oferece suporte à exclusão de modelos.',
    'Ce fournisseur ne prend pas en charge le clonage de voix.':
        'Este provedor não oferece suporte à clonagem de voz.',
    'Voix de référence introuvable.': 'Voz de referência não encontrada.',
    "La clé API OpenAI n'est pas configurée.": 'A chave de API da OpenAI não está configurada.',
    "La clé API ElevenLabs n'est pas configurée.":
        'A chave de API da ElevenLabs não está configurada.',
    "La clé API Cartesia n'est pas configurée.": 'A chave de API da Cartesia não está configurada.',
    "Aucune voix Cartesia n'est sélectionnée.": 'Nenhuma voz da Cartesia foi selecionada.',
    'La langue est requise pour cloner une voix Cartesia.':
        'O idioma é obrigatório para clonar uma voz da Cartesia.',
    'Le nom du modèle est requis pour le téléchargement Sherpa.':
        'O nome do modelo é obrigatório para o download do Sherpa.',
    'Modèle Sherpa inconnu.': 'Modelo Sherpa desconhecido.',

    // ── AI errors ──
    "L'assistant IA est désactivé dans les paramètres.":
        'O assistente de IA está desativado nas configurações.',
    'Aucun fournisseur IA configuré. Sélectionnez un fournisseur dans les paramètres.':
        'Nenhum provedor de IA configurado. Selecione um provedor nas configurações.',
    'Aucun modèle configuré pour ce fournisseur. Définissez un modèle dans les paramètres.':
        'Nenhum modelo configurado para este provedor. Defina um modelo nas configurações.',

    // ── AI chat ──
    "L'assistant IA est désactivé.": 'O assistente de IA está desativado.',
    'Ouvrir les paramètres': 'Abrir configurações',
    'Le saviez-vous ? <u>{{feature}}</u> peut vous aider à explorer un sujet et comprendre plus vite ce que vous cherchez.':
        'Você sabia? <u>{{feature}}</u> pode ajudar você a explorar um tema e entender mais rapidamente o que está procurando.',
    'Activez <u>{{feature}}</u> pour poser vos questions, approfondir un thème, comparer plusieurs prédications, retrouver des passages bibliques et obtenir des réponses claires sans tout parcourir manuellement.':
        'Ative <u>{{feature}}</u> para fazer perguntas, aprofundar um tema, comparar vários sermões, encontrar passagens bíblicas e obter respostas claras sem precisar percorrer tudo manualmente.',
    "Ouvrir les réglages de l'assistant": 'Abrir configurações do assistente',
    'Le saviez-vous ? <u>{{feature}}</u> peut lire vos documents.':
        'Você sabia? <u>{{feature}}</u> pode ler seus documentos em voz alta.',
    'Choisissez une voix pour <u>{{feature}}</u>, puis lancez la lecture directement depuis vos documents.':
        'Escolha uma voz para <u>{{feature}}</u> e depois inicie a leitura diretamente dos seus documentos.',
    'Ouvrir les réglages audio': 'Abrir configurações de áudio',
    'Le saviez-vous ? <u>{{feature}}</u> peut protéger vos données.':
        'Você sabia? <u>{{feature}}</u> pode proteger seus dados.',
    'Connectez Google Drive pour que <u>{{feature}}</u> garde vos notes, sujets et réglages synchronisés.':
        'Conecte o Google Drive para que <u>{{feature}}</u> mantenha suas notas, assuntos e configurações sincronizados.',
    'Ouvrir les réglages de sauvegarde': 'Abrir configurações de backup',
    'Posez votre question...': 'Faça sua pergunta...',
    'Posez votre question... ({{shortcut}} pour une nouvelle ligne)':
        'Faça sua pergunta... ({{shortcut}} para uma nova linha)',
    'Essayez une question pour commencer': 'Experimente uma pergunta para começar',
    'Suggère-moi un thème à étudier.': 'Sugira um tema para eu estudar.',
    'Aide-moi à formuler une question de recherche.':
        'Ajude-me a formular uma pergunta de pesquisa.',
    'Trouve-moi quelques références utiles sur un sujet.':
        'Encontre algumas referências úteis sobre um tema para mim.',
    'Compare plusieurs références sur un même sujet.':
        'Compare várias referências sobre o mesmo tema.',
    Envoyer: 'Enviar',
    Arrêter: 'Parar',
    '{{count}} message en attente': '{{count}} mensagem pendente',
    '{{count}} messages en attente': '{{count}} mensagens pendentes',
    'Ils seront envoyés dès que cette réponse se termine.':
        'Elas serão enviadas assim que esta resposta terminar.',
    "En attente d'envoi.": 'Aguardando envio.',
    "Ajoutez un message à la file d'attente...": 'Adicione uma mensagem à fila...',
    "Ajoutez un message à la file d'attente... ({{shortcut}} pour une nouvelle ligne)":
        'Adicione uma mensagem à fila... ({{shortcut}} para uma nova linha)',
    "Ajouter à la file d'attente": 'Adicionar à fila',
    'Retirer de la file': 'Remover da fila',
    'Maj+Entrée': 'Shift+Enter',
    Conversations: 'Conversas',
    'Aucune conversation': 'Nenhuma conversa',
    'Aucun sujet': 'Nenhum assunto',
    'Sélectionner ou saisir un modèle': 'Selecionar ou digitar um modelo',
    'Voir le raisonnement': 'Mostrar raciocínio',
    'Masquer le raisonnement': 'Ocultar raciocínio',
    '{{count}} dernières lignes': 'últimas {{count}} linhas',
    '+{{count}} autre': '+{{count}} outro',
    '+{{count}} autres': '+{{count}} outros',
    Conversation: 'Conversa',
    'Nom de la conversation': 'Nome da conversa',
    maintenant: 'agora',
    '{{count}}min': '{{count}}min',
    '{{count}}h': '{{count}}h',
    '{{count}}j': '{{count}}d',
    '{{count}}sem': '{{count}}sem',
    '{{count}}mois': '{{count}}mes',
    '{{count}}a': '{{count}}a',
    'Cette conversation est vide.': 'Esta conversa está vazia.',
    Vous: 'Você',
    'Créé le': 'Criado em',
    'Mis à jour le': 'Atualizado em',
    'Exporté le': 'Exportado em',
    'Réponse sans texte': 'Resposta sem texto',
    Réessayer: 'Tentar novamente',
    'Conversation introuvable.': 'Conversa não encontrada.',
    'Supprimer cette conversation ?': 'Excluir esta conversa?',
    'Supprimer toutes les conversations ?': 'Excluir todas as conversas?',
    "Vider l'historique": 'Limpar histórico',
    'La relance de la réponse a échoué.': 'Falha ao tentar novamente a resposta.',
    'La relance est disponible uniquement pour le dernier message utilisateur.':
        'A nova tentativa está disponível apenas para a última mensagem do usuário.',

    // ── AI tool results ──
    'Recherche de sermons': 'Pesquisa de sermões',
    'Lecture du sermon': 'Leitura do sermão',
    'Recherche dans le contenu': 'Pesquisa no conteúdo',
    'Versions de la Bible': 'Versões da Bíblia',
    'Passage biblique': 'Passagem bíblica',
    'Liste des sujets': 'Lista de assuntos',
    'Création de sujet': 'Criação de assunto',
    'Ajout au sujet': 'Adicionado ao assunto',
    'Liste des notes': 'Lista de notas',
    'Lecture de la note': 'Leitura da nota',
    'Création de note': 'Criação de nota',
    'Mise à jour de la note': 'Atualização da nota',
    'Ajout à la note': 'Adicionado à nota',
    'Recherche biblique': 'Pesquisa bíblica',
    'Recherche approfondie': 'Pesquisa aprofundada',
    'Langues disponibles': 'Idiomas disponíveis',
    'Documents personnalisés': 'Documentos personalizados',
    'Lecture du document': 'Leitura do documento',

    // ── General tab ──
    'Langue active': 'idioma do conteúdo',
    'Langue de la bibliothèque': 'Idioma da biblioteca',
    Bibliothèque: 'Biblioteca',
    'Langues installées': 'Idiomas instalados',
    "Documentation d'utilisation": 'Documentação do usuário',
    "Impossible d'ouvrir la documentation": 'Não foi possível abrir a documentação',
    Actif: 'Ativo',
    'En pause': 'Em pausa',
    'Non connecté': 'Não conectado',
    'À jour': 'Atualizado',
    Ouvrir: 'Abrir',

    // ── Library tab ──
    'Changer la langue': 'Mudar idioma',
    'Gérer la bibliothèque': 'Gerenciar biblioteca',
    'Aucune langue installée': 'Nenhum idioma instalado',
    'Bibliothèque vide': 'Biblioteca vazia',

    // ── TTS tab ──
    'Fournisseur actif': 'Provedor ativo',
    'Le service qui lira le texte à voix haute.': 'O serviço que lerá o texto em voz alta.',
    'Changer la voix automatiquement': 'Mudar voz automaticamente',
    'Choisir automatiquement une voix adaptée à la langue du document.':
        'Escolher automaticamente uma voz adequada ao idioma do documento.',
    'Mode de surlignage': 'Modo de destaque',
    'Choisissez comment le texte est mis en évidence pendant la lecture.':
        'Escolha como o texto será destacado durante a leitura.',
    Phrase: 'Frase',
    Paragraphe: 'Parágrafo',
    'Vitesse de lecture: {{rate}}x': 'Velocidade de leitura: {{rate}}x',
    'Pause entre les segments: {{gap}}s': 'Pausa entre segmentos: {{gap}}s',
    'Durée de la pause entre chaque phrase ou paragraphe lu.':
        'Duração da pausa entre cada frase ou parágrafo lido.',
    'Cache audio': 'Cache de áudio',
    'Les lectures passées sont conservées pour une relecture plus rapide.':
        'As leituras anteriores são mantidas em cache para uma reprodução mais rápida.',
    Utilisé: 'Usado',
    Limite: 'Limite',
    Vider: 'Limpar',
    'Cache audio vidé': 'Cache de áudio limpo',
    'Vider le cache audio ?': 'Limpar o cache de áudio?',
    'Toutes les lectures en mémoire seront supprimées.':
        'Todas as leituras em cache serão excluídas.',
    'Taille maximale du cache': 'Tamanho máximo do cache',

    // ── TTS enhanced reading ──
    'Lecture améliorée': 'Leitura aprimorada',
    "Lire l'introduction": 'Ler introdução',
    'Annonce le titre, la date et le lieu avant de commencer la lecture.':
        'Anuncia o título, a data e o local antes de iniciar a leitura.',
    'Annoncer les numéros': 'Anunciar números',
    'Annonce le numéro du verset ou du paragraphe avant de le lire.':
        'Anuncia o número do versículo ou do parágrafo antes da leitura.',
    'Lire tout le livre (Bible)': 'Ler o livro inteiro (Bíblia)',
    'Continue automatiquement au chapitre suivant après avoir terminé.':
        'Continua automaticamente para o próximo capítulo após terminar.',
    'Défiler automatiquement': 'Rolagem automática',
    'Fait défiler la page pour toujours voir le texte en cours de lecture.':
        'Rola a página para manter o texto lido sempre visível.',

    // ── TTS shared ──
    'Voix du système': 'Vozes do sistema',
    'Sherpa-ONNX TTS': 'Sherpa-ONNX TTS',
    'Kokoro TTS': 'Kokoro TTS',
    'ElevenLabs TTS': 'ElevenLabs TTS',
    'OpenAI TTS': 'OpenAI TTS',
    'Edge TTS (Microsoft)': 'Edge TTS (Microsoft)',
    'Gratuit, fonctionne sans connexion internet. Utilise les voix déjà installées sur votre ordinateur.':
        'Gratuito, funciona sem conexão com a internet. Usa as vozes já instaladas no seu computador.',
    'Gratuit, fonctionne sans connexion internet. Supporte de nombreuses langues et voix. Nécessite un premier téléchargement.':
        'Gratuito, funciona sem conexão com a internet. Suporta muitos idiomas e vozes. Requer um download inicial.',
    'Gratuit, fonctionne sans connexion internet. Bonne qualité, nécessite un premier téléchargement.':
        'Gratuito, funciona sem conexão com a internet. Boa qualidade, requer um download inicial.',
    'Excellente qualité. Permet de cloner votre voix. Nécessite un compte et une connexion internet.':
        'Excelente qualidade. Permite clonar sua voz. Requer uma conta e conexão com a internet.',
    'Excellente qualité, nombreuses langues disponibles. Nécessite un compte et une connexion internet.':
        'Excelente qualidade, muitos idiomas disponíveis. Requer uma conta e conexão com a internet.',
    'Gratuit, bonne qualité, nombreuses langues. Nécessite une connexion internet. Aucun compte requis.':
        'Gratuito, boa qualidade, muitos idiomas. Requer conexão com a internet. Nenhuma conta necessária.',
    Gratuit: 'Gratuito',
    Local: 'Local',
    Cloud: 'Nuvem',
    o: 'B',
    Ko: 'KB',
    Mo: 'MB',

    // ── TTS provider browser ──
    Voix: 'Voz',
    Volume: 'Volume',
    Version: 'Versão',
    'Tester la voix': 'Testar voz',
    'Les voix disponibles dépendent de celles installées sur votre ordinateur.':
        'As vozes disponíveis dependem das que estão instaladas no seu computador.',
    'Voix par défaut du système': 'Voz padrão do sistema',
    'Hauteur: {{value}}': 'Tom: {{value}}',
    'Ajuste la tonalité de la voix.': 'Ajusta o tom da voz.',
    'Volume: {{value}}%': 'Volume: {{value}}%',

    // ── TTS provider Kokoro ──
    'À télécharger une seule fois. Environ 160 Mo.': 'Baixe uma única vez. Aproximadamente 160 MB.',
    'Télécharger le modèle': 'Baixar modelo',
    'Toutes les voix sont disponibles. La voix par défaut correspond à la langue active.':
        'Todas as vozes estão disponíveis. A voz padrão corresponde ao idioma do conteúdo.',
    'Modèle Kokoro téléchargé': 'Modelo Kokoro baixado',
    'Erreur: {{error}}': 'Erro: {{error}}',
    'Erreur lors de la prévisualisation de la voix': 'Erro ao pré-visualizar a voz',
    "Impossible d'enregistrer les paramètres de Lecture audio.":
        'Não foi possível salvar as configurações de leitura em voz alta.',

    // ── TTS provider Sherpa ──
    'Voix disponible — {{lang}}': 'Voz disponível — {{lang}}',
    'Téléchargez une voix pour la langue active du document.':
        'Baixe uma voz para o idioma ativo do documento.',
    'Télécharger « {{name}} »': 'Baixar "{{name}}"',
    'Voix active': 'Voz ativa',
    'Voix installées ({{count}})': 'Vozes instaladas ({{count}})',
    'Ajouter une autre langue': 'Adicionar outro idioma',
    'Recherchez une langue ou un nom de voix.': 'Pesquise um idioma ou um nome de voz.',
    'Ex: arabe, portugais, swahili…': 'Ex.: árabe, português, suaíli…',
    'Aucun résultat': 'Nenhum resultado',
    'Voix installée': 'Voz instalada',
    'Voix supprimée': 'Voz removida',
    Télécharger: 'Baixar',
    Téléchargement: 'Baixando',
    Extraction: 'Extraindo',
    Finalisation: 'Finalizando',
    'Aucune voix disponible pour la langue active. Utilisez la recherche ci-dessus pour trouver une voix dans une autre langue.':
        'Nenhuma voz disponível para o idioma ativo. Use a pesquisa acima para encontrar uma voz em outro idioma.',
    // quality tags
    'Haute qualité': 'Alta qualidade',
    'Qualité moyenne': 'Qualidade média',
    'Qualité légère': 'Qualidade leve',
    Multilingue: 'Multilíngue',

    // ── TTS provider ElevenLabs ──
    'Clé API ElevenLabs': 'Chave de API da ElevenLabs',
    'Votre clé secrète ElevenLabs. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Sua chave secreta da ElevenLabs. Ela é armazenada com segurança no seu computador.',
    'Les voix marquées « cloné » sont vos voix personnalisées.':
        'As vozes marcadas como "clonada" são as suas vozes personalizadas.',
    'Le choix par défaut convient pour la plupart des usages.':
        'A opção padrão é adequada para a maioria dos usos.',
    'Paramètres avancés': 'Configurações avançadas',
    'Voix clonées': 'Vozes clonadas',
    'Vos voix personnalisées.': 'Suas vozes personalizadas.',
    'Cloner une voix': 'Clonar uma voz',
    'Enregistrez un audio WAV ou MP3 de 10 à 60 secondes pour créer votre propre voix.':
        'Grave um áudio WAV ou MP3 de 10 a 60 segundos para criar sua própria voz.',
    'Nom de la voix (ex: MaVoix)': 'Nome da voz (ex.: MinhaVoz)',
    'Choisir un fichier audio': 'Escolher um arquivo de áudio',
    Cloner: 'Clonar',
    'Voix clonée avec succès': 'Voz clonada com sucesso',
    'Voix clonée supprimée': 'Voz clonada excluída',
    'Voix de référence': 'Vozes de referência',
    'Voix intégrées pour le clonage vocal. Clonez-les pour les utiliser.':
        'Vozes integradas para clonagem de voz. Clone-as para usá-las.',
    Cloné: 'Clonada',
    'Erreur lors de la lecture': 'Erro de reprodução',

    // ── TTS provider Edge ──
    'Sélectionnez une voix parmi les centaines disponibles, classées par langue.':
        'Selecione uma voz entre as centenas disponíveis, classificadas por idioma.',

    // ── TTS provider OpenAI ──
    'Clé API OpenAI': 'Chave de API da OpenAI',
    'Votre clé secrète OpenAI. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Sua chave secreta da OpenAI. Ela é armazenada com segurança no seu computador.',
    'Le choix par défaut offre la meilleure qualité.': 'A opção padrão oferece a melhor qualidade.',
    'Marin et Cedar sont recommandées pour la meilleure qualité.':
        'Marin e Cedar são recomendadas para a melhor qualidade.',

    // ── TTS provider Cartesia ──
    'Cartesia TTS': 'Cartesia TTS',
    'Clé API Cartesia': 'Chave de API da Cartesia',
    'Votre clé secrète Cartesia. Elle est stockée en toute sécurité sur votre ordinateur.':
        'Sua chave secreta da Cartesia. Ela é armazenada com segurança no seu computador.',
    'Langue de la voix': 'Idioma da voz',
    "Sélectionnez la langue dans laquelle la voix clonée s'exprimera.":
        'Selecione o idioma em que a voz clonada falará.',
    'Sélectionnez une voix': 'Selecione uma voz',
    'Obtenir une clé API': 'Obter chave de API',

    // ── TTS controls ──
    'Pause lecture': 'Pausar leitura',
    'Reprendre la lecture': 'Retomar leitura',
    'Démarrer la lecture': 'Iniciar leitura',
    'Lire à voix haute': 'Ler em voz alta',
    'Pause voix': 'Pausar voz',
    'Reprendre la voix': 'Retomar voz',
    'Lecture audio indisponible': 'Leitura em voz alta indisponível',
    'Zoom arrière': 'Reduzir zoom',
    'Zoom avant': 'Aumentar zoom',
    "Lire à partir d'ici": 'Ler a partir daqui',
    'Aucune voix disponible pour cette langue.': 'Nenhuma voz disponível para este idioma.',

    // ── TTS compatibility messages ──
    "Ce fournisseur n'est pas configuré. Ajoutez une clé API dans les paramètres de Lecture audio.":
        'Este provedor não está configurado. Adicione uma chave de API nas configurações de leitura em voz alta.',
    "Le modèle vocal n'est pas téléchargé. Téléchargez-le dans les paramètres de Lecture audio.":
        'O modelo de voz não foi baixado. Baixe-o nas configurações de leitura em voz alta.',
    'Le modèle sélectionné ne prend pas en charge cette langue. Changez de modèle dans les paramètres de Lecture audio.':
        'O modelo selecionado não oferece suporte a este idioma. Mude o modelo nas configurações de leitura em voz alta.',
    'Ce fournisseur ne prend pas en charge cette langue.':
        'Este provedor não oferece suporte a este idioma.',
    'Ce fournisseur ne peut pas lire cette langue.': 'Este provedor não consegue ler este idioma.',
    'Le navigateur ne dispose pas de voix pour cette langue.':
        'O navegador não possui vozes para este idioma.',
    'La langue du document ne correspond pas à la langue active. Changez la langue dans les paramètres.':
        'O idioma do documento não corresponde ao idioma ativo. Altere o idioma nas configurações.',
    'La langue du document ne correspond pas à la langue active ({{language}}). Changez la langue dans les paramètres.':
        'O idioma do documento não corresponde ao idioma ativo ({{language}}). Altere o idioma nas configurações.',
    'Impossible de vérifier la compatibilité du fournisseur.':
        'Não foi possível verificar a compatibilidade do provedor.',
    'Connexion internet indisponible. Vérifiez votre connexion et réessayez.':
        'Sem conexão com a internet. Verifique sua conexão e tente novamente.',
    'La lecture audio a échoué. Vérifiez la configuration du fournisseur.':
        'A leitura em voz alta falhou. Verifique a configuração do provedor.',

    // ── History ──
    'Aucune historique': 'Nenhum histórico',

    // ── Search ──
    'Votre recherche doit comporter au moins trois caractères':
        'Sua pesquisa deve conter pelo menos três caracteres',
    'Erreur lors de la recherche': 'Erro durante a pesquisa',

    // ── Subject ──
    'Créer un sujet': 'Criar um assunto',
    'Nom sujet': 'Nome do assunto',
    Enregistrer: 'Salvar',
    'Erreur lors du chargement des sujets': 'Erro ao carregar os assuntos',
    'Erreur lors du chargement des éléments du sujet': 'Erro ao carregar os itens do assunto',
    'Erreur lors de la réorganisation des références':
        'Erro ao reorganizar as referências do assunto',
    'Sujet créé': 'Assunto criado',
    'Un sujet avec ce nom existe déjà.': 'Já existe um assunto com este nome.',
    'Sujet introuvable': 'Assunto não encontrado',
    'Renommer le sujet': 'Renomear assunto',
    'Sujet renommé': 'Assunto renomeado',
    Supprimé: 'Excluído',
    'Aucune référence trouvée dans le sujet: {{name}}':
        'Nenhuma referência encontrada no assunto: {{name}}',

    // ── Backup tab ──
    'Connectez-vous avec Google pour sauvegarder vos données sur Google Drive.':
        'Entre com o Google para fazer backup dos seus dados no Google Drive.',
    'Vos données seront restaurées automatiquement lors de la connexion.':
        'Seus dados serão restaurados automaticamente ao entrar.',
    'Connexion Google': 'Login com Google',
    'Synchronisation automatique': 'Sincronização automática',
    'Dernière synchronisation : {{time}}': 'Última sincronização: {{time}}',
    'Accès limité': 'Acesso limitado',
    "Reconnectez-vous et assurez-vous d'avoir autorisé l'accès demandé en cochant les cases qui s'afficheront.":
        'Entre novamente e certifique-se de autorizar o acesso solicitado marcando as opções que aparecerem.',
    'Erreur de synchronisation': 'Erro de sincronização',
    'Connexion réussie. Synchronisation en arrière-plan...':
        'Conexão bem-sucedida. Sincronizando em segundo plano...',
    "Une erreur s'est produite lors de la connexion, réessayez plus tard":
        'Ocorreu um erro durante o login, tente novamente mais tarde',
    "Connexion refusée : vous devez autoriser tous les accès demandés. Reconnectez-vous et cochez toutes les cases d'autorisation.":
        'Conexão recusada: você deve autorizar todos os acessos solicitados. Reconecte-se e marque todas as caixas de autorização.',
    'Synchronisation activée': 'Sincronização ativada',
    Déconnexion: 'Sair',
    'Se déconnecter de Google ?': 'Desconectar do Google?',
    'La synchronisation sera arrêtée et les données de connexion supprimées.':
        'A sincronização será interrompida e os dados de login serão excluídos.',
    'Vos données locales seront conservées.': 'Seus dados locais serão mantidos.',
    'Déconnexion réussie': 'Desconectado com sucesso',
    "Une erreur s'est produite lors de la déconnexion, réessayez plus tard":
        'Ocorreu um erro durante a saída, tente novamente mais tarde',
    'Vous êtes connecté maintenant et pouvez fermer cette page.':
        'Agora você está conectado e pode fechar esta página.',
    "L'autorisation a échoué. Veuillez réessayer depuis l'application.":
        'A autorização falhou. Tente novamente pelo aplicativo.',
    'Début de la récupération des données': 'Iniciando a recuperação dos dados',
    'Préparation de la restauration des données': 'Preparando a restauração dos dados',
    "Une erreur s'est produite lors de la restauration, veuillez réessayer plus tard":
        'Ocorreu um erro durante a restauração, tente novamente mais tarde',
    'Vos données ont été restaurées avec succès.': 'Seus dados foram restaurados com sucesso.',
    "Redémarrer l'application": 'Reiniciar o aplicativo',
    Restauration: 'Restauração',
    'de données': 'de dados',

    // ── Update tab ──
    "Mise à jour de l'application": 'Atualização do aplicativo',
    'Une nouvelle version est disponible. Cliquez sur le bouton ci-dessous pour démarrer le processus de mise à jour.':
        'Uma nova versão está disponível. Clique no botão abaixo para iniciar o processo de atualização.',
    'Téléchargement de la mise à jour': 'Baixando atualização',
    'Téléchargement terminé': 'Download concluído',
    "Veuillez cliquer sur le bouton d'installation ci-dessous pour installer la mise à jour.":
        'Clique no botão de instalação abaixo para instalar a atualização.',
    'Erreur !': 'Erro!',
    "Une erreur s'est produite lors de la mise à jour, veuillez réessayer plus tard.":
        'Ocorreu um erro durante a atualização, tente novamente mais tarde.',
    'Aucune mise à jour disponible': 'Nenhuma atualização disponível',
    "Vous utilisez déjà la dernière version de l'application.":
        'Você já está usando a versão mais recente do aplicativo.',
    Vérifier: 'Verificar',
    'Vérification des mises à jour...': 'Verificando atualizações...',
    'Mettre à jour': 'Atualizar',
    'Installer la mise à jour': 'Instalar atualização',
    'Mise à jour disponible': 'Atualização disponível',
    'La version {{version}} est disponible.': 'A versão {{version}} está disponível.',
    'Une nouvelle version est disponible.': 'Uma nova versão está disponível.',
    'Voir la mise à jour': 'Ver atualização',
    'Mise à jour prête': 'Atualização pronta',
    "La mise à jour a été téléchargée. Elle sera installée au prochain redémarrage, ou vous pouvez l'installer maintenant.":
        'A atualização foi baixada. Ela será instalada na próxima reinicialização, ou você pode instalá-la agora.',
    'Redémarrer et installer': 'Reiniciar e instalar',

    // ── Language manager modal ──
    'Supprimer cette langue ?': 'Excluir este idioma?',
    'Les données de cette langue seront supprimées du disque.':
        'Os dados deste idioma serão removidos do disco.',
    Supprimer: 'Excluir',
    Annuler: 'Cancelar',
    'Langue téléchargée avec succès': 'Idioma baixado com sucesso',
    'Langue mise à jour avec succès': 'Idioma atualizado com sucesso',
    'Téléchargez une langue pour commencer': 'Baixe um idioma para começar',
    'Rechercher une langue...': 'Pesquisar um idioma...',
    'Aucune langue trouvée': 'Nenhum idioma encontrado',
    'Mes langues': 'Meus idiomas',
    Disponibles: 'Disponíveis',
    'Échec de la sélection de la langue': 'Falha ao selecionar o idioma',
    'Langue supprimée': 'Idioma excluído',

    // ── Custom documents modal ──
    'Documents ajoutés': 'Documentos adicionados',
    'Erreur lors du chargement des documents': 'Erro ao carregar os documentos',
    'Rechercher...': 'Pesquisar...',
    Ajouter: 'Adicionar',
    'Nom du document': 'Nome do documento',
    'Ce nom existe déjà': 'Este nome já existe',
    'Seul le format PDF est pris en charge.': 'Somente o formato PDF é suportado.',
    'Un document avec ce nom existe déjà.': 'Já existe um documento com este nome.',
    'Choisir un fichier PDF': 'Escolher um arquivo PDF',
    'Document supprimé': 'Documento excluído',
    'Langue du document': 'Idioma do documento',
    'Langue modifiée': 'Idioma alterado',
    'Traitement...': 'Processando...',
    Retour: 'Voltar',
    "Erreur lors de l'extraction du document.": 'Erro ao extrair o documento.',
    'Document ajouté': 'Documento adicionado',

    // ── Highlight modal ──
    Souligner: 'Destacar',
    Couleur: 'Cor',
    Jaune: 'Amarelo',
    Vert: 'Verde',
    Bleu: 'Azul',
    'Vert clair': 'Verde claro',
    'Bleu ciel': 'Azul celeste',
    Rose: 'Rosa',
    Orange: 'Laranja',
    Violet: 'Violeta',
    Turquoise: 'Turquesa',
    Rouge: 'Vermelho',
    Menthe: 'Menta',
    Pêche: 'Pêssego',
    Lavande: 'Lavanda',
    Corail: 'Coral',
    Cyan: 'Ciano',
    Lime: 'Lima',
    Commentaire: 'Comentário',
    'Ajouter un commentaire (optionnel)': 'Adicionar um comentário (opcional)',
    'Surlignage enregistré': 'Destaque salvo',
    "Erreur lors de l'enregistrement": 'Erro ao salvar',

    // ── Document audio player ──
    'Langue: {{name}}': 'Idioma: {{name}}',

    // ── Bible version selector ──
    'Version:': 'Versão:',
    'Télécharger {{name}}': 'Baixar {{name}}',

    // ── Delete button ──
    'Confirmer la suppression?': 'Confirmar exclusão?',
    Oui: 'Sim',
    Non: 'Não',

    // ── Note references modal ──
    'Lier ce paragraphe à une référence de la note :':
        'Vincular este parágrafo a uma referência da nota:',
    "Aucune note n'est actuellement sélectionnée": 'Nenhuma nota está selecionada no momento',
    'Aucune référence disponible': 'Nenhuma referência disponível',
    'Lié à : {{title}}': 'Vinculado a: {{title}}',
    'Aucun document attribué': 'Nenhum documento atribuído',
    'Ajouter à cette référence': 'Adicionar a esta referência',
    'Ajouté à la note': 'Adicionado à nota',
    "Erreur lors de l'ajout à la note": 'Erro ao adicionar à nota',

    // ── Other traductions modal ──
    'Traductions du document: {{title}}': 'Traduções do documento: {{title}}',
    'Sources de traduction': 'Fontes de tradução',
    'Traduction {{id}}': 'Tradução {{id}}',
    'Basculer vers cette traduction': 'Alternar para esta tradução',
    'Autres langues': 'Outros idiomas',
    'Langue: {{code}}': 'Idioma: {{code}}',
    'Ouvrir le document': 'Abrir documento',
    'Aucune autre traduction disponible': 'Nenhuma outra tradução disponível',

    // ── Subject select modal ──
    'Choiser un sujet': 'Escolher um assunto',
    'Choisir un sujet': 'Escolher um assunto',
    'Ajouté au sujet': 'Adicionado ao assunto',
    "Erreur lors de l'ajout au sujet": 'Erro ao adicionar ao assunto',

    // ── Document tabs ──
    'Fermer tous les onglets': 'Fechar todas as abas',
    'Voulez-vous vraiment fermer tous les onglets ?': 'Você realmente deseja fechar todas as abas?',
    'Tout fermer': 'Fechar tudo',
    Fermer: 'Fechar',
    'Fermer les autres': 'Fechar as outras',
    'Fermer à droite': 'Fechar à direita',

    // ── Sync listener ──
    'Session Google expirée. Le compte a été déconnecté. Reconnectez-vous dans les paramètres de sauvegarde.':
        'A sessão do Google expirou. A conta foi desconectada. Reconecte-se nas configurações de backup.',

    // ── Layout ──
    'Chargement des données...': 'Carregando dados...',
    'Synchronisation en cours...': 'Sincronizando...',

    // ── Paragraph navigator modal ──
    'Sélectionnez un paragraphe': 'Selecione um parágrafo',
    'Aucun paragraphe': 'Nenhum parágrafo',
    'Sélectionnez un verset': 'Selecione um versículo',
    'Aucun verset': 'Nenhum versículo',

    // ── Sermon paragraph ──
    'Surlignage supprimé': 'Destaque excluído',
    'Erreur lors de la suppression': 'Erro ao excluir',
    'Supprimer le surlignage': 'Excluir destaque',

    // ── Sermon header ──
    Pause: 'Pausa',
    Écouter: 'Ouvir',
    "Écouter l'audio": 'Ouvir áudio',
    'Pause audio': 'Pausar áudio',
    Traductions: 'Traduções',
    Rechercher: 'Pesquisar',

    // ── Bible document view ──
    'Chapitre {{chapter}}': 'Capítulo {{chapter}}',
    'Chapitre précédent': 'Capítulo anterior',
    'Chapitre suivant': 'Próximo capítulo',

    // ── Search result list ──
    'Trouvé dans {{count}} document': 'Encontrado em {{count}} documento',
    'Trouvé dans {{count}} documents': 'Encontrado em {{count}} documentos',
    'page ({{current}}/{{total}})': 'página ({{current}}/{{total}})',
    'Aucun résultat trouvé': 'Nenhum resultado encontrado',

    // ── Bible search ──
    'Tous les testaments': 'Todos os testamentos',
    'Nouveau Testament': 'Novo Testamento',
    'Ancien Testament': 'Antigo Testamento',
    'Faites vos recherches biblique ici': 'Pesquise a Bíblia aqui',
    Testaments: 'Testamentos',
    'Trouvé dans {{count}} verset': 'Encontrado em {{count}} versículo',
    'Trouvé dans {{count}} versets': 'Encontrado em {{count}} versículos',

    // ── Bible content ──
    'Aucune Bible disponible pour cette langue': 'Nenhuma Bíblia disponível para este idioma',
    'Aucune version biblique active disponible.': 'Nenhuma versão bíblica ativa disponível.',
    Ancien: 'Antigo',
    Testament: 'Testamento',
    'Ajouter à un sujet': 'Adicionar a um assunto',

    // ── Notes ──
    'Erreur lors du chargement des notes': 'Erro ao carregar as notas',
    'Note supprimée': 'Nota excluída',
    'Note introuvable ou vide': 'Nota não encontrada ou vazia',
    'Aucun modèle Sherpa-ONNX installé': 'Nenhum modelo Sherpa-ONNX instalado',
    'Aucun modèle local GGUF trouvé dans ~/.wmb-table/ai-models.':
        'Nenhum modelo GGUF local encontrado em ~/.wmb-table/ai-models.',
    'Le modèle local n\u2019est pas chargé.': 'O modelo local não está carregado.',
    'Erreur lors de la création de la note': 'Erro ao criar a nota',
    'Nouvelle note': 'Nova nota',
    'Aucune note': 'Nenhuma nota',

    // ── Inline search bar ──
    'Aller au paragraphe': 'Ir para o parágrafo',

    // ── Langue label ──
    'Langue:': 'Idioma:',

    // ── Sermon content header ──
    'Date:': 'Data:',
    'Traduction:': 'Tradução:',

    // ── Search input ──
    'Au moins un mot': 'Pelo menos uma palavra',
    'Tous les mots': 'Todas as palavras',
    'Phrase exacte': 'Frase exata',
    'Faites vos recherches ici': 'Pesquise aqui',

    // ── Search result item ──
    '{{count}} correspondance': '{{count}} correspondência',
    '{{count}} correspondances': '{{count}} correspondências',
    'Voir moins': 'Ver menos',
    'Voir tout ({{count}})': 'Ver tudo ({{count}})',

    // ── Editor ──
    'Le nom entré est invalid': 'O nome inserido é inválido',
    Modifié: 'Modificado',
    Enregistré: 'Salvo',
    Alerte: 'Alerta',
    "Semble que votre note n'a pas de contenu, si vous continuez cette note sera inconsidérée et elle sera supprimée":
        'Parece que sua nota não tem conteúdo; se você continuar, essa nota será ignorada e será excluída',
    Continuer: 'Continuar',
    'Activer le mode lecture': 'Ativar modo de leitura',
    'Désactiver le mode lecture': 'Desativar modo de leitura',
    'Exporter au format PDF': 'Exportar em PDF',
    'Exporter en PDF': 'Exportar em PDF',
    "Erreur lors de l'export PDF": 'Erro ao exportar PDF',
    'PDF exporté avec succès': 'PDF exportado com sucesso',
    'La référence est invalide': 'A referência é inválida',
    'La référence biblique est invalide': 'A referência bíblica é inválida',
    'Référence supprimée': 'Referência excluída',
    'Cliquez droit sur une référence pour la supprimer':
        'Clique com o botão direito em uma referência para excluí-la',
    'Référence sermon: {{label}}': 'Referência de sermão: {{label}}',
    'Référence Bible: {{label}}': 'Referência bíblica: {{label}}',
    'Aucune sélection trouvée pour la référence': 'Nenhuma seleção encontrada para a referência',
    'Référence sermon': 'Referência de sermão',
    'Référence Bible': 'Referência bíblica',
    'Supprimer la référence': 'Excluir referência',
    Français: 'Francês',
    English: 'Inglês',

    // ── References modal ──
    'Référence: {{label}}': 'Referência: {{label}}',
    "Aucun document n'a été attribué pour cette référence":
        'Nenhum documento foi atribuído a esta referência',
    'Verset supprimé': 'Versículo excluído',
    'Le verset cliqué existe déjà dans la références !':
        'O versículo clicado já existe nas referências!',
    'Verset ajouté': 'Versículo adicionado',
    'Aucun verset sélectionné': 'Nenhum versículo selecionado',
    'Ajouter des versets': 'Adicionar versículos',

    // ── Error boundary ──
    "Une erreur inattendue s'est produite": 'Ocorreu um erro inesperado',
    "Recharger l'application": 'Recarregar o aplicativo',

    // ── Native menu ──
    '&Fichier': '&Arquivo',
    '&Fermer': '&Sair',
    Éditer: 'Editar',
    Défaire: 'Desfazer',
    Refaire: 'Refazer',
    Couper: 'Recortar',
    Copier: 'Copiar',
    Coller: 'Colar',
    'Tout sélectionner': 'Selecionar tudo',
    '&Vue': '&Visualizar',
    'Basculer la barre latérale': 'Alternar barra lateral',
    'Changer de menu': 'Mudar de menu',
    "Changer d'option": 'Mudar opção',
    'Mode lecture': 'Modo de leitura',
    'Quitter le mode lecture': 'Sair do modo de leitura',
    'Basculer en plein écran': 'Alternar tela cheia',
    Aide: 'Ajuda',
    Documentation: 'Documentação',
    'Nous contacter': 'Fale conosco',
    'À propos': 'Sobre',
    Produit: 'Produto',
    'Site web': 'Site',
    Auteur: 'Autor',
    Licence: 'Licença',
    "Aujourd'hui": 'Hoje',
    'Aucun document consulté ce jour': 'Nenhum documento aberto hoje',
    Renommer: 'Renomear',
    Traduction: 'Tradução',
    'Texte copié': 'Texto copiado',
    'Copier le texte sélectionné': 'Copiar o texto selecionado',
    'Impossible de copier le texte.': 'Não foi possível copiar o texto.',
    'Sélectionnez du texte à souligner': 'Selecione um texto para destacar',
    'Ajouter au sujet': 'Adicionar ao assunto',
    'Ajouter à la note': 'Adicionar à nota',
    'Trouver des prédications similaires': 'Encontrar sermões semelhantes',
    'Prédications similaires': 'Sermões semelhantes',
    'Aucune prédication similaire trouvée': 'Nenhum sermão semelhante encontrado',
    Prédication: 'Sermão',
    Document: 'Documento',
    Référence: 'Referência',
    'Sauvegarde de données': 'Fazendo backup dos dados',
    'Restauration de données': 'Restaurando dados',

    // ── General ──
    sermons: 'sermões',
    disponible: 'disponível',
    "Erreur lors de l'initialisation de l'application": 'Erro ao inicializar o aplicativo',
    'Une erreur inattendue est survenue.': 'Ocorreu um erro inesperado.',
    'Mémoriser la position de lecture': 'Lembrar posição de leitura',
    "Rouvrez un document là où vous l'aviez laissé la dernière fois.":
        'Reabra um documento no ponto em que você o deixou da última vez.',
    "Impossible d'enregistrer le paramètre": 'Não foi possível salvar a configuração',
    "Nombre maximum d'onglets": 'Número máximo de abas',
    'Les onglets les plus anciens seront fermés automatiquement lorsque la limite est atteinte ({{min}}-{{max}}).':
        'As abas mais antigas serão fechadas automaticamente quando o limite for atingido ({{min}}-{{max}}).',
    chapitres: 'capítulos',
    chapitre: 'capítulo',

    // ── Welcome ──
    Commencer: 'Começar',
    'Bienvenue dans Wmb Table': 'Bem-vindo ao Wmb Table',
    'Votre espace pour lire, étudier et préparer vos prédications.':
        'Seu espaço para ler, estudar e preparar seus sermões.',
    'Prédications et Bible': 'Sermões e Bíblia',
    'Ouvrez les prédications et la Bible dans des onglets, naviguez par paragraphe.':
        'Abra sermões e a Bíblia em abas e navegue por parágrafo.',
    'Prenez des notes, classez vos passages par sujets avec des références.':
        'Faça anotações, organize suas passagens por assuntos com referências.',
    'Recherche complète': 'Pesquisa completa',
    'Recherchez dans le contenu des prédications, la Bible et vos documents.':
        'Pesquise no conteúdo dos sermões, na Bíblia e nos seus documentos.',
    'Surlignez les passages importants avec des couleurs et retrouvez-les facilement.':
        'Destaque passagens importantes com cores e encontre-as facilmente.',
    'Écoutez les prédications avec plusieurs voix disponibles.':
        'Ouça os sermões com várias vozes disponíveis.',
    'Posez des questions et obtenez des réponses avec des références cliquables.':
        'Faça perguntas e obtenha respostas com referências clicáveis.',

    // ── Theme ──
    Apparence: 'Aparência',
    'Taille du texte': 'Tamanho do texto',
    "Langue de l'interface": 'Idioma da interface',
    "Détermine la langue des menus, boutons et messages de l'application.":
        'Define o idioma dos menus, botões e mensagens do aplicativo.',
    "Automatique suit la langue active de la bibliothèque quand elle est disponible pour l'interface.":
        'Automático segue o idioma ativo da biblioteca quando ele está disponível para a interface.',
    'Langue active de la bibliothèque : {{libraryLanguage}}.':
        'Idioma ativo da biblioteca: {{libraryLanguage}}.',
    "Langue de l'interface actuelle : {{uiLanguage}}.":
        'Idioma atual da interface: {{uiLanguage}}.',
    "Comme la langue active de la bibliothèque n'est pas prise en charge pour l'interface, l'application utilise {{fallbackLanguage}}.":
        'Como o idioma ativo da biblioteca não é suportado para a interface, o aplicativo usa {{fallbackLanguage}}.',
    "Aucune langue de bibliothèque n'est définie pour le moment.":
        'Nenhum idioma de biblioteca está definido no momento.',
    "L'interface est verrouillée sur {{uiLanguage}}.": 'A interface está fixa em {{uiLanguage}}.',
    'La langue active de la bibliothèque est aussi {{libraryLanguage}}.':
        'O idioma ativo da biblioteca também é {{libraryLanguage}}.',
    "Utilisez Automatique si vous voulez garder la langue de l'interface synchronisée avec la langue active de la bibliothèque.":
        'Use Automático se quiser manter o idioma da interface sincronizado com o idioma ativo da biblioteca.',
    'Automatique suit la langue active de la bibliothèque. Actuellement : {{uiLanguage}}.':
        'Automático segue o idioma ativo da biblioteca. Atualmente: {{uiLanguage}}.',
    "La langue active de la bibliothèque, {{libraryLanguage}}, n'est pas disponible pour l'interface. L'application utilise {{fallbackLanguage}}.":
        'O idioma ativo da biblioteca, {{libraryLanguage}}, não está disponível para a interface. O aplicativo usa {{fallbackLanguage}}.',
    'Automatique utilise actuellement {{uiLanguage}}.':
        'Automático está usando {{uiLanguage}} no momento.',
    "L'interface est fixée sur {{uiLanguage}}. Utilisez Automatique pour la garder synchronisée avec la bibliothèque.":
        'A interface está fixa em {{uiLanguage}}. Use Automático para mantê-la sincronizada com a biblioteca.',
    "L'interface est fixée sur {{uiLanguage}}. Bibliothèque : {{libraryLanguage}}.":
        'A interface está fixa em {{uiLanguage}}. Biblioteca: {{libraryLanguage}}.',
    "L'interface est fixée sur {{uiLanguage}}.": 'A interface está fixa em {{uiLanguage}}.',
    Automatique: 'Automático',
    Petit: 'Pequeno',
    Normal: 'Normal',
    Grand: 'Grande',
    'Très grand': 'Muito grande',
    Clair: 'Claro',
    Sombre: 'Escuro',
    Système: 'Sistema',
    'Utilise le thème clair en journée et le thème sombre le soir.':
        'Usa o tema claro durante o dia e o tema escuro à noite.',
    "Suit automatiquement l'apparence définie par votre système.":
        'Segue automaticamente a aparência definida pelo seu sistema.',
    'Utilise toujours le thème clair.': 'Usa sempre o tema claro.',
    'Utilise toujours le thème sombre.': 'Usa sempre o tema escuro.',

    // ── Inline help ──
    'Comprendre cette page': 'Entender esta página',
    'Regroupez vos versets et passages par thème.': 'Agrupe seus versículos e passagens por tema.',
    'À quoi servent les sujets ?': 'Para que servem os assuntos?',
    "Les sujets rassemblent des versets, passages de prédications et extraits de documents autour d'un même thème.":
        'Os assuntos reúnem versículos, trechos de sermões e extratos de documentos em torno do mesmo tema.',
    'Créez un sujet pour chaque thème important que vous préparez.':
        'Crie um assunto para cada tema importante que você está preparando.',
    'Ajoutez des références depuis la lecture ou depuis la Bible.':
        'Adicione referências a partir da leitura ou da Bíblia.',
    "Réorganisez les références dans l'ordre qui vous aide le mieux.":
        'Reorganize as referências na ordem que mais ajuda você.',
    'Utilisez plutôt les notes pour écrire vos idées longues, vos plans et vos commentaires personnels.':
        'Use as notas para escrever ideias mais longas, esboços e comentários pessoais.',
    'Gardez vos plans, idées et références dans un seul endroit.':
        'Guarde seus esboços, ideias e referências em um só lugar.',
    'À quoi servent les notes ?': 'Para que servem as notas?',
    'Les notes gardent vos idées, plans et repères de préparation dans un seul endroit.':
        'As notas guardam suas ideias, esboços e referências de preparação em um só lugar.',
    'Créez une note par message, étude ou projet.':
        'Crie uma nota por mensagem, estudo ou projeto.',
    'Ajoutez des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'Adicione referências para a Bíblia ou para os sermões para reencontrar a fonte depois.',
    'Utilisez les sujets pour classer des références, et les notes pour développer votre pensée.':
        'Use os assuntos para organizar referências e as notas para desenvolver seu pensamento.',
    'Que fait cette page Bible ?': 'O que faz esta página da Bíblia?',
    'Cette page sert surtout à rechercher dans la Bible et à gérer les versions bibliques.':
        'Esta página serve principalmente para pesquisar na Bíblia e gerenciar versões bíblicas.',
    'Retrouvez vite un mot, une expression ou un passage biblique.':
        'Encontre rapidamente uma palavra, uma expressão ou uma passagem bíblica.',
    'Filtrez la recherche par testament pour aller plus vite.':
        'Filtre a pesquisa por testamento para ir mais rápido.',
    'Comparez ou téléchargez des versions bibliques selon vos besoins.':
        'Compare ou baixe versões bíblicas conforme suas necessidades.',
    'Par rapport à la Bible dans la barre latérale': 'Em comparação com a Bíblia na barra lateral',
    'La barre latérale est plus adaptée pour ouvrir et lire un chapitre. Cette page est plus utile pour la recherche et la gestion des versions.':
        'A barra lateral é mais adequada para abrir e ler um capítulo. Esta página é mais útil para pesquisa e gerenciamento de versões.',
    'À quoi servent les réglages de Lecture audio ?':
        'Para que servem as configurações de Leitura em áudio?',
    'Cet onglet configure la voix qui lira vos prédications, chapitres bibliques et documents personnels.':
        'Esta aba configura a voz que lerá seus sermões, capítulos bíblicos e documentos pessoais.',
    'Choisissez un fournisseur et une voix.': 'Escolha um provedor e uma voz.',
    'Testez la lecture et ajustez la vitesse.': 'Teste a leitura e ajuste a velocidade.',
    "Réglez le surlignage, l'introduction et le cache audio.":
        'Ajuste o destaque, a introdução e o cache de áudio.',
    'Si vous voulez quelque chose de simple, gardez le fournisseur proposé puis testez une voix.':
        'Se você quiser algo simples, mantenha o provedor sugerido e teste uma voz.',
    "À quoi servent les réglages de l'assistant ?":
        'Para que servem as configurações do assistente?',
    "Cet onglet active l'assistant IA et choisit comment il répond dans l'application.":
        'Esta aba ativa o assistente de IA e define como ele responde no aplicativo.',
    "Activez ou masquez l'assistant dans la barre latérale.":
        'Ative ou oculte o assistente na barra lateral.',
    'Sélectionnez un fournisseur local, cloud ou personnalisé.':
        'Selecione um provedor local, em nuvem ou personalizado.',
    'Définissez la langue et le modèle utilisés pour les réponses.':
        'Defina o idioma e o modelo usados nas respostas.',
    'Comment fonctionne la recherche ?': 'Como funciona a pesquisa?',
    'Cette page recherche dans les prédications de votre bibliothèque et vous ramène directement au bon passage.':
        'Esta página pesquisa nos sermões da sua biblioteca e leva você diretamente à passagem certa.',
    'Entrez au moins trois caractères pour lancer une recherche.':
        'Digite pelo menos três caracteres para iniciar uma pesquisa.',
    'Choisissez le mode selon que vous cherchez un mot, plusieurs mots ou une phrase exacte.':
        'Escolha o modo conforme você esteja procurando uma palavra, várias palavras ou uma frase exata.',
    'Ouvrez un résultat pour aller directement au paragraphe correspondant.':
        'Abra um resultado para ir diretamente ao parágrafo correspondente.',
    'Retrouvez rapidement un mot, une expression ou un thème dans les prédications.':
        'Encontre rapidamente uma palavra, uma expressão ou um tema nos sermões.',
    'À quoi servent les soulignages ?': 'Para que servem os destaques?',
    'Cette page rassemble tous les passages marqués pendant vos lectures.':
        'Esta página reúne todas as passagens marcadas durante suas leituras.',
    'Retrouvez rapidement les passages importants que vous avez gardés.':
        'Encontre rapidamente as passagens importantes que você guardou.',
    'Filtrez par mot-clé dans le texte, le titre ou le commentaire.':
        'Filtre por palavra-chave no texto, no título ou no comentário.',
    'Rouvrez le document exact ou exportez la liste en PDF.':
        'Reabra o documento exato ou exporte a lista em PDF.',
    'Les soulignages se créent dans la vue de lecture, pas sur cette page.':
        'Os destaques são criados na vista de leitura, não nesta página.',
    'Revoyez tous les passages marqués pendant vos lectures.':
        'Revise todas as passagens marcadas durante suas leituras.',
    'La Bible vous aide à ouvrir rapidement un chapitre dans la lecture, comparer les versions et retrouver un passage sans quitter votre préparation.':
        'A Bíblia ajuda você a abrir rapidamente um capítulo na leitura, comparar versões e encontrar uma passagem sem sair da sua preparação.',
    "Elle sert de point d'entrée vers la lecture biblique dans l'application.":
        'Ela serve como ponto de entrada para a leitura bíblica no aplicativo.',
    'Une fois le chapitre ouvert, vous profitez des outils de lecture du document.':
        'Depois que o capítulo é aberto, você aproveita as ferramentas de leitura do documento.',
    'Elle vous aide aussi à parcourir les livres, comparer les versions et lancer une recherche biblique dédiée.':
        'Ela também ajuda você a percorrer os livros, comparar versões e iniciar uma pesquisa bíblica dedicada.',
    "C'est le chemin le plus direct pour ouvrir un livre ou un chapitre dans la vue de lecture.":
        'É o caminho mais direto para abrir um livro ou capítulo na visão de leitura.',
    'Utilisez cette page pour parcourir la Bible plus calmement.':
        'Use esta página para percorrer a Bíblia com mais calma.',
    'Utilisez la barre latérale pour ouvrir vite un chapitre. Utilisez cette page quand vous voulez explorer, comparer ou rechercher plus précisément.':
        'Use a barra lateral para abrir rapidamente um capítulo. Use esta página quando quiser explorar, comparar ou pesquisar com mais precisão.',
    'Ce que cette fonction vous apporte': 'O que esta função traz para você',
    'Pour commencer': 'Para começar',
    'Elle évite de refaire les mêmes recherches chaque fois que vous préparez un thème.':
        'Ela evita repetir as mesmas pesquisas toda vez que você prepara um tema.',
    'Elle garde ensemble vos meilleures références bibliques et vos passages de prédications.':
        'Ela mantém juntas suas melhores referências bíblicas e trechos de sermões.',
    "Elle vous aide à construire un ordre clair pour l'étude, la prédication ou l'export PDF.":
        'Ela ajuda você a construir uma ordem clara para estudo, pregação ou exportação em PDF.',
    "Elle aide à organiser vos références dans un ordre utile pour l'étude, la prédication ou l'export PDF.":
        'Ela ajuda a organizar suas referências em uma ordem útil para estudo, pregação ou exportação em PDF.',
    'Elle sert à développer votre pensée, vos plans et vos commentaires personnels.':
        'Ela serve para desenvolver seu pensamento, seus esboços e seus comentários pessoais.',
    'Elle sert à développer vos idées, vos plans et vos commentaires personnels.':
        'Ela serve para desenvolver suas ideias, seus esboços e seus comentários pessoais.',
    'Elle vous aide à garder vos idées de préparation dans un espace plus libre que les sujets.':
        'Ela ajuda você a guardar suas ideias de preparação em um espaço mais livre do que os assuntos.',
    'Elle vous offre un espace de préparation plus libre et plus personnel que les sujets.':
        'Ela oferece um espaço de preparação mais livre e mais pessoal do que os assuntos.',
    'Elle peut aussi contenir des références vers la Bible ou les prédications pour retrouver la source plus tard.':
        'Ela também pode conter referências para a Bíblia ou para sermões para reencontrar a fonte depois.',
    'Elle peut garder des références vers la Bible ou les prédications pour retrouver vos sources rapidement.':
        'Ela pode guardar referências para a Bíblia ou para sermões para reencontrar suas fontes rapidamente.',
    'Elle vous permet de confirmer rapidement un passage, comparer des versets et garder la Bible dans votre flux de travail.':
        'Ela permite confirmar rapidamente uma passagem, comparar versículos e manter a Bíblia no seu fluxo de trabalho.',
    'Elle réunit la lecture, les versions bibliques et la recherche au même endroit.':
        'Ela reúne leitura, versões bíblicas e pesquisa no mesmo lugar.',
    "Elle permet d'écouter vos contenus au lieu de seulement les lire.":
        'Ela permite ouvir seus conteúdos em vez de apenas lê-los.',
    'Elle est utile pour suivre un texte, relire pendant un déplacement ou continuer votre étude en audio.':
        'Ela é útil para acompanhar um texto, revisar durante um deslocamento ou continuar seu estudo em áudio.',
    "Elle contrôle aussi l'expérience de lecture: voix, vitesse, surlignage et comportement audio.":
        'Ela também controla a experiência de escuta: voz, velocidade, destaque e comportamento de áudio.',
    "L'assistant peut aider à explorer un thème, retrouver des références et comparer plus vite plusieurs contenus.":
        'O assistente pode ajudar a explorar um tema, encontrar referências e comparar vários conteúdos mais rápido.',
    "Cet onglet détermine s'il est disponible, quel service il utilise et dans quelle langue il travaille.":
        'Esta aba determina se ele está disponível, qual serviço usa e em que idioma trabalha.',
    'Vous pouvez choisir une solution locale, cloud ou personnalisée selon vos besoins.':
        'Você pode escolher uma solução local, em nuvem ou personalizada conforme sua necessidade.',
    "Activez l'assistant pour le rendre disponible dans la barre latérale.":
        'Ative o assistente para deixá-lo disponível na barra lateral.',
    'Elle sert à retrouver rapidement un mot, un thème, un lieu ou une expression dans les prédications.':
        'Ela serve para encontrar rapidamente uma palavra, um tema, um lugar ou uma expressão nos sermões.',
    'Elle évite de parcourir manuellement plusieurs documents quand vous savez déjà ce que vous cherchez.':
        'Ela evita percorrer manualmente vários documentos quando você já sabe o que procura.',
    'Elle vous ramène directement au paragraphe utile quand vous ouvrez un résultat.':
        'Ela leva você diretamente ao parágrafo útil quando abre um resultado.',
    'Elle vous donne une vue unique de tous les passages importants que vous avez repérés.':
        'Ela oferece uma visão única de todas as passagens importantes que você marcou.',
    'Elle aide à revoir vos découvertes sans devoir rouvrir chaque document un par un.':
        'Ela ajuda a revisar suas descobertas sem reabrir cada documento um por um.',
    'Elle permet aussi de filtrer, rouvrir la source exacte ou exporter la liste en PDF.':
        'Ela também permite filtrar, reabrir a fonte exata ou exportar a lista em PDF.',
    'Télécharger une version': 'Baixar uma versão',
    "Télécharger d'autres versions": 'Baixar outras versões',
    '{{count}} versions à télécharger': '{{count}} versões para baixar',

    // ── Notes editor toolbar (Tiptap) ──
    'Annuler la modification': 'Desfazer',
    Rétablir: 'Refazer',
    'Style de paragraphe': 'Estilo de parágrafo',
    Police: 'Fonte',
    'Taille de la police': 'Tamanho da fonte',
    'Langue du texte': 'Idioma do texto',
    Gras: 'Negrito',
    Italique: 'Itálico',
    Souligné: 'Sublinhado',
    Barré: 'Tachado',
    Indice: 'Subscrito',
    Exposant: 'Sobrescrito',
    'Couleur du texte': 'Cor do texto',
    Surlignage: 'Realce',
    'Aligner à gauche': 'Alinhar à esquerda',
    Centrer: 'Centralizar',
    'Aligner à droite': 'Alinhar à direita',
    Justifier: 'Justificar',
    'Liste à puces': 'Lista com marcadores',
    'Liste numérotée': 'Lista numerada',
    'Liste de tâches': 'Lista de tarefas',
    'Réduire le retrait': 'Diminuir recuo',
    'Augmenter le retrait': 'Aumentar recuo',
    'Supprimer le lien': 'Remover link',
    'Ajouter un lien': 'Adicionar link',
    'Modifier le lien': 'Editar link',
    Citation: 'Citação',
    'Insérer un tableau': 'Inserir tabela',
    'Supprimer le tableau': 'Excluir tabela',
    'Ligne horizontale': 'Linha horizontal',
    'Saut de page': 'Quebra de página',
    'Adresse du lien': 'URL do link',
    'Langue par défaut': 'Idioma padrão',
    'Par défaut': 'Padrão',
    'Titre {{n}}': 'Título {{n}}',
    'Commencez à écrire votre note…': 'Comece a escrever sua nota…',
    'Code en ligne': 'Código em linha',
    'Bloc de code': 'Bloco de código',
    'Effacer la mise en forme': 'Limpar formatação',
    'Ajouter une ligne': 'Adicionar linha',
    'Ajouter une colonne': 'Adicionar coluna',
    'Supprimer la ligne': 'Excluir linha',
    'Supprimer la colonne': 'Excluir coluna',
    'Fusionner les cellules': 'Mesclar células',
    'Séparer la cellule': 'Dividir célula',
    "La note n'a pas de contenu à exporter": 'A nota não tem conteúdo para exportar',
    "Impossible d'exporter la note en PDF": 'Não foi possível exportar a nota como PDF',
    // ── wmb:// reference modal ──
    'Référence introuvable': 'Referência não encontrada',
    'Chargement de la référence…': 'Carregando referência…',
    'Paragraphe {{n}}': 'Parágrafo {{n}}',
    Sermon: 'Sermão',
    'Document personnalisé': 'Documento personalizado',
};

export default pt;
