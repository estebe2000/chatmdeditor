# Guide d'utilisation de la génération par IA dans ChatMD Editor

Ce document explique comment utiliser la fonctionnalité de génération par IA intégrée à ChatMD Editor.

## Présentation

La fonctionnalité de génération par IA vous permet de créer automatiquement des chatbots à partir de documents existants. Vous pouvez télécharger un document (description d'entreprise, biographie, cours, etc.) et l'IA générera un chatbot interactif au format ChatMD avec des choix, des déclencheurs et du contenu pertinent.

## Prérequis

Pour utiliser cette fonctionnalité, vous devez avoir:

1. Un serveur LLM local accessible via une API compatible OpenAI
   - URL par défaut: http://localhost:1337/v1/chat/completions
   - Modèle recommandé: llama3.2:3b ou équivalent

2. Les dépendances Python nécessaires installées:
   - requests
   - PyPDF2 (pour les fichiers PDF)
   - python-docx (pour les fichiers DOCX)

## Accès à la fonctionnalité

Vous pouvez accéder à la page de génération par IA de deux façons:

1. En cliquant sur le bouton "Génération par IA" dans la section "Assistance" de l'interface principale
2. En accédant directement à l'URL: `/ai-generation`

## Utilisation

### 1. Téléchargement de document

La première étape consiste à télécharger un document à partir duquel l'IA générera un chatbot. Les formats supportés sont:

- TXT: Fichiers texte brut
- MD: Fichiers Markdown
- PDF: Documents PDF (le texte sera extrait)
- DOCX: Documents Word (le texte sera extrait)

### 2. Configuration des paramètres

Vous pouvez personnaliser la génération en ajustant les paramètres suivants:

- **Type de document**: Sélectionnez le type de contenu (entreprise, biographie, cours, etc.) pour optimiser la génération
- **Ton**: Choisissez le ton du chatbot (formel, conversationnel, éducatif, etc.)
- **Complexité**: Définissez le niveau de complexité du contenu (débutant, intermédiaire, avancé)
- **Profondeur maximale**: Limitez la profondeur de la conversation (nombre de niveaux d'imbrication)
- **Choix par niveau**: Définissez le nombre approximatif d'options à chaque niveau

### 3. Génération du chatbot

Après avoir configuré les paramètres, cliquez sur le bouton "Générer le chatbot". Le processus de génération peut prendre quelques secondes à quelques minutes, selon la taille du document et la complexité du modèle LLM utilisé.

### 4. Résultats et édition

Une fois la génération terminée, vous verrez le résultat sous forme de trois onglets:

- **Prévisualisation**: Aperçu simple du chatbot généré
- **Markdown**: Code source Markdown du chatbot généré
- **Améliorer**: Options pour obtenir des suggestions d'amélioration

Vous pouvez:
- Copier le Markdown généré
- L'utiliser directement dans l'éditeur principal
- Demander des suggestions d'amélioration pour l'ensemble du chatbot ou une section spécifique

## Exemples d'utilisation

### Exemple 1: Génération à partir d'une description d'entreprise

1. Téléchargez un fichier texte contenant la description d'une entreprise
2. Sélectionnez le type "Description d'entreprise"
3. Choisissez un ton "Professionnel"
4. Définissez une profondeur maximale de 3 niveaux
5. Générez le chatbot

Le résultat sera un chatbot qui présente l'entreprise, avec des options pour explorer ses produits/services, son histoire, ses valeurs, etc.

### Exemple 2: Génération à partir d'un cours

1. Téléchargez un document PDF contenant un cours
2. Sélectionnez le type "Cours"
3. Choisissez un ton "Éducatif"
4. Définissez une complexité adaptée au niveau du cours
5. Générez le chatbot

Le résultat sera un chatbot éducatif qui présente le sujet du cours, avec des options pour explorer les différentes sections, concepts clés, et potentiellement des quiz.

## Dépannage

### Problèmes courants

1. **Erreur "Impossible de traiter le document"**:
   - Vérifiez que le format du document est supporté
   - Assurez-vous que le document contient du texte extractible (pas seulement des images)

2. **Erreur "Erreur lors de la génération du chatbot"**:
   - Vérifiez que le serveur LLM est en cours d'exécution
   - Assurez-vous que l'URL et le modèle sont correctement configurés

3. **Génération de mauvaise qualité**:
   - Essayez d'ajuster les paramètres (type de document, ton, complexité)
   - Utilisez un modèle LLM plus performant si disponible
   - Simplifiez ou clarifiez le document source

## Personnalisation avancée

Pour personnaliser davantage le comportement de la génération par IA, vous pouvez modifier les fichiers suivants:

- `llm_service.py`: Contient les prompts et la logique d'interaction avec le LLM
- `document_processor.py`: Gère l'extraction de texte à partir de différents formats de documents

## Ressources additionnelles

- [Documentation de l'API OpenAI](https://platform.openai.com/docs/api-reference) - Format d'API compatible
- [Jan.ai](https://jan.ai/) - Logiciel multiplateforme pour exécuter des LLM localement
- [Llama 3](https://ai.meta.com/llama/) - Famille de modèles open source utilisée par défaut
