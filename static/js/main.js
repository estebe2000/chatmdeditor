/**
 * ChatMD Editor - Main JavaScript
 * 
 * Ce fichier contient les fonctionnalités principales de l'éditeur ChatMD:
 * - Gestion de la prévisualisation
 * - Sauvegarde automatique
 * - Import/export de fichiers
 * - Manipulation du YAML
 */

document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const editor = document.getElementById('markdown-editor');
    const preview = document.getElementById('preview');
    const fileInput = document.getElementById('fileInput');
    const statusIndicator = createStatusIndicator();
    const toggleParams = document.getElementById('toggle-params');
    const paramsContent = document.getElementById('params-content');
    
    // Configurer le toggle des paramètres
    if (toggleParams && paramsContent) {
        // Cacher le contenu des paramètres par défaut
        paramsContent.classList.add('hidden');
        
        toggleParams.addEventListener('click', function() {
            paramsContent.classList.toggle('hidden');
            const icon = toggleParams.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    }
    
    // Configuration
    const converter = new showdown.Converter({
        tables: true,
        tasklists: true,
        strikethrough: true,
        emoji: true
    });
    
    // Variables pour le debouncing
    let previewTimeout = null;
    let saveTimeout = null;
    const DEBOUNCE_DELAY = 500; // ms
    
    // Initialiser la prévisualisation
    updatePreview();
    
    // Ajouter l'indicateur de statut
    document.querySelector('.container').appendChild(statusIndicator);

    // Écouter les modifications de l'éditeur
    editor.addEventListener('input', function() {
        // Debounce la prévisualisation
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            updatePreview();
        }, 300);
        
        // Debounce la sauvegarde
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveToServer();
        }, DEBOUNCE_DELAY);
    });

    // Gérer le téléchargement de fichier
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Vérifier la taille du fichier
        if (file.size > 5 * 1024 * 1024) { // 5MB
            showNotification('Erreur: Fichier trop volumineux (max: 5MB)', 'error');
            return;
        }
        
        // Vérifier l'extension
        if (!file.name.toLowerCase().endsWith('.md')) {
            showNotification('Erreur: Format de fichier non supporté (seul .md est accepté)', 'error');
            return;
        }
        
        showNotification('Chargement du fichier...', 'info');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                editor.value = e.target.result;
                updatePreview();
                saveToServer();
                
                // Mettre à jour l'éditeur de blocs
                if (window.blockEditor) {
                    window.blockEditor.parseMarkdown(editor.value);
                    window.blockEditor.renderBlockPanel();
                }
                
                showNotification('Fichier chargé avec succès', 'success');
            } catch (error) {
                console.error('Erreur lors du chargement du fichier:', error);
                showNotification('Erreur lors du chargement du fichier', 'error');
            }
        };
        
        reader.onerror = function() {
            console.error('Erreur lors de la lecture du fichier');
            showNotification('Erreur lors de la lecture du fichier', 'error');
        };
        
        reader.readAsText(file);
    });

    /**
     * Fonctions de prévisualisation
     */
    
    // Mettre à jour la prévisualisation
    function updatePreview() {
        try {
            const markdown = editor.value;
            renderWelcomeView(markdown);
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la prévisualisation:', error);
            preview.innerHTML = `<div class="p-4 bg-red-100 text-red-800 rounded">
                Erreur lors de la prévisualisation: ${error.message}
            </div>`;
        }
    }

    // Rendre la vue d'accueil
    function renderWelcomeView(markdown) {
        try {
            // Ignorer l'en-tête YAML si présent
            let cleanMarkdown = markdown;
            if (markdown.startsWith('---')) {
                const yamlEndIndex = markdown.indexOf('---', 3);
                if (yamlEndIndex !== -1) {
                    cleanMarkdown = markdown.substring(yamlEndIndex + 3).trim();
                }
            }
            
            // Extraire le contenu après le titre
            const titleMatch = cleanMarkdown.match(/# (.*?)(?:\n|$)/);
            const title = titleMatch ? titleMatch[1].trim() : 'Mon Chatbot';
            
            // Extraire le contenu entre le titre et le premier bloc de réponse
            let contentAfterTitle = '';
            const titleIndex = cleanMarkdown.indexOf('# ');
            if (titleIndex !== -1) {
                const afterTitleIndex = cleanMarkdown.indexOf('\n', titleIndex);
                if (afterTitleIndex !== -1) {
                    const nextSectionIndex = cleanMarkdown.indexOf('## ', afterTitleIndex);
                    if (nextSectionIndex !== -1) {
                        contentAfterTitle = cleanMarkdown.substring(afterTitleIndex + 1, nextSectionIndex).trim();
                    } else {
                        contentAfterTitle = cleanMarkdown.substring(afterTitleIndex + 1).trim();
                    }
                }
            }
            
            // Extraire les options de réponse
            const options = contentAfterTitle.match(/\d+\.\s*\[.*?\]\(.*?\)/g) || [];
            
            // Extraire le contenu sans les options
            const welcomeContent = contentAfterTitle.replace(/\d+\.\s*\[.*?\]\(.*?\)/g, '').trim();
            
            console.log("Titre:", title);
            console.log("Contenu d'accueil:", welcomeContent);
            console.log("Options:", options);
            
            // Créer l'interface du chatbot
            let html = `
                <div class="bg-blue-50 rounded-lg p-4 min-h-[500px] flex flex-col relative" role="region" aria-label="Prévisualisation du chatbot">
                    <h1 class="text-2xl font-bold text-center mb-6">${title}</h1>
                    <div class="flex items-start mb-4">
                        <div class="bg-blue-600 text-white rounded-full p-2 mr-2 flex-shrink-0" aria-hidden="true">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div>
                            ${converter.makeHtml(welcomeContent)}
                        </div>
                    </div>
            `;

            // Afficher les options de réponse
            if (options.length > 0) {
                html += `<div class="flex flex-wrap gap-2 mb-4 ml-12" role="group" aria-label="Options de réponse">`;
                options.forEach((opt, index) => {
                    const match = opt.match(/\[(.*?)\]\((.*?)\)/);
                    if (match) {
                        html += `
                            <button onclick="showResponse('${match[2]}')" 
                                    class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                                    aria-label="Sélectionner l'option: ${match[1]}"
                                    tabindex="0">
                                ${match[1]}
                            </button>`;
                    }
                });
                html += `</div>`;
            }

            // Ajouter une zone de saisie pour simuler l'interaction
            html += `
                    <div class="mt-auto">
                        <div class="flex items-center">
                            <input type="text" placeholder="Tapez votre message..." 
                                   class="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none" 
                                   disabled aria-label="Zone de saisie (désactivée en prévisualisation)">
                            <button class="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 transition" 
                                    disabled aria-label="Envoyer (désactivé en prévisualisation)">
                                <i class="fas fa-paper-plane" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            preview.innerHTML = html;
        } catch (error) {
            console.error('Erreur lors du rendu de la vue d\'accueil:', error);
            preview.innerHTML = `<div class="p-4 bg-red-100 text-red-800 rounded">
                Erreur lors du rendu: ${error.message}
            </div>`;
        }
    }

    /**
     * Fonctions de navigation et d'affichage des réponses
     */
    
    // Afficher une réponse spécifique
    window.showResponse = function(title) {
        try {
            renderResponseView(title);
        } catch (error) {
            console.error('Erreur lors de l\'affichage de la réponse:', error);
            showNotification(`Erreur lors de l'affichage de la réponse: ${error.message}`, 'error');
        }
    };

    // Rendre la vue d'une réponse spécifique
    function renderResponseView(title) {
        try {
            // Ignorer l'en-tête YAML si présent
            let markdown = editor.value;
            if (markdown.startsWith('---')) {
                const yamlEndIndex = markdown.indexOf('---', 3);
                if (yamlEndIndex !== -1) {
                    markdown = markdown.substring(yamlEndIndex + 3).trim();
                }
            }
            
            const sections = markdown.split('## ');
            
            for (let i = 1; i < sections.length; i++) {
                const section = sections[i];
                if (section.startsWith(title) || section.startsWith(title + '\n')) {
                    const titleEnd = section.indexOf('\n');
                    const content = section.substring(titleEnd + 1).trim();
                    
                    console.log("Titre de section:", title);
                    console.log("Contenu brut:", content);
                    
                    // Extraire les déclencheurs et le contenu
                    const lines = content.split('\n');
                    const triggers = [];
                    let responseContent = '';
                    let inTriggers = true;
                    
                    for (const line of lines) {
                        if (inTriggers && line.startsWith('- ')) {
                            triggers.push(line.substring(2).trim());
                        } else {
                            inTriggers = false;
                            responseContent += line + '\n';
                        }
                    }
                    
                    // Extraire les options de réponse
                    const options = responseContent.match(/\d+\.\s*\[.*?\]\(.*?\)/g) || [];
                    
                    // Extraire le contenu sans les options
                    const cleanContent = responseContent.replace(/\d+\.\s*\[.*?\]\(.*?\)/g, '').trim();
                    
                    // Créer l'interface de réponse
                    let html = `
                        <div class="bg-blue-50 rounded-lg p-4 min-h-[500px] flex flex-col relative" role="region" aria-label="Réponse du chatbot">
                            <h1 class="text-2xl font-bold text-center mb-6">${title}</h1>
                            <div class="flex justify-end mb-4">
                                <button class="bg-blue-500 text-white px-4 py-2 rounded-lg" aria-label="Simulation de sélection">
                                    Afficher ${title}
                                </button>
                            </div>
                            <div class="flex items-start mb-4">
                                <div class="bg-blue-600 text-white rounded-full p-2 mr-2 flex-shrink-0" aria-hidden="true">
                                    <i class="fas fa-robot"></i>
                                </div>
                                <div>
                                    ${converter.makeHtml(cleanContent)}
                                </div>
                            </div>
                    `;

                    // Afficher les options de réponse
                    if (options.length > 0) {
                        html += `<div class="flex flex-wrap gap-2 mb-4 ml-12" role="group" aria-label="Options de réponse">`;
                        options.forEach((opt, index) => {
                            const match = opt.match(/\[(.*?)\]\((.*?)\)/);
                            if (match) {
                                html += `
                                    <button onclick="showResponse('${match[2]}')" 
                                            class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
                                            aria-label="Sélectionner l'option: ${match[1]}"
                                            tabindex="0">
                                        ${match[1]}
                                    </button>`;
                            }
                        });
                        html += `</div>`;
                    }

                    // Ajouter une zone de saisie pour simuler l'interaction
                    html += `
                            <div class="mt-auto">
                                <div class="flex items-center">
                                    <input type="text" placeholder="Tapez votre message..." 
                                           class="flex-1 p-2 border border-gray-300 rounded-l focus:outline-none" 
                                           disabled aria-label="Zone de saisie (désactivée en prévisualisation)">
                                    <button class="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 transition" 
                                            disabled aria-label="Envoyer (désactivé en prévisualisation)">
                                        <i class="fas fa-paper-plane" aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    preview.innerHTML = html;
                    return;
                }
            }
            
            // Si on arrive ici, c'est que le bloc n'a pas été trouvé
            preview.innerHTML = `
                <div class="p-4 bg-yellow-100 text-yellow-800 rounded">
                    <p>Bloc "${title}" non trouvé dans le document.</p>
                </div>
            `;
        } catch (error) {
            console.error('Erreur lors du rendu de la vue de réponse:', error);
            preview.innerHTML = `<div class="p-4 bg-red-100 text-red-800 rounded">
                Erreur lors du rendu: ${error.message}
            </div>`;
        }
    }

    /**
     * Fonctions de prévisualisation des blocs
     */
    
    // Prévisualiser un bloc spécifique
    window.previewBlock = function(index) {
        try {
            if (!window.blockEditor || !window.blockEditor.blocks) {
                console.warn('Éditeur de blocs non initialisé');
                return;
            }
            
            const block = window.blockEditor.blocks[index];
            if (!block) {
                console.warn(`Bloc d'index ${index} non trouvé`);
                return;
            }
            
            if (block.type === 'welcome') {
                renderWelcomeView(editor.value); // Afficher la vue d'accueil
            } else {
                renderResponseView(block.title); // Afficher la réponse spécifique
            }
        } catch (error) {
            console.error('Erreur lors de la prévisualisation du bloc:', error);
            showNotification(`Erreur lors de la prévisualisation: ${error.message}`, 'error');
        }
    };

    /**
     * Fonctions de communication avec le serveur
     */
    
    // Sauvegarder sur le serveur
    function saveToServer() {
        updateStatus('saving');
        
        fetch('/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `markdown=${encodeURIComponent(editor.value)}`
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            updateStatus('saved');
        })
        .catch(error => {
            console.error('Erreur lors de la sauvegarde:', error);
            updateStatus('error', error.message);
            showNotification(`Erreur lors de la sauvegarde: ${error.message}`, 'error');
        });
    }

    /**
     * Fonctions de gestion de fichiers
     */
    
    // Nouveau fichier
    window.newFile = function() {
        if (confirm('Voulez-vous créer un nouveau fichier ? Les modifications non enregistrées seront perdues.')) {
            try {
                // Récupérer le template depuis le serveur
                fetch('/config')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Erreur serveur: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(config => {
                        const template = config.base_template || `---
gestionGrosMots: true
titresRéponses: ["##"]
---

# Mon Chatbot
Message initial du chatbot
1. [Premier choix](Réponse 1)
2. [Deuxième choix](Réponse 2)

## Réponse 1
- déclencheur 1
- déclencheur 2
Contenu de la réponse 1
1. [Option 1](Option 1)
2. [Option 2](Option 2)

## Réponse 2
- déclencheur
Contenu de la réponse 2`;
                        
                        editor.value = template;
                        updatePreview();
                        saveToServer();
                        
                        // Mettre à jour l'éditeur de blocs
                        if (window.blockEditor) {
                            window.blockEditor.parseMarkdown(editor.value);
                            window.blockEditor.renderBlockPanel();
                        }
                        
                        showNotification('Nouveau fichier créé', 'success');
                    })
                    .catch(error => {
                        console.error('Erreur lors de la création du nouveau fichier:', error);
                        
                        // Fallback au template par défaut
                        editor.value = `---
gestionGrosMots: true
titresRéponses: ["## "]
---

# Mon Chatbot
Message initial du chatbot
1. [Premier choix](Réponse 1)
2. [Deuxième choix](Réponse 2)

## Réponse 1
- déclencheur 1
- déclencheur 2
Contenu de la réponse 1
1. [Option 1](Option 1)
2. [Option 2](Option 2)

## Réponse 2
- déclencheur
Contenu de la réponse 2`;
                        updatePreview();
                        saveToServer();
                        
                        // Mettre à jour l'éditeur de blocs
                        if (window.blockEditor) {
                            window.blockEditor.parseMarkdown(editor.value);
                            window.blockEditor.renderBlockPanel();
                        }
                        
                        showNotification('Nouveau fichier créé (mode hors ligne)', 'warning');
                    });
            } catch (error) {
                console.error('Erreur lors de la création du nouveau fichier:', error);
                showNotification(`Erreur: ${error.message}`, 'error');
            }
        }
    };

    // Télécharger le fichier
    window.downloadFile = function() {
        try {
            showNotification('Préparation du téléchargement...', 'info');
            
            fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `markdown=${encodeURIComponent(editor.value)}`
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur serveur: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'chatbot.md';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showNotification('Téléchargement terminé', 'success');
            })
            .catch(error => {
                console.error('Erreur lors du téléchargement:', error);
                showNotification(`Erreur lors du téléchargement: ${error.message}`, 'error');
            });
        } catch (error) {
            console.error('Erreur lors du téléchargement:', error);
            showNotification(`Erreur: ${error.message}`, 'error');
        }
    };
    
    // Charger un exemple
    window.loadExample = function(example) {
        try {
            if (!confirm(`Voulez-vous charger l'exemple "${example}" ? Les modifications non enregistrées seront perdues.`)) {
                return;
            }
            
            showNotification(`Chargement de l'exemple "${example}"...`, 'info');
            
            // Charger le fichier exemple
            fetch(`/models/${example}.md`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Erreur lors du chargement de l'exemple: ${response.status}`);
                    }
                    return response.text();
                })
                .then(content => {
                    // Mettre à jour l'éditeur
                    editor.value = content;
                    
                    // Mettre à jour la prévisualisation
                    updatePreview();
                    
                    // Sauvegarder sur le serveur
                    saveToServer();
                    
                    // Mettre à jour l'éditeur de blocs
                    if (window.blockEditor) {
                        window.blockEditor.parseMarkdown(content);
                        window.blockEditor.renderBlockPanel();
                    }
                    
                    // Ouvrir la section markdown si elle est fermée
                    const markdownSection = document.getElementById('markdown-section');
                    if (markdownSection && !markdownSection.classList.contains('open')) {
                        markdownSection.classList.add('open');
                        const toggleBtn = document.getElementById('toggle-markdown');
                        if (toggleBtn) {
                            const icon = toggleBtn.querySelector('i');
                            if (icon) {
                                icon.classList.remove('fa-chevron-down');
                                icon.classList.add('fa-chevron-up');
                            }
                            toggleBtn.setAttribute('aria-expanded', 'true');
                        }
                    }
                    
                    showNotification(`Exemple "${example}" chargé avec succès`, 'success');
                })
                .catch(error => {
                    console.error(`Erreur lors du chargement de l'exemple "${example}":`, error);
                    showNotification(`Erreur: ${error.message}`, 'error');
                });
        } catch (error) {
            console.error(`Erreur lors du chargement de l'exemple "${example}":`, error);
            showNotification(`Erreur: ${error.message}`, 'error');
        }
    };

    /**
     * Fonctions de manipulation du YAML
     */
    
    // Mettre à jour l'en-tête YAML
    window.updateYaml = function() {
        try {
            const gestionGrosMots = document.getElementById('yaml-grosmots').value;
            let markdown = editor.value;
            
            // Si aucun en-tête YAML n'est trouvé, en créer un
            if (!markdown.includes('---')) {
                // Créer un nouvel en-tête YAML
                const yamlHeader = `---
gestionGrosMots: ${gestionGrosMots}
titresRéponses: ["## "]
---

`;
                // Ajouter l'en-tête au début du document
                markdown = yamlHeader + markdown;
                editor.value = markdown;
                showNotification('En-tête YAML créé', 'success');
            } else {
                const parts = markdown.split('---');
                if (parts.length < 3) {
                    // Format invalide, créer un nouvel en-tête
                    const yamlHeader = `---
gestionGrosMots: ${gestionGrosMots}
titresRéponses: ["## "]
---

`;
                    // Remplacer l'en-tête invalide
                    markdown = yamlHeader + parts.slice(1).join('---');
                    editor.value = markdown;
                    showNotification('En-tête YAML corrigé', 'success');
                } else {
                    let yamlPart = parts[1];
                    
                    // Mettre à jour ou ajouter gestionGrosMots
                    if (yamlPart.includes('gestionGrosMots:')) {
                        yamlPart = yamlPart.replace(
                            /gestionGrosMots:\s*.+/,
                            `gestionGrosMots: ${gestionGrosMots}`
                        );
                    } else {
                        yamlPart = `gestionGrosMots: ${gestionGrosMots}\n${yamlPart}`;
                    }
                    
                    markdown = `${parts[0]}---${yamlPart}---${parts.slice(2).join('---')}`;
                    editor.value = markdown;
                    showNotification('En-tête YAML mis à jour', 'success');
                }
            }
            
            updatePreview();
            saveToServer();
            
            // Mettre à jour l'éditeur de blocs
            if (window.blockEditor) {
                window.blockEditor.parseMarkdown(editor.value);
                window.blockEditor.renderBlockPanel();
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du YAML:', error);
            showNotification(`Erreur: ${error.message}`, 'error');
        }
    };
    
    // Mettre à jour tous les paramètres YAML
    window.updateAllYaml = function() {
        try {
            // Récupérer les valeurs des champs
            const gestionGrosMots = document.getElementById('yaml-grosmots').value;
            const searchInContent = document.getElementById('yaml-searchInContent').value;
            const detectBadWords = document.getElementById('yaml-detectBadWords').value;
            const style = document.getElementById('yaml-style').value.trim();
            const avatar = document.getElementById('yaml-avatar').value.trim();
            const avatarCercle = document.getElementById('yaml-avatarCercle').value;
            const favicon = document.getElementById('yaml-favicon').value.trim();
            const footer = document.getElementById('yaml-footer').value.trim();
            const theme = document.getElementById('yaml-theme').value.trim();
            const typewriter = document.getElementById('yaml-typewriter').value;
            const clavier = document.getElementById('yaml-clavier').value;
            
            // Récupérer les valeurs des champs LLM
            const llmUrl = document.getElementById('yaml-llm-url').value.trim();
            const llmModel = document.getElementById('yaml-llm-model').value.trim();
            const llmInformations = document.getElementById('yaml-llm-informations').value.trim();
            const llmMaxTopElements = document.getElementById('yaml-llm-maxTopElements').value.trim();
            const llmMaxTokens = document.getElementById('yaml-llm-maxTokens').value.trim();
            
            let markdown = editor.value;
            let yamlPart = '';
            let parts = [];
            
            // Si aucun en-tête YAML n'est trouvé, en créer un
            if (!markdown.includes('---')) {
                // Créer un nouvel en-tête YAML
                const yamlHeader = `---
gestionGrosMots: ${gestionGrosMots}
titresRéponses: ["## "]
searchInContent: ${searchInContent}
detectBadWords: ${detectBadWords}
${style ? `style: "${style}"\n` : ''}${avatar ? `avatar: "${avatar}"\n` : ''}avatarCercle: ${avatarCercle}
${favicon ? `favicon: "${favicon}"\n` : ''}${footer ? (footer.toLowerCase() === 'false' ? 'footer: false\n' : `footer: "${footer}"\n`) : ''}${theme ? `theme: "${theme}"\n` : ''}typewriter: ${typewriter}
clavier: ${clavier}
---

`;
                // Ajouter l'en-tête au début du document
                markdown = yamlHeader + markdown;
                editor.value = markdown;
                showNotification('En-tête YAML créé avec tous les paramètres', 'success');
                
                updatePreview();
                saveToServer();
                
                // Mettre à jour l'éditeur de blocs
                if (window.blockEditor) {
                    window.blockEditor.parseMarkdown(editor.value);
                    window.blockEditor.renderBlockPanel();
                }
                
                return;
            }
            
            parts = markdown.split('---');
            if (parts.length < 3) {
                // Format invalide, créer un nouvel en-tête
                const yamlHeader = `---
gestionGrosMots: ${gestionGrosMots}
titresRéponses: ["## "]
searchInContent: ${searchInContent}
detectBadWords: ${detectBadWords}
${style ? `style: "${style}"\n` : ''}${avatar ? `avatar: "${avatar}"\n` : ''}avatarCercle: ${avatarCercle}
${favicon ? `favicon: "${favicon}"\n` : ''}${footer ? (footer.toLowerCase() === 'false' ? 'footer: false\n' : `footer: "${footer}"\n`) : ''}${theme ? `theme: "${theme}"\n` : ''}typewriter: ${typewriter}
clavier: ${clavier}
---

`;
                // Remplacer l'en-tête invalide
                markdown = yamlHeader + parts.slice(1).join('---');
                editor.value = markdown;
                showNotification('En-tête YAML corrigé avec tous les paramètres', 'success');
                
                updatePreview();
                saveToServer();
                
                // Mettre à jour l'éditeur de blocs
                if (window.blockEditor) {
                    window.blockEditor.parseMarkdown(editor.value);
                    window.blockEditor.renderBlockPanel();
                }
                
                return;
            }
            
            yamlPart = parts[1];
            
            // Fonction pour mettre à jour ou ajouter un paramètre YAML
            function updateYamlParam(param, value) {
                if (value === '') return; // Ne pas ajouter de paramètre vide
                
                const regex = new RegExp(`${param}:\\s*.+`, 'g');
                if (yamlPart.includes(`${param}:`)) {
                    yamlPart = yamlPart.replace(regex, `${param}: ${value}`);
                } else {
                    yamlPart = `${param}: ${value}\n${yamlPart}`;
                }
            }
            
            // Mettre à jour tous les paramètres
            updateYamlParam('gestionGrosMots', gestionGrosMots);
            updateYamlParam('searchInContent', searchInContent);
            updateYamlParam('detectBadWords', detectBadWords);
            if (style) updateYamlParam('style', `"${style}"`);
            if (avatar) updateYamlParam('avatar', `"${avatar}"`);
            updateYamlParam('avatarCercle', avatarCercle);
            if (favicon) updateYamlParam('favicon', `"${favicon}"`);
            if (footer) {
                if (footer.toLowerCase() === 'false') {
                    updateYamlParam('footer', 'false');
                } else {
                    updateYamlParam('footer', `"${footer}"`);
                }
            }
            if (theme) updateYamlParam('theme', `"${theme}"`);
            updateYamlParam('typewriter', typewriter);
            updateYamlParam('clavier', clavier);
            
            // Gérer la configuration LLM (structure imbriquée)
            if (llmUrl || llmModel || llmInformations || llmMaxTopElements || llmMaxTokens) {
                // Supprimer la configuration LLM existante si elle existe
                const llmRegex = /useLLM:[\s\S]*?(?=\n\w|$)/;
                if (yamlPart.match(llmRegex)) {
                    yamlPart = yamlPart.replace(llmRegex, '');
                }
                
                // Ajouter la nouvelle configuration LLM
                let llmConfig = 'useLLM:\n';
                if (llmUrl) llmConfig += `    url: ${llmUrl}\n`;
                if (llmModel) llmConfig += `    model: ${llmModel}\n`;
                if (llmInformations) llmConfig += `    informations: ${llmInformations}\n`;
                if (llmMaxTopElements) llmConfig += `    maxTopElements: ${llmMaxTopElements}\n`;
                if (llmMaxTokens) llmConfig += `    maxTokens: ${llmMaxTokens}\n`;
                
                yamlPart = `${llmConfig}${yamlPart}`;
            }
            
            markdown = `${parts[0]}---${yamlPart}---${parts[2]}`;
            editor.value = markdown;
            updatePreview();
            saveToServer();
            
            // Mettre à jour l'éditeur de blocs
            if (window.blockEditor) {
                window.blockEditor.parseMarkdown(editor.value);
                window.blockEditor.renderBlockPanel();
            }
            
            showNotification('Tous les paramètres YAML ont été mis à jour', 'success');
        } catch (error) {
            console.error('Erreur lors de la mise à jour des paramètres YAML:', error);
            showNotification(`Erreur: ${error.message}`, 'error');
        }
    };

    /**
     * Fonctions pour les admonitions
     */
    
    // Ajouter une admonition
    window.addAdmonition = function() {
        try {
            const type = document.getElementById('admonition-type').value;
            const content = document.getElementById('admonition-content').value.trim();
            
            if (!content) {
                showNotification('Veuillez entrer un contenu pour l\'admonition', 'warning');
                return;
            }
            
            const newAdmonition = `\n\n:::${type}\n${content}\n:::\n`;
            
            // Insérer à la position actuelle du curseur ou à la fin
            const startPos = editor.selectionStart;
            const endPos = editor.selectionEnd;
            editor.value = editor.value.substring(0, startPos) + newAdmonition + editor.value.substring(endPos);
            
            updatePreview();
            saveToServer();
            
            // Réinitialiser le formulaire
            document.getElementById('admonition-content').value = '';
            
            // Mettre à jour l'éditeur de blocs
            if (window.blockEditor) {
                window.blockEditor.parseMarkdown(editor.value);
                window.blockEditor.renderBlockPanel();
            }
            
            showNotification('Admonition ajoutée', 'success');
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'admonition:', error);
            showNotification(`Erreur: ${error.message}`, 'error');
        }
    };

    /**
     * Fonctions utilitaires
     */
    
    // Créer l'indicateur de statut
    function createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'status-indicator';
        indicator.className = 'fixed bottom-4 right-4 px-3 py-1 rounded-full text-sm font-medium hidden';
        return indicator;
    }
    
    // Mettre à jour le statut
    function updateStatus(status, message = '') {
        const indicator = document.getElementById('status-indicator');
        if (!indicator) return;
        
        indicator.classList.remove('hidden', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-blue-500');
        
        switch (status) {
            case 'saving':
                indicator.classList.add('bg-blue-500');
                indicator.textContent = 'Sauvegarde...';
                break;
            case 'saved':
                indicator.classList.add('bg-green-500');
                indicator.textContent = 'Sauvegardé';
                setTimeout(() => {
                    indicator.classList.add('hidden');
                }, 2000);
                break;
            case 'error':
                indicator.classList.add('bg-red-500');
                indicator.textContent = message || 'Erreur';
                setTimeout(() => {
                    indicator.classList.add('hidden');
                }, 5000);
                break;
            default:
                indicator.classList.add('hidden');
        }
    }
    
    // Afficher une notification
    window.showNotification = function(message, type = 'info') {
        // Créer l'élément de notification s'il n'existe pas
        let notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(notificationContainer);
        }
        
        // Créer la notification
        const notification = document.createElement('div');
        notification.className = 'px-4 py-2 rounded shadow-lg flex items-center justify-between max-w-xs';
        
        // Définir la couleur en fonction du type
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-100', 'text-green-800', 'border-l-4', 'border-green-500');
                break;
            case 'error':
                notification.classList.add('bg-red-100', 'text-red-800', 'border-l-4', 'border-red-500');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-100', 'text-yellow-800', 'border-l-4', 'border-yellow-500');
                break;
            default: // info
                notification.classList.add('bg-blue-100', 'text-blue-800', 'border-l-4', 'border-blue-500');
        }
        
        // Contenu de la notification
        notification.innerHTML = `
            <div>${message}</div>
            <button class="ml-2 text-gray-500 hover:text-gray-700" aria-label="Fermer">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Ajouter la notification au conteneur
        notificationContainer.appendChild(notification);
        
        // Ajouter l'événement de fermeture
        const closeButton = notification.querySelector('button');
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
        
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    };

    // Exposer la fonction updatePreview globalement
    window.updatePreview = updatePreview;
});
