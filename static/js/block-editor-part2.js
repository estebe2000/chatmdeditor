/**
 * Initialiser l'éditeur quand la page est chargée
 */
document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('markdown-editor');
  if (editor) {
    window.blockEditor = new BlockManager(editor);
  }
});

/**
 * Classe principale pour la gestion des blocs
 */
class BlockManager {
  /**
   * Constructeur
   * @param {HTMLTextAreaElement} markdownEditor - L'éditeur markdown
   */
  constructor(markdownEditor) {
    this.editor = markdownEditor;
    this.blocks = [];
    this.currentEditingBlock = null;
    
    // Initialiser les sous-classes
    this.parser = new BlockParser();
    this.renderer = new BlockRenderer(this);
    this.eventHandler = new BlockEventHandler(this);
    
    // Initialiser l'éditeur
    this.init();
  }

  /**
   * Initialise l'éditeur de blocs
   */
  init() {
    try {
      this.parseMarkdown(this.editor.value);
      this.renderBlockPanel();
      this.eventHandler.setupEventListeners();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'éditeur de blocs:', error);
      showNotification && showNotification(`Erreur lors de l'initialisation: ${error.message}`, 'error');
    }
  }

  /**
   * Analyse le markdown et met à jour les blocs
   * @param {string} markdown - Le contenu markdown
   */
  parseMarkdown(markdown) {
    try {
      this.blocks = this.parser.parse(markdown);
    } catch (error) {
      console.error('Erreur lors de l\'analyse du markdown:', error);
      showNotification && showNotification(`Erreur lors de l'analyse: ${error.message}`, 'error');
    }
  }

  /**
   * Rend le panneau des blocs
   */
  renderBlockPanel() {
    this.renderer.renderBlockPanel(this.blocks);
  }

  /**
   * Déplace un bloc
   * @param {number} fromIndex - Index source
   * @param {number} toIndex - Index destination
   */
  moveBlock(fromIndex, toIndex) {
    try {
      // Ne pas permettre de déplacer le bloc d'accueil
      if (fromIndex === 0 || toIndex === 0) return;
      
      const [block] = this.blocks.splice(fromIndex, 1);
      this.blocks.splice(toIndex, 0, block);
      this.updateMarkdown();
      this.renderBlockPanel();
      
      showNotification && showNotification('Bloc déplacé avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors du déplacement du bloc:', error);
      showNotification && showNotification(`Erreur lors du déplacement: ${error.message}`, 'error');
    }
  }

  /**
   * Édite un bloc
   * @param {number} index - Index du bloc à éditer
   */
  editBlock(index) {
    try {
      const block = this.blocks[index];
      if (!block) {
        throw new Error(`Bloc d'index ${index} non trouvé`);
      }
      
      this.currentEditingBlock = { block, index };
      
      // Remplir le formulaire d'édition
      document.getElementById('block-title').value = block.title;
      
      const triggersSection = document.getElementById('triggers-section');
      if (triggersSection) {
        triggersSection.style.display = block.type === 'welcome' ? 'none' : 'block';
      }
      
      if (block.type !== 'welcome') {
        document.getElementById('block-triggers').value = block.triggers.join('\n');
      }
      
      // Extraire le contenu sans les choix
      const contentWithoutChoices = block.content.split('\n')
        .filter(line => !line.match(/^\d+\.\s*\[.*?\]\(.*?\)/))
        .join('\n');
      
      document.getElementById('block-content').value = contentWithoutChoices;
      
      // Remplir les choix
      const choicesContainer = document.getElementById('block-choices');
      choicesContainer.innerHTML = '';
      
      console.log("Choix du bloc:", block.choices);
      
      if (block.choices.length === 0) {
        // Ajouter un choix vide
        this.addEmptyChoice(choicesContainer);
      } else {
        // Ajouter les choix existants
        block.choices.forEach(choice => {
          this.addChoiceToForm(choicesContainer, choice.text, choice.target);
        });
      }
      
      // Ouvrir le panneau d'édition
      const editDetails = document.querySelector('#assistance-panel details:nth-child(2)');
      if (editDetails) {
        editDetails.open = true;
      }
      
      // Prévisualiser le bloc
      window.previewBlock(index);
    } catch (error) {
      console.error('Erreur lors de l\'édition du bloc:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }

  /**
   * Ajoute un choix vide au formulaire
   * @param {HTMLElement} container - Conteneur des choix
   */
  addEmptyChoice(container) {
    try {
      const choiceDiv = document.createElement('div');
      choiceDiv.className = 'flex items-center space-x-2 mb-2';
      
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'choice-text flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500';
      textInput.placeholder = 'Texte du bouton';
      textInput.setAttribute('aria-label', 'Texte du bouton');
      
      const targetSelect = document.createElement('select');
      targetSelect.className = 'choice-target flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500';
      targetSelect.setAttribute('aria-label', 'Bloc cible');
      
      // Option par défaut
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Sélectionner un bloc cible';
      targetSelect.appendChild(defaultOption);
      
      // Ajouter les blocs comme options
      this.blocks.forEach(block => {
        // Toujours inclure le bloc d'accueil, mais éviter les auto-références pour les autres blocs
        if (block.type === 'welcome' || (this.currentEditingBlock && block.id !== this.currentEditingBlock.block.id)) {
          const option = document.createElement('option');
          option.value = block.title;
          option.textContent = block.title;
          targetSelect.appendChild(option);
        }
      });
      
      const removeButton = document.createElement('button');
      removeButton.className = 'p-2 text-red-600 hover:bg-red-50 rounded';
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.setAttribute('aria-label', 'Supprimer ce choix');
      removeButton.addEventListener('click', () => choiceDiv.remove());
      
      choiceDiv.appendChild(textInput);
      choiceDiv.appendChild(targetSelect);
      choiceDiv.appendChild(removeButton);
      
      container.appendChild(choiceDiv);
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'un choix vide:', error);
    }
  }

  /**
   * Ajoute un choix au formulaire
   * @param {HTMLElement} container - Conteneur des choix
   * @param {string} text - Texte du choix
   * @param {string} target - Cible du choix
   */
  addChoiceToForm(container, text, target) {
    try {
      const choiceDiv = document.createElement('div');
      choiceDiv.className = 'flex items-center space-x-2 mb-2';
      
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'choice-text flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500';
      textInput.placeholder = 'Texte du bouton';
      textInput.value = text;
      textInput.setAttribute('aria-label', 'Texte du bouton');
      
      const targetSelect = document.createElement('select');
      targetSelect.className = 'choice-target flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500';
      targetSelect.setAttribute('aria-label', 'Bloc cible');
      
      // Option par défaut
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Sélectionner un bloc cible';
      targetSelect.appendChild(defaultOption);
      
      // Ajouter les blocs comme options
      this.blocks.forEach(block => {
        // Toujours inclure le bloc d'accueil, mais éviter les auto-références pour les autres blocs
        if (block.type === 'welcome' || (this.currentEditingBlock && block.id !== this.currentEditingBlock.block.id)) {
          const option = document.createElement('option');
          option.value = block.title;
          option.textContent = block.title;
          option.selected = block.title === target;
          targetSelect.appendChild(option);
        }
      });
      
      const removeButton = document.createElement('button');
      removeButton.className = 'p-2 text-red-600 hover:bg-red-50 rounded';
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.setAttribute('aria-label', 'Supprimer ce choix');
      removeButton.addEventListener('click', () => choiceDiv.remove());
      
      choiceDiv.appendChild(textInput);
      choiceDiv.appendChild(targetSelect);
      choiceDiv.appendChild(removeButton);
      
      container.appendChild(choiceDiv);
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'un choix au formulaire:', error);
    }
  }

  /**
   * Ajoute un choix
   */
  addChoice() {
    try {
      const choicesContainer = document.getElementById('block-choices');
      if (choicesContainer) {
        this.addEmptyChoice(choicesContainer);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'un choix:', error);
    }
  }

  /**
   * Sauvegarde le bloc édité
   */
  saveEditedBlock() {
    try {
      if (!this.currentEditingBlock) {
        showNotification && showNotification('Aucun bloc en cours d\'édition', 'warning');
        return;
      }
      
      const { block, index } = this.currentEditingBlock;
      const title = document.getElementById('block-title').value.trim();
      const content = document.getElementById('block-content').value.trim();
      
      if (!title) {
        showNotification && showNotification('Le titre du bloc est obligatoire', 'error');
        return;
      }
      
      // Mettre à jour le bloc
      block.title = title;
      block.id = title.replace(/\s+/g, '-').toLowerCase();
      
      if (block.type !== 'welcome') {
        block.triggers = document.getElementById('block-triggers').value
          .split('\n')
          .filter(t => t.trim())
          .map(t => t.trim());
      }
      
      // Récupérer les choix
      const choiceTexts = Array.from(document.querySelectorAll('.choice-text')).map(input => input.value.trim());
      const choiceTargets = Array.from(document.querySelectorAll('.choice-target')).map(select => select.value);
      
      console.log("Choix récupérés du formulaire:", choiceTexts, choiceTargets);
      
      // Construire le contenu avec les choix
      let newContent = content;
      
      // Ajouter les choix à la fin du contenu s'ils existent
      const choices = [];
      for (let i = 0; i < choiceTexts.length; i++) {
        if (choiceTexts[i] && choiceTargets[i]) {
          choices.push({
            text: choiceTexts[i],
            target: choiceTargets[i]
          });
          
          // Ajouter le choix au format markdown à la fin du contenu
          if (!newContent.endsWith('\n')) {
            newContent += '\n';
          }
          newContent += `${i+1}. [${choiceTexts[i]}](${choiceTargets[i]})\n`;
        }
      }
      
      block.content = newContent;
      block.choices = choices;
      
      console.log("Nouveau contenu avec choix:", newContent);
      console.log("Choix enregistrés:", choices);
      
      this.blocks[index] = block;
      this.updateMarkdown();
      this.renderBlockPanel();
      
      // Réinitialiser le formulaire
      this.cancelEdit();
      
      // Prévisualiser le bloc modifié
      window.previewBlock(index);
      
      showNotification && showNotification('Bloc enregistré avec succès', 'success');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du bloc:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }

  /**
   * Annule l'édition en cours
   */
  cancelEdit() {
    try {
      document.getElementById('block-title').value = '';
      document.getElementById('block-triggers').value = '';
      document.getElementById('block-content').value = '';
      document.getElementById('block-choices').innerHTML = '';
      
      this.currentEditingBlock = null;
    } catch (error) {
      console.error('Erreur lors de l\'annulation de l\'édition:', error);
    }
  }

  /**
   * Supprime un bloc
   * @param {number} index - Index du bloc à supprimer
   */
  deleteBlock(index) {
    try {
      if (confirm('Êtes-vous sûr de vouloir supprimer ce bloc ?')) {
        // Ne pas permettre de supprimer le bloc d'accueil
        if (index === 0) {
          showNotification && showNotification('Impossible de supprimer le bloc d\'accueil', 'error');
          return;
        }
        
        this.blocks.splice(index, 1);
        this.updateMarkdown();
        this.renderBlockPanel();
        
        showNotification && showNotification('Bloc supprimé avec succès', 'success');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du bloc:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }

  /**
   * Ajoute un nouveau bloc
   */
  addNewBlock() {
    try {
      const title = prompt('Titre du nouveau bloc:');
      if (!title) return;
      
      const newBlock = {
        id: title.replace(/\s+/g, '-').toLowerCase(),
        type: 'response',
        title: title,
        triggers: ['déclencheur'],
        content: 'Contenu du bloc',
        choices: []
      };
      
      this.blocks.push(newBlock);
      this.updateMarkdown();
      this.renderBlockPanel();
      
      // Éditer le nouveau bloc
      this.editBlock(this.blocks.length - 1);
      
      // Prévisualiser le nouveau bloc
      window.previewBlock(this.blocks.length - 1);
      
      showNotification && showNotification('Nouveau bloc créé', 'success');
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'un nouveau bloc:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }

  /**
   * Met à jour le markdown à partir des blocs
   */
  updateMarkdown() {
    try {
      // Utiliser le debouncing pour éviter les mises à jour trop fréquentes
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }
      
      this.updateTimeout = setTimeout(() => {
        // Reconstruire le markdown à partir des blocs
        const markdown = this.parser.generateMarkdown(this.blocks);
        
        this.editor.value = markdown;
        
        // Déclencher l'événement input pour mettre à jour la prévisualisation
        this.editor.dispatchEvent(new Event('input'));
      }, 300); // 300ms de délai
    } catch (error) {
      console.error('Erreur lors de la mise à jour du markdown:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }
}
