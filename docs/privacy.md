# Politique de confidentialité

_Dernière mise à jour : 13 avril 2026_

Cette politique de confidentialité décrit comment Wmb Table traite les informations lorsque vous utilisez :

- l'application de bureau Wmb Table
- le site de documentation de Wmb Table

Cette page a été rédigée à partir des fonctionnalités actuellement présentes dans le code de l'application et du site de documentation.

## Résumé simple

Wmb Table stocke principalement vos données sur votre appareil.

Selon les fonctions que vous activez, l'application peut aussi communiquer avec des services tiers pour :

- vérifier et télécharger des mises à jour de l'application
- télécharger des packs de langues, des modèles IA locaux ou des modèles TTS locaux
- lire ou mettre en cache certains fichiers audio distants
- envoyer des requêtes à un fournisseur IA que vous choisissez
- envoyer du texte à un fournisseur de synthèse vocale en ligne que vous choisissez
- sauvegarder et synchroniser certaines données via Google Drive si vous activez cette fonction
- envoyer des rapports d'erreur à Sentry

Le site de documentation utilise aussi :

- un cookie de préférence de langue
- un formulaire de contact envoyé via Formbold
- un panneau de téléchargement qui récupère un manifeste de versions

## 1. Informations traitées localement dans l'application

Wmb Table est conçu comme une application de bureau. D'après le fonctionnement actuel du code, les données suivantes peuvent être stockées localement sur votre appareil :

- vos notes et leurs références
- vos sujets et les éléments rangés dans ces sujets
- vos passages surlignés et commentaires
- vos documents personnels importés, y compris leur contenu extrait
- votre historique de lecture
- vos positions de lecture et vos onglets ouverts
- vos préférences de langue et d'interface
- vos paramètres audio, TTS et IA
- vos conversations IA et leurs messages
- les suggestions de recherche
- les informations de dernier audio lu et certains fichiers audio mis en cache
- les modèles IA locaux, les modèles TTS locaux, les index de recherche et les packs de langues téléchargés
- les jetons Google nécessaires à la synchronisation, si vous activez Google Drive
- les clés API et réglages de fournisseurs distants que vous configurez pour l'IA ou la synthèse vocale

Dans l'implémentation actuelle, ces données sont majoritairement stockées dans des fichiers et bases locales sous un répertoire applicatif de type `~/.wmb-table`.

## 2. Données envoyées à des services tiers lorsque vous activez certaines fonctions

### 2.1 Rapports d'erreur

L'application initialise actuellement Sentry dans le processus principal et dans le renderer.

Cela signifie que des informations techniques liées aux erreurs, plantages ou exceptions peuvent être envoyées à Sentry, par exemple :

- informations sur l'application et sa version
- contexte technique d'erreur
- données sur l'appareil, le système ou la session nécessaires au diagnostic

Nous n'utilisons pas cette fonction pour de la publicité. Elle sert à diagnostiquer et corriger des problèmes.

### 2.2 Mises à jour de l'application

Lorsque l'application vérifie les mises à jour ou télécharge une nouvelle version, elle contacte les sources de publication GitHub configurées pour Wmb Table.

Cela peut impliquer le traitement de données techniques standard comme :

- adresse IP
- informations de requête réseau
- version de l'application demandant la mise à jour

### 2.3 Packs de langues, modèles et fichiers téléchargés

L'application peut télécharger ou mettre à jour :

- des packs de langues
- des modèles IA locaux
- des modèles TTS locaux
- certains fichiers audio liés à la lecture

Ces téléchargements impliquent des connexions aux hébergeurs concernés, par exemple GitHub, Hugging Face, Wasabi ou d'autres sources configurées par l'application.

### 2.4 Assistant IA

L'assistant IA reste désactivé tant que vous ne l'activez pas dans les paramètres.

Si vous choisissez un fournisseur distant comme OpenAI, OpenRouter, Gemini, Claude ou un fournisseur compatible personnalisé, Wmb Table peut envoyer au fournisseur sélectionné :

- votre message
- l'historique récent de la conversation
- une mémoire résumée de la conversation
- les instructions système nécessaires au fonctionnement de l'assistant
- les résultats d'outils utilisés pendant la réponse

Selon votre demande, ces résultats d'outils peuvent inclure des données provenant de l'application, par exemple :

- contenus de prédications
- références bibliques
- noms de langues installées
- notes
- sujets
- documents personnels

Si vous choisissez le mode `Local`, le traitement IA est effectué sur votre appareil avec un modèle téléchargé localement.

### 2.5 Lecture vocale et synthèse vocale

Wmb Table propose des voix locales et des services de synthèse vocale distants.

Si vous utilisez un fournisseur distant comme Edge TTS, Cartesia, ElevenLabs ou OpenAI TTS, du texte peut être envoyé au fournisseur choisi pour générer l'audio.

Si vous utilisez une voix locale, comme les voix du système ou Sherpa-ONNX TTS, la synthèse vocale reste sur votre appareil, sous réserve du fonctionnement normal de votre système.

Certaines fonctions de clonage vocal peuvent aussi envoyer les extraits audio que vous fournissez au service concerné.

### 2.6 Sauvegarde et synchronisation Google Drive

La sauvegarde et la synchronisation Google Drive sont optionnelles.

Si vous activez cette fonction, Wmb Table vous redirige vers votre navigateur pour l'authentification Google et demande actuellement l'accès à :

- votre profil de base Google
- votre adresse email Google
- l'espace `appDataFolder` de Google Drive

Lorsque cette fonction est active, Wmb Table peut stocker ou synchroniser dans Google Drive des instantanés de base de données et des journaux de modifications contenant certaines catégories de données utilisateur, notamment :

- notes
- références de notes
- références bibliques de notes
- sujets
- éléments de sujets
- documents personnels
- suggestions de recherche
- surlignages
- conversations IA
- messages IA

L'application stocke aussi localement les informations minimales liées à cet accès, comme votre nom, votre email, l'état de la sauvegarde et le jeton Google nécessaire à la reconnexion.

Important : dans l'état actuel du code, la déconnexion supprime les jetons locaux et l'état local de synchronisation, mais cette page ne garantit pas la suppression automatique de toutes les copies déjà présentes dans votre Google Drive.

## 3. Ce que le site de documentation traite

Le site de documentation de Wmb Table traite un volume de données beaucoup plus limité que l'application.

### 3.1 Préférence de langue

Le site enregistre actuellement un cookie de préférence de langue pour mémoriser votre choix entre les versions française, anglaise et espagnole.

Ce cookie sert uniquement à l'affichage de la bonne langue.

### 3.2 Formulaire de contact

Si vous utilisez le formulaire de contact du site, les données que vous saisissez sont envoyées à Formbold :

- nom
- email
- sujet
- message

N'envoyez pas d'informations sensibles que vous ne souhaitez pas transmettre à un prestataire de formulaire tiers.

### 3.3 Panneau de téléchargement

La page d'accueil de la documentation peut récupérer un manifeste de versions afin d'afficher les téléchargements recommandés selon votre appareil.

Ce composant peut traiter des informations techniques de navigation comme :

- user agent
- plate-forme estimée
- architecture estimée
- langue de la page

## 4. Bases d'utilisation

Nous traitons les informations concernées selon le type de fonction utilisée :

- pour fournir les fonctionnalités de base de l'application
- pour exécuter les fonctions que vous activez vous-même
- pour sécuriser, maintenir et améliorer le logiciel
- pour répondre aux messages envoyés via le formulaire de contact

## 5. Partage des données

Nous ne vendons pas vos données personnelles.

Les données peuvent toutefois être partagées avec des prestataires techniques lorsque cela est nécessaire au fonctionnement des fonctions que vous utilisez, notamment :

- Sentry pour les rapports d'erreur
- GitHub pour les mises à jour et certains téléchargements
- Google pour l'authentification et la synchronisation Drive
- Formbold pour le formulaire de contact du site
- le fournisseur IA que vous choisissez
- le fournisseur TTS distant que vous choisissez
- les hébergeurs de fichiers utilisés pour les langues, les modèles ou l'audio

Chaque service tiers applique aussi ses propres conditions et politiques de confidentialité.

## 6. Conservation des données

Les données locales restent généralement sur votre appareil jusqu'à ce que :

- vous les supprimiez dans l'application
- vous supprimiez les fichiers locaux
- vous désinstalliez l'application et retiriez ses données locales

Les données envoyées à des services tiers peuvent être conservées selon les règles de ces services tiers.

Les copies synchronisées vers Google Drive peuvent rester dans votre espace Google Drive tant qu'elles n'ont pas été supprimées de cet espace.

## 7. Sécurité

Nous essayons de limiter l'exposition des données en privilégiant le stockage local pour les fonctions principales.

Cependant :

- aucun système n'est parfaitement sécurisé
- la sécurité dépend aussi de votre appareil, de votre compte Google, de vos clés API et des services tiers que vous choisissez
- si vous activez des fournisseurs distants, les données envoyées quittent votre appareil

Vous êtes responsable de protéger :

- votre appareil
- vos comptes tiers
- vos clés API
- vos fichiers et sauvegardes

## 8. Vos choix

Vous pouvez limiter le traitement externe de plusieurs façons :

- ne pas activer la synchronisation Google Drive
- ne pas activer l'assistant IA
- choisir le mode IA local au lieu d'un fournisseur distant
- choisir une voix TTS locale au lieu d'un fournisseur distant
- ne pas utiliser le formulaire de contact du site
- supprimer certains contenus locaux depuis l'application

## 9. Utilisateurs mineurs

Wmb Table n'est pas présenté comme un service destiné spécifiquement aux enfants.

Si vous êtes responsable d'un mineur utilisant l'application, assurez-vous qu'il ne partage pas d'informations sensibles via les fonctions distantes ou le formulaire de contact.

## 10. Modifications de cette politique

Nous pouvons mettre à jour cette politique afin de refléter les évolutions de Wmb Table, de la documentation ou des services tiers utilisés.

La date en haut de cette page indique la dernière mise à jour.

## 11. Contact

Pour une question liée à la confidentialité ou aux données :

- Email : [paradoxngwasi@gmail.com](mailto:paradoxngwasi@gmail.com)
- Contact : [Nous contacter](/contact)

## Voir aussi

- [Conditions d'utilisation](/terms)
- [Sauvegarde et synchronisation](/guide/backup-and-sync)
- [Paramètres Assistant](/guide/settings-assistant)
- [Lecture audio et voix](/guide/audio-and-tts)
