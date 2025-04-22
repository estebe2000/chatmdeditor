/**
 * ChatMD Editor - Block Editor
 * 
 * Ce fichier contient les classes pour l'édition par blocs du ChatMD:
 * - BlockParser: Analyse du markdown et extraction des blocs
 * - BlockRenderer: Rendu des blocs dans l'interface
 * - BlockEventHandler: Gestion des événements (drag & drop, etc.)
 * - BlockManager: Classe principale qui coordonne les autres
 */

/**
 * Classe pour l'analyse du markdown et l'extraction des blocs
 */
class BlockParser {
  /**
   * Analyse le markdown et extrait les blocs
   * @param {string} markdown - Le contenu markdown à analyser
   * @returns {Array} - Tableau des blocs extraits
   */
  parse(markdown) {
    try {
      const blocks = [];
      
      // Extraire l'en-tête YAML si présent
      let yamlHeader = '';
      let contentWithoutYaml = markdown;
      
      if (markdown.startsWith('---')) {
        const yamlEndIndex = markdown.indexOf('---', 3);
        if (yamlEndIndex !== -1) {
          yamlHeader = markdown.substring(3, yamlEndIndex).trim();
          contentWithoutYaml = markdown.substring(yamlEndIndex + 3).trim();
        }
      }
      
      // Découper le contenu en sections (titre principal + réponses)
      const mainTitleMatch = contentWithoutYaml.match(/# (.*?)(?:\n|$)/);
      let mainTitle = 'Mon Chatbot';
      let welcomeContent = '';
      
      if (mainTitleMatch) {
        mainTitle = mainTitleMatch[1].trim();
        
        // Extraire le contenu entre le titre et le premier bloc de réponse
        const titleIndex = contentWithoutYaml.indexOf('# ');
        if (titleIndex !== -1) {
          const afterTitleIndex = contentWithoutYaml.indexOf('\n', titleIndex);
          if (afterTitleIndex !== -1) {
            const nextSectionIndex = contentWithoutYaml.indexOf('## ', afterTitleIndex);
            if (nextSectionIndex !== -1) {
              welcomeContent = contentWithoutYaml.substring(afterTitleIndex + 1, nextSectionIndex).trim();
            } else {
              welcomeContent = contentWithoutYaml.substring(afterTitleIndex + 1).trim();
            }
          }
        }
      }
      
      console.log("YAML Header:", yamlHeader);
      console.log("Main Title:", mainTitle);
      console.log("Welcome Content:", welcomeContent);
      
      // Créer le bloc d'accueil
      const welcomeBlock = {
        id: 'welcome',
        type: 'welcome',
        title: mainTitle,
        content: welcomeContent,
        choices: this.extractChoices(welcomeContent),
        yaml: yamlHeader
      };
      blocks.push(welcomeBlock);
      
      // Extraire les blocs de réponse
      const sections = contentWithoutYaml.split('## ');
      for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const titleEnd = section.indexOf('\n');
        if (titleEnd === -1) continue; // Ignorer les sections sans contenu
        
        const title = section.substring(0, titleEnd).trim();
        const content = section.substring(titleEnd + 1).trim();
        
        const block = {
          id: title.replace(/\s+/g, '-').toLowerCase(),
          type: 'response',
          title: title,
          triggers: this.extractTriggers(content),
          content: this.extractContent(content),
          choices: this.extractChoices(content)
        };
        blocks.push(block);
      }
      
      return blocks;
    } catch (error) {
      console.error('Erreur lors de l\'analyse du markdown:', error);
      showNotification && showNotification(`Erreur lors de l'analyse du markdown: ${error.message}`, 'error');
      return []; // Retourner un tableau vide en cas d'erreur
    }
  }

  /**
   * Extrait les déclencheurs d'un bloc
   * @param {string} content - Le contenu du bloc
   * @returns {Array} - Tableau des déclencheurs
   */
  extractTriggers(content) {
    try {
      return content.split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.substring(2).trim());
    } catch (error) {
      console.error('Erreur lors de l\'extraction des déclencheurs:', error);
      return [];
    }
  }

  /**
   * Extrait le contenu principal d'un bloc (sans les déclencheurs)
   * @param {string} content - Le contenu brut du bloc
   * @returns {string} - Le contenu principal
   */
  extractContent(content) {
    try {
      const lines = content.split('\n');
      let contentText = '';
      let inTriggers = true;
      
      for (const line of lines) {
        if (inTriggers && !line.startsWith('- ')) {
          inTriggers = false;
        }
        
        if (!inTriggers) {
          contentText += line + '\n';
        }
      }
      
      // Enlever les choix du contenu pour éviter les doublons
      const contentWithoutChoices = contentText.split('\n')
        .filter(line => !line.match(/^\d+\.\s*\[.*?\]\(.*?\)/))
        .join('\n');
      
      console.log("Contenu extrait (sans les choix):", contentWithoutChoices);
      
      return contentWithoutChoices.trim();
    } catch (error) {
      console.error('Erreur lors de l\'extraction du contenu:', error);
      return '';
    }
  }

  /**
   * Extrait les choix (liens) d'un bloc
   * @param {string} content - Le contenu du bloc
   * @returns {Array} - Tableau des choix
   */
  extractChoices(content) {
    try {
      console.log("Extraction des choix à partir de:", content);
      
      const choices = content.split('\n')
        .filter(line => line.match(/^\d+\.\s*\[.*?\]\(.*?\)/))
        .map(line => {
          console.log("Ligne de choix trouvée:", line);
          const match = line.match(/\[(.*?)\]\((.*?)\)/);
          if (match) {
            return {
              text: match[1],
              target: match[2]
            };
          }
          return null;
        })
        .filter(choice => choice !== null);
      
      console.log("Choix extraits:", choices);
      return choices;
    } catch (error) {
      console.error('Erreur lors de l\'extraction des choix:', error);
      return [];
    }
  }

  /**
   * Génère le markdown à partir des blocs
   * @param {Array} blocks - Tableau des blocs
   * @returns {string} - Le markdown généré
   */
  generateMarkdown(blocks) {
    try {
      if (!blocks || blocks.length === 0) {
        throw new Error('Aucun bloc à convertir en markdown');
      }
      
      let markdown = '';
      
      // En-tête YAML (préserver s'il existe)
      const welcomeBlock = blocks[0];
      if (welcomeBlock.yaml) {
        markdown = `---\n${welcomeBlock.yaml}\n---\n\n`;
      }
      
      // Bloc d'accueil
      markdown += `# ${welcomeBlock.title}\n`;
      
      // Ajouter le contenu du bloc d'accueil (sans les choix)
      const welcomeContentWithoutChoices = welcomeBlock.content.split('\n')
        .filter(line => !line.match(/^\d+\.\s*\[.*?\]\(.*?\)/))
        .join('\n');
      
      markdown += welcomeContentWithoutChoices;
      
      // Ajouter les choix du bloc d'accueil
      if (welcomeBlock.choices && welcomeBlock.choices.length > 0) {
        if (!markdown.endsWith('\n')) {
          markdown += '\n';
        }
        
        welcomeBlock.choices.forEach((choice, index) => {
          markdown += `${index + 1}. [${choice.text}](${choice.target})\n`;
        });
      }
      
      // Blocs de réponses
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        markdown += `\n\n## ${block.title}\n`;
        
        // Ajouter les déclencheurs
        if (block.triggers && block.triggers.length > 0) {
          markdown += block.triggers.map(t => `- ${t}`).join('\n') + '\n';
        }
        
        // Ajouter le contenu (sans les choix)
        const contentWithoutChoices = block.content.split('\n')
          .filter(line => !line.match(/^\d+\.\s*\[.*?\]\(.*?\)/))
          .join('\n');
        
        markdown += contentWithoutChoices;
        
        // Ajouter les choix
        if (block.choices && block.choices.length > 0) {
          if (!markdown.endsWith('\n')) {
            markdown += '\n';
          }
          
          block.choices.forEach((choice, index) => {
            markdown += `${index + 1}. [${choice.text}](${choice.target})\n`;
          });
        }
      }
      
      return markdown;
    } catch (error) {
      console.error('Erreur lors de la génération du markdown:', error);
      showNotification && showNotification(`Erreur lors de la génération du markdown: ${error.message}`, 'error');
      return '';
    }
  }
}

/**
 * Classe pour le rendu des blocs dans l'interface
 */
class BlockRenderer {
  /**
   * Constructeur
   * @param {BlockManager} manager - Le gestionnaire de blocs
   */
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Rend le panneau des blocs
   * @param {Array} blocks - Tableau des blocs à rendre
   */
  renderBlockPanel(blocks) {
    try {
      const panel = document.getElementById('block-panel');
      if (!panel) return;
      
      panel.innerHTML = '';
      
      // Ajouter un bouton pour visualiser les liens
      const linksButton = document.createElement('button');
      linksButton.className = 'mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full';
      linksButton.innerHTML = '<i class="fas fa-project-diagram mr-2"></i>Visualiser les liens';
      linksButton.setAttribute('aria-label', 'Visualiser les liens entre les blocs');
      linksButton.addEventListener('click', () => this.showLinksModal(blocks));
      panel.appendChild(linksButton);
      
      // Ajouter les blocs
      blocks.forEach((block, index) => {
        const blockElement = this.createBlockElement(block, index);
        panel.appendChild(blockElement);
      });
      
      // Sélectionner et prévisualiser le premier bloc par défaut
      const firstBlock = panel.querySelector('.block-item');
      if (firstBlock) {
        firstBlock.classList.add('border-blue-500', 'border-2');
        window.previewBlock(0);
      }
    } catch (error) {
      console.error('Erreur lors du rendu du panneau des blocs:', error);
      showNotification && showNotification(`Erreur lors du rendu: ${error.message}`, 'error');
    }
  }

  /**
   * Crée un élément de bloc pour l'interface
   * @param {Object} block - Le bloc à rendre
   * @param {number} index - L'index du bloc
   * @returns {HTMLElement} - L'élément créé
   */
  createBlockElement(block, index) {
    const blockElement = document.createElement('div');
    blockElement.className = `block-item p-4 mb-4 border rounded-lg ${block.type === 'welcome' ? 'bg-blue-50 border-blue-200' : 'bg-white'} cursor-pointer`;
    blockElement.dataset.index = index;
    blockElement.dataset.id = block.id;
    blockElement.setAttribute('role', 'button');
    blockElement.setAttribute('aria-label', `Bloc: ${block.title}`);
    blockElement.setAttribute('tabindex', '0');
    
    // Ajouter un événement de clic pour prévisualiser le bloc
    blockElement.addEventListener('click', () => {
      // Mettre en évidence le bloc sélectionné
      document.querySelectorAll('.block-item').forEach(el => {
        el.classList.remove('border-blue-500', 'border-2');
        el.setAttribute('aria-selected', 'false');
      });
      blockElement.classList.add('border-blue-500', 'border-2');
      blockElement.setAttribute('aria-selected', 'true');
      
      // Prévisualiser le bloc
      window.previewBlock(index);
    });
    
    // Support clavier
    blockElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        blockElement.click();
      }
    });
    
    // En-tête du bloc
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-2';
    
    const title = document.createElement('h3');
    title.className = 'font-bold text-lg';
    title.textContent = block.title;
    header.appendChild(title);
    
    const actions = document.createElement('div');
    actions.className = 'flex space-x-1';
    
    // Bouton d'édition
    const editButton = document.createElement('button');
    editButton.className = 'edit-block p-1 text-blue-600 hover:bg-blue-50 rounded';
    editButton.title = 'Modifier';
    editButton.setAttribute('aria-label', `Modifier le bloc: ${block.title}`);
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Empêcher le clic de se propager au bloc parent
      this.manager.editBlock(index);
    });
    actions.appendChild(editButton);
    
    // Bouton de suppression (sauf pour le bloc d'accueil)
    if (block.type !== 'welcome') {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-block p-1 text-red-600 hover:bg-red-50 rounded';
      deleteButton.title = 'Supprimer';
      deleteButton.setAttribute('aria-label', `Supprimer le bloc: ${block.title}`);
      deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêcher le clic de se propager au bloc parent
        this.manager.deleteBlock(index);
      });
      actions.appendChild(deleteButton);
    }
    
    header.appendChild(actions);
    blockElement.appendChild(header);
    
    // Contenu du bloc
    const content = document.createElement('div');
    content.className = 'mt-2';
    
    // Déclencheurs (pour les blocs de réponse)
    if (block.type === 'response' && block.triggers.length > 0) {
      const triggers = document.createElement('div');
      triggers.className = 'triggers mb-2 flex flex-wrap gap-1';
      triggers.setAttribute('aria-label', 'Déclencheurs');
      
      block.triggers.forEach(trigger => {
        const triggerTag = document.createElement('span');
        triggerTag.className = 'inline-block px-2 py-1 bg-gray-100 rounded-full text-xs';
        triggerTag.textContent = trigger;
        triggers.appendChild(triggerTag);
      });
      
      content.appendChild(triggers);
    }
    
    // Aperçu du contenu
    const preview = document.createElement('div');
    preview.className = 'content-preview text-sm text-gray-600 mb-2';
    
    // Limiter l'aperçu à la première ligne
    const previewText = block.content.split('\n')[0] || ''; // Première ligne du contenu
    preview.textContent = previewText.length > 100 ? previewText.substring(0, 100) + '...' : previewText;
    
    content.appendChild(preview);
    
    // Choix/liens
    if (block.choices.length > 0) {
      const choices = document.createElement('div');
      choices.className = 'choices mt-2 flex flex-wrap gap-1';
      choices.setAttribute('aria-label', 'Choix disponibles');
      
      block.choices.forEach(choice => {
        const choiceTag = document.createElement('div');
        choiceTag.className = 'choice-item flex items-center mb-1';
        choiceTag.innerHTML = `
          <span class="inline-block px-2 py-1 bg-blue-100 rounded text-xs">
            <i class="fas fa-arrow-right mr-1" aria-hidden="true"></i>${choice.text} → ${choice.target}
          </span>
        `;
        choices.appendChild(choiceTag);
      });
      
      content.appendChild(choices);
    }
    
    blockElement.appendChild(content);
    
    // Rendre le bloc draggable (sauf le bloc d'accueil)
    if (block.type !== 'welcome') {
      blockElement.draggable = true;
      blockElement.setAttribute('aria-grabbed', 'false');
      
      blockElement.addEventListener('dragstart', (e) => {
        blockElement.setAttribute('aria-grabbed', 'true');
        this.manager.eventHandler.handleDragStart(e);
      });
      
      blockElement.addEventListener('dragend', () => {
        blockElement.setAttribute('aria-grabbed', 'false');
      });
      
      blockElement.addEventListener('dragover', (e) => this.manager.eventHandler.handleDragOver(e));
      blockElement.addEventListener('drop', (e) => this.manager.eventHandler.handleDrop(e));
    }
    
    return blockElement;
  }

  /**
   * Affiche la modal des liens entre les blocs
   * @param {Array} blocks - Tableau des blocs
   */
  showLinksModal(blocks) {
    try {
      const modal = document.getElementById('links-modal');
      const diagram = document.getElementById('links-diagram');
      
      if (!modal || !diagram) {
        console.warn('Éléments de modal non trouvés');
        return;
      }
      
      // Générer un diagramme simple des liens
      let html = '<div class="flex flex-col items-center">';
      
      // Ajouter le bloc d'accueil
      html += `
        <div class="block-diagram-item bg-blue-100 p-3 rounded-lg border border-blue-300 mb-4 w-64 text-center">
          <h3 class="font-bold">${blocks[0].title}</h3>
        </div>
      `;
      
      // Ajouter les flèches vers les premiers blocs liés
      const welcomeLinks = blocks[0].choices.map(choice => choice.target);
      if (welcomeLinks.length > 0) {
        html += '<div class="w-0.5 h-8 bg-blue-500"></div>';
        html += '<div class="flex flex-wrap justify-center gap-4 mb-4">';
        
        welcomeLinks.forEach(target => {
          const targetBlock = blocks.find(b => b.title === target);
          if (targetBlock) {
            html += `
              <div class="flex flex-col items-center mb-2">
                <div class="block-diagram-item bg-white p-3 rounded-lg border border-gray-300 w-48 text-center">
                  <h3 class="font-bold">${targetBlock.title}</h3>
                </div>
              </div>
            `;
          }
        });
        
        html += '</div>';
      }
      
      html += '</div>';
      
      // Afficher tous les autres liens
      html += '<div class="mt-8 border-t pt-4">';
      html += '<h3 class="font-bold mb-4">Tous les liens</h3>';
      html += '<ul class="space-y-2">';
      
      blocks.forEach(block => {
        if (block.choices.length > 0) {
          block.choices.forEach(choice => {
            html += `
              <li class="flex items-center flex-wrap">
                <span class="font-medium">${block.title}</span>
                <span class="mx-2">→</span>
                <span class="bg-blue-100 px-2 py-1 rounded">${choice.text}</span>
                <span class="mx-2">→</span>
                <span class="font-medium">${choice.target}</span>
              </li>
            `;
          });
        }
      });
      
      html += '</ul>';
      html += '</div>';
      
      diagram.innerHTML = html;
      modal.classList.remove('hidden');
      
      // Focus sur le bouton de fermeture pour l'accessibilité
      const closeButton = document.getElementById('close-links-modal');
      if (closeButton) {
        closeButton.focus();
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la modal des liens:', error);
      showNotification && showNotification(`Erreur: ${error.message}`, 'error');
    }
  }
}

/**
 * Classe pour la gestion des événements
 */
class BlockEventHandler {
  /**
   * Constructeur
   * @param {BlockManager} manager - Le gestionnaire de blocs
   */
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Configure les écouteurs d'événements
   */
  setupEventListeners() {
    try {
      // Bouton d'ajout de bloc
      const addBlockBtn = document.getElementById('add-block-btn');
      if (addBlockBtn) {
        addBlockBtn.addEventListener('click', () => this.manager.addNewBlock());
      }
      
      // Bouton d'ajout de choix
      const addChoiceBtn = document.getElementById('add-choice-btn');
      if (addChoiceBtn) {
        addChoiceBtn.addEventListener('click', () => this.manager.addChoice());
      }
      
      // Bouton de sauvegarde de bloc
      const saveBlockBtn = document.getElementById('save-block-btn');
      if (saveBlockBtn) {
        saveBlockBtn.addEventListener('click', () => this.manager.saveEditedBlock());
      }
      
      // Bouton d'annulation
      const cancelEditBtn = document.getElementById('cancel-edit-btn');
      if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => this.manager.cancelEdit());
      }
      
      // Modal des liens
      const closeLinksModal = document.getElementById('close-links-modal');
      if (closeLinksModal) {
        closeLinksModal.addEventListener('click', () => {
          document.getElementById('links-modal').classList.add('hidden');
        });
        
        // Fermer la modal avec Escape
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            const modal = document.getElementById('links-modal');
            if (modal && !modal.classList.contains('hidden')) {
              modal.classList.add('hidden');
            }
          }
        });
      }
      
      // Toggle du markdown
      this.setupMarkdownToggle();
    } catch (error) {
      console.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
    }
  }

  /**
   * Configure le toggle du markdown
   */
  setupMarkdownToggle() {
    try {
      const toggleBtn = document.getElementById('toggle-markdown');
      const markdownSection = document.getElementById('markdown-section');
      
      if (toggleBtn && markdownSection) {
        toggleBtn.addEventListener('click', () => {
          markdownSection.classList.toggle('open');
          const icon = toggleBtn.querySelector('i');
          if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
          }
          
          // Mettre à jour l'attribut aria-expanded
          const isExpanded = markdownSection.classList.contains('open');
          toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        });
      }
    } catch (error) {
      console.error('Erreur lors de la configuration du toggle markdown:', error);
    }
  }

  /**
   * Gère le début du drag and drop
   * @param {DragEvent} e - L'événement de drag start
   */
  handleDragStart(e) {
    try {
      e.dataTransfer.setData('text/plain', e.currentTarget.dataset.index);
      
      // Ajouter une classe pour le style pendant le drag
      e.currentTarget.classList.add('opacity-50');
      
      // Annoncer pour les lecteurs d'écran
      this.announceForScreenReader('Début du déplacement du bloc');
    } catch (error) {
      console.error('Erreur lors du début du drag and drop:', error);
    }
  }

  /**
   * Gère le survol pendant le drag and drop
   * @param {DragEvent} e - L'événement de drag over
   */
  handleDragOver(e) {
    e.preventDefault();
    // Ajouter un style pour indiquer la zone de drop
    e.currentTarget.classList.add('border-dashed', 'border-blue-400');
  }

  /**
   * Gère la fin du survol pendant le drag and drop
   * @param {DragEvent} e - L'événement de drag leave
   */
  handleDragLeave(e) {
    // Retirer le style de la zone de drop
    e.currentTarget.classList.remove('border-dashed', 'border-blue-400');
  }

  /**
   * Gère le drop
   * @param {DragEvent} e - L'événement de drop
   */
  handleDrop(e) {
    try {
      e.preventDefault();
      
      // Retirer les styles de drag
      document.querySelectorAll('.block-item').forEach(el => {
        el.classList.remove('opacity-50', 'border-dashed', 'border-blue-400');
      });
      
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toElement = e.currentTarget.closest('.block-item');
      if (!toElement) return;
      
      const toIndex = parseInt(toElement.dataset.index);
      
      // Ne pas permettre de déplacer le bloc d'accueil
      if (fromIndex === 0 || toIndex === 0) {
        this.announceForScreenReader('Impossible de déplacer le bloc d\'accueil');
        return;
      }
      
      this.manager.moveBlock(fromIndex, toIndex);
      this.announceForScreenReader('Bloc déplacé avec succès');
    } catch (error) {
      console.error('Erreur lors du drop:', error);
      this.announceForScreenReader('Erreur lors du déplacement du bloc');
    }
  }

  /**
   * Annonce un message pour les lecteurs d'écran
   * @param {string} message - Le message à annoncer
   */
  announceForScreenReader(message) {
    // Créer un élément pour les annonces si nécessaire
    let announcer = document.getElementById('sr-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.setAttribute('aria-live', 'assertive');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
    }
    
    // Annoncer le message
    announcer.textContent = message;
    
    // Effacer après un court délai
    setTimeout(() => {
      announcer.textContent = '';
    }, 3000);
  }
}

// La classe BlockManager est définie dans block-editor-part2.js
