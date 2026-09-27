# git-push-reminder README

This is the README for your extension "git-push-reminder". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

# Git Push Reminder

Extension VS Code qui surveille chaque dépôt Git ouvert et rappelle de publier les changements locaux ou les commits qui ne sont pas encore poussés.

## Fonctionnement

- Le délai commence uniquement lorsqu’un dépôt contient des fichiers modifiés ou des commits en avance sur sa branche distante.
- Le premier rappel arrive après 30 minutes par défaut.
- L’utilisateur peut reporter le rappel de 5, 10, 15, 20, 25 ou 30 minutes. Après trois reports, le rappel suivant est modal et ne propose plus de report.
- Avant tout commit, l’extension précise que les fichiers suivis modifiés et non suivis seront inclus. Elle demande un commentaire puis effectue le commit et le push.
- Les dépôts avec des commits déjà créés sont poussés sans créer de nouveau commit.
- Le mode de commentaire est distinct par dépôt par défaut. Il peut être remplacé par un commentaire commun dans les paramètres.

Chaque dépôt est traité indépendamment. Une erreur Git (branche distante non configurée, authentification, réseau, hook ou conflit) est affichée et le rappel est reprogrammé; l’extension ne signale jamais un push réussi si Git a échoué.

## Paramètres

- `gitPushReminder.enabled` : active les rappels (activé par défaut).
- `gitPushReminder.intervalMinutes` : délai avant le premier rappel (30 minutes par défaut, configurable de 1 à 1 440).
- `gitPushReminder.commitMessageMode` : `perRepository` pour demander un commentaire distinct, `shared` pour utiliser un commentaire commun.

La commande **Git Push Reminder: Vérifier les dépôts maintenant** lance une vérification immédiate.

## Développement

1. Installer les dépendances avec `npm install`.
2. Lancer `npm run compile`.
3. Appuyer sur F5 dans VS Code pour ouvrir une fenêtre Extension Development Host.

Les tests s’exécutent avec `npm test` et nécessitent le téléchargement du runtime VS Code de test lors de la première exécution.

## Limites

VS Code ne fournit pas d’API stable permettant à une extension d’annuler de façon fiable la fermeture de l’éditeur. Le quatrième rappel affiche une fenêtre modale sans option de report, mais l’utilisateur peut toujours fermer VS Code ou contourner cette fenêtre. Une panne Git repousse également la nouvelle tentative afin de laisser corriger la configuration ou la connexion.

