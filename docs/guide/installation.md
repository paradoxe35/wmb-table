# Installation

<p class="lead">Cette page explique comment installer Wmb Table sur Windows, macOS et Linux, avec l’autorisation manuelle actuellement nécessaire sur macOS.</p>

## Avant de commencer

Téléchargez Wmb Table depuis la page des versions et choisissez le fichier adapté à votre ordinateur :

- Windows : `.exe`
- macOS Apple Silicon : `.dmg`
- macOS Intel : `.dmg`
- Linux : `.AppImage`, `.deb` ou `.tar.gz`

## Windows

Pour la plupart des utilisateurs, le fichier le plus simple est l’installateur `.exe`.

<ScreenshotPlaceholder
  file="fr-installation-windows-installer.png"
  label="Installateur Windows ou avertissement de sécurité"
  hint="Montrer soit la fenêtre d’installation de Wmb Table, soit l’avertissement de sécurité Windows affiché avant l’installation."
/>

1. Téléchargez le fichier `.exe` pour Windows.
2. Ouvrez le fichier.
3. Suivez les étapes d’installation affichées à l’écran.
4. Lancez Wmb Table quand l’installation est terminée.

Si Windows affiche un avertissement de sécurité, vérifiez le message et continuez seulement si le fichier vient bien de la page officielle des versions Wmb Table.

## macOS

Wmb Table n’est actuellement pas signé sur macOS.

À cause de cela, macOS peut bloquer la première ouverture tant que vous ne l’autorisez pas manuellement.

### Installer l’application

<ScreenshotPlaceholder
  file="fr-installation-macos-dmg.png"
  label="Fenêtre DMG sur macOS"
  hint="Montrer le DMG ouvert avec Wmb Table et le dossier Applications."
/>

1. Téléchargez le fichier `.dmg` correspondant à votre Mac.
2. Ouvrez le `.dmg`.
3. Glissez `Wmb Table` dans `Applications`.

### Autoriser la première ouverture

<ScreenshotPlaceholder
  file="fr-installation-macos-open-anyway.png"
  label="Autorisation macOS dans Confidentialité et sécurité"
  hint="Montrer la page Confidentialité et sécurité avec le message de blocage et le bouton Ouvrir quand même."
/>

1. Ouvrez `Applications`.
2. Essayez d’ouvrir `Wmb Table`.
3. Quand macOS bloque l’application, fermez l’avertissement.
4. Ouvrez `Réglages Système`.
5. Allez dans `Confidentialité et sécurité`.
6. Descendez jusqu’à la zone de sécurité en bas de la page.
7. Trouvez le message indiquant que macOS a bloqué Wmb Table.
8. Cliquez sur `Ouvrir quand même`.
9. Confirmez en cliquant sur `Ouvrir`.

Après cela, l’application devrait s’ouvrir normalement.

### Autre méthode possible

Sur certains Mac, cette méthode fonctionne aussi :

1. Ouvrez `Applications`.
2. Faites un clic droit sur `Wmb Table`.
3. Cliquez sur `Ouvrir`.
4. Confirmez en cliquant sur `Ouvrir`.

Si macOS bloque encore l’application, utilisez la méthode `Réglages Système > Confidentialité et sécurité > Ouvrir quand même`.

## Linux

Vous pouvez choisir le format qui convient le mieux à votre système.

### AppImage

C’est généralement l’option la plus simple.

<ScreenshotPlaceholder
  file="fr-installation-linux-appimage.png"
  label="Fichier AppImage sur Linux ou étape de lancement"
  hint="Montrer le fichier AppImage téléchargé, son autorisation d’exécution, ou le premier lancement depuis le gestionnaire de fichiers."
/>

1. Téléchargez le fichier `.AppImage`.
2. Rendez-le exécutable si nécessaire.
3. Ouvrez-le.

Si votre gestionnaire de fichiers ne permet pas de le lancer directement, exécutez :

```bash
chmod +x Wmb-Table-*.AppImage
./Wmb-Table-*.AppImage
```

### Debian ou Ubuntu

Si vous préférez un paquet système, téléchargez le fichier `.deb` et installez-le avec votre gestionnaire de paquets.

### tar.gz

Utilisez cette option si vous préférez une installation portable manuelle.

Décompressez l’archive puis ouvrez l’application depuis le dossier extrait.

## Quel fichier choisir

- Windows : utilisez `.exe`
- macOS : utilisez le `.dmg` correspondant à votre Mac
- Linux : utilisez d’abord `.AppImage`, sauf si vous voulez précisément `.deb` ou `.tar.gz`

## Si l’application ne s’ouvre pas

- vérifiez que vous avez téléchargé le bon fichier pour votre système
- sur macOS, faites bien l’autorisation manuelle dans `Confidentialité et sécurité`
- sur Linux, vérifiez que l’AppImage est exécutable
- retéléchargez le fichier si le premier téléchargement était incomplet

## Voir aussi

- [Commencer](/guide/getting-started)
- [Questions et dépannage](/guide/troubleshooting)
