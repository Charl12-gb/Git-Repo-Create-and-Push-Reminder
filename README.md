# Git Push Reminder by CharlesGBOYOU

Extension VS Code qui surveille chaque dépôt Git ouvert et rappelle de publier les changements locaux ou les commits qui ne sont pas encore poussés.

## Fonctionnalités

- Rappels séparés pour chaque dépôt Git ouvert, dès qu’il existe des changements locaux ou des commits à pousser.
- Commentaire distinct par dépôt par défaut, avec une option pour réutiliser un commentaire commun.
- Reports de 5 à 30 minutes et rappel prioritaire après trois reports.
- Publication des changements avec affichage préalable d’un résumé des fichiers et commits concernés.

L’extension requiert VS Code et l’extension Git intégrée.

## Fonctionnement

- Le délai commence uniquement lorsqu’un dépôt contient des fichiers modifiés ou des commits en avance sur sa branche distante.
- Le premier rappel arrive après 15 minutes par défaut.
- L’utilisateur peut reporter le rappel de 5, 10, 15, 20, 25 ou 30 minutes. Après trois reports, le rappel suivant est modal et ne propose plus de report.
- Avant tout commit, l’extension précise que les fichiers suivis modifiés et non suivis seront inclus. Elle demande un commentaire puis effectue le commit et le push.
- Les dépôts avec des commits déjà créés sont poussés sans créer de nouveau commit.
- Le mode de commentaire est distinct par dépôt par défaut. Il peut être remplacé par un commentaire commun dans les paramètres.

Chaque dépôt est traité indépendamment. Une erreur Git (branche distante non configurée, authentification, réseau, hook ou conflit) est affichée et le rappel est reprogrammé; l’extension ne signale jamais un push réussi si Git a échoué.

## Paramètres

- `gitPushReminder.enabled` : active les rappels (activé par défaut).
- `gitPushReminder.intervalMinutes` : délai avant le premier rappel (15 minutes par défaut, configurable de 1 à 1 440).
- `gitPushReminder.commitMessageMode` : `perRepository` pour demander un commentaire distinct, `shared` pour utiliser un commentaire commun.

Le bouton **$(git-commit) Push : N min** dans la barre d’état ouvre la saisie de la fréquence en minutes. La valeur est enregistrée pour l’espace de travail. La commande **Git Push Reminder: Modifier la fréquence des rappels** ouvre le même réglage, et **Git Push Reminder: Vérifier les dépôts maintenant** lance une vérification immédiate.

## Développement

1. Installer les dépendances avec `npm install`.
2. Lancer `npm run compile`.
3. Appuyer sur F5 dans VS Code pour ouvrir une fenêtre Extension Development Host.

Les tests s’exécutent avec `npm test` et nécessitent le téléchargement du runtime VS Code de test lors de la première exécution.

## Limites

VS Code ne fournit pas d’API stable permettant à une extension d’annuler de façon fiable la fermeture de l’éditeur. Le quatrième rappel affiche une fenêtre modale sans option de report, mais l’utilisateur peut toujours fermer VS Code ou contourner cette fenêtre. Une panne Git repousse également la nouvelle tentative afin de laisser corriger la configuration ou la connexion.

