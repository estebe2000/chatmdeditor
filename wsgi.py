from flask import Flask, render_template, request, jsonify, send_file, after_this_request, abort, session, redirect
import yaml
import os
import tempfile
import logging
import json
from werkzeug.utils import secure_filename
from document_processor import DocumentProcessor
from llm_service import LLMService
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("chatmd_editor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Clé secrète pour les sessions
app.secret_key = os.urandom(24)

# Initialisation des services
document_processor = DocumentProcessor()
llm_service = LLMService(use_online=False)  # Par défaut, utiliser le LLM local

# Configuration
CONFIG_FILE = 'config_prod.json'  # Utiliser la configuration de production

# Valeurs par défaut
DEFAULT_CONFIG = {
    "max_upload_size_kb": 1024,  # 1MB
    "allowed_extensions": [".md"],
    "base_template": """---
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
Contenu de la réponse 2
""",
    "debug": False,
    "host": "0.0.0.0",
    "port": 8000,
    "workers": 4,
    "timeout": 120
}

# Charger la configuration
def load_config():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # Créer le fichier de configuration s'il n'existe pas
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_CONFIG, f, indent=2)
            logger.info(f"Fichier de configuration créé: {CONFIG_FILE}")
            return DEFAULT_CONFIG
    except Exception as e:
        logger.error(f"Erreur lors du chargement de la configuration: {e}")
        return DEFAULT_CONFIG

# Charger la configuration
config = load_config()

@app.route('/')
def index():
    return render_template('index.html', markdown=config.get('base_template', DEFAULT_CONFIG['base_template']))

@app.route('/models/<path:filename>')
def serve_model(filename):
    try:
        return send_file(os.path.join('models', filename))
    except Exception as e:
        logger.error(f"Erreur lors du chargement du modèle {filename}: {e}")
        abort(404)

@app.route('/update', methods=['POST'])
def update():
    markdown = request.form.get('markdown', '')
    if not markdown:
        logger.warning("Tentative de mise à jour avec un markdown vide")
        return jsonify({'error': 'Le contenu markdown est vide'}), 400
    
    try:
        # Valider le YAML
        if '---' in markdown:
            parts = markdown.split('---')
            if len(parts) >= 3:
                yaml_part = parts[1]
                try:
                    yaml.safe_load(yaml_part)
                except yaml.YAMLError as e:
                    logger.warning(f"Erreur de validation YAML: {e}")
                    return jsonify({'error': f'Erreur de syntaxe YAML: {str(e)}'}), 400
        
        # Convertir le Markdown en HTML (sera fait côté client avec Showdown.js)
        return jsonify({
            'markdown': markdown,
            'html': '<div>Prévisualisation sera générée côté client</div>',
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du markdown: {e}")
        return jsonify({'error': f'Erreur lors de la mise à jour: {str(e)}'}), 500

@app.route('/download', methods=['POST'])
def download():
    markdown = request.form.get('markdown', '')
    if not markdown:
        logger.warning("Tentative de téléchargement avec un markdown vide")
        return jsonify({'error': 'Le contenu markdown est vide'}), 400
    
    try:
        # Créer un fichier temporaire
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.md')
        temp_filename = temp_file.name
        
        with open(temp_filename, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        @after_this_request
        def remove_file(response):
            try:
                os.unlink(temp_filename)
                logger.debug(f"Fichier temporaire supprimé: {temp_filename}")
            except Exception as e:
                logger.error(f"Erreur lors de la suppression du fichier temporaire: {e}")
            return response
        
        return send_file(temp_filename, as_attachment=True, download_name='chatbot.md')
    except Exception as e:
        logger.error(f"Erreur lors du téléchargement du fichier: {e}")
        return jsonify({'error': f'Erreur lors du téléchargement: {str(e)}'}), 500

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        logger.warning("Tentative d'upload sans fichier")
        return jsonify({'error': 'Aucun fichier'}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Tentative d'upload avec un nom de fichier vide")
        return jsonify({'error': 'Aucun fichier sélectionné'}), 400
    
    # Vérifier l'extension du fichier
    filename = secure_filename(file.filename)
    file_ext = os.path.splitext(filename)[1].lower()
    
    if file_ext not in config.get('allowed_extensions', DEFAULT_CONFIG['allowed_extensions']):
        logger.warning(f"Tentative d'upload avec une extension non autorisée: {file_ext}")
        return jsonify({'error': 'Format de fichier non autorisé'}), 400
    
    # Vérifier la taille du fichier
    max_size = config.get('max_upload_size_kb', DEFAULT_CONFIG['max_upload_size_kb']) * 1024  # Convertir en octets
    if file.content_length and file.content_length > max_size:
        logger.warning(f"Fichier trop volumineux: {file.content_length} octets (max: {max_size})")
        return jsonify({'error': f'Fichier trop volumineux (max: {max_size // 1024} KB)'}), 400
    
    try:
        # Lire et valider le contenu
        content = file.read()
        
        # Vérifier si le contenu est du texte valide
        try:
            markdown = content.decode('utf-8')
        except UnicodeDecodeError:
            logger.warning("Le fichier n'est pas un fichier texte valide")
            return jsonify({'error': 'Le fichier n\'est pas un fichier texte valide'}), 400
        
        # Vérifier si le contenu contient du markdown valide (vérification basique)
        if '---' in markdown:
            parts = markdown.split('---')
            if len(parts) >= 3:
                yaml_part = parts[1]
                try:
                    yaml.safe_load(yaml_part)
                except yaml.YAMLError as e:
                    logger.warning(f"Erreur de validation YAML dans le fichier uploadé: {e}")
                    return jsonify({'error': f'Erreur de syntaxe YAML dans le fichier: {str(e)}'}), 400
        
        return jsonify({'markdown': markdown, 'status': 'success'})
    except Exception as e:
        logger.error(f"Erreur lors de l'upload du fichier: {e}")
        return jsonify({'error': f'Erreur lors de l\'upload: {str(e)}'}), 500

@app.route('/config', methods=['GET', 'POST'])
def manage_config():
    global config
    
    if request.method == 'GET':
        return jsonify(config)
    
    elif request.method == 'POST':
        try:
            new_config = request.json
            if not new_config:
                return jsonify({'error': 'Configuration invalide'}), 400
            
            # Valider la configuration
            if 'max_upload_size_kb' in new_config and not isinstance(new_config['max_upload_size_kb'], int):
                return jsonify({'error': 'max_upload_size_kb doit être un entier'}), 400
            
            if 'allowed_extensions' in new_config and not isinstance(new_config['allowed_extensions'], list):
                return jsonify({'error': 'allowed_extensions doit être une liste'}), 400
            
            # Mettre à jour la configuration
            config.update(new_config)
            
            # Sauvegarder la configuration
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
            
            logger.info("Configuration mise à jour")
            return jsonify({'status': 'success', 'config': config})
        
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour de la configuration: {e}")
            return jsonify({'error': f'Erreur: {str(e)}'}), 500

@app.errorhandler(404)
def page_not_found(e):
    logger.warning(f"Page non trouvée: {request.path}")
    return jsonify({'error': 'Page non trouvée'}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Erreur serveur: {str(e)}")
    return jsonify({'error': 'Erreur serveur interne'}), 500

@app.route('/save-to-editor', methods=['POST'])
def save_to_editor():
    """Sauvegarde le markdown dans la session et redirige vers l'éditeur principal"""
    markdown = request.form.get('markdown', '')
    if not markdown:
        return jsonify({'error': 'Le contenu markdown est vide'}), 400
    
    try:
        # Sauvegarder le markdown dans la session
        session['markdown'] = markdown
        
        # Rediriger vers la page principale
        return jsonify({'status': 'success', 'redirect': '/'})
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde dans la session: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@app.route('/ai-generation', methods=['GET'])
def ai_generation_page():
    """Affiche la page de génération par IA"""
    return render_template('ai_generation.html')

@app.route('/api/generate-from-document', methods=['POST'])
def generate_from_document():
    """Génère un chatbot à partir d'un document uploadé"""
    if 'document' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    
    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'Aucun fichier sélectionné'}), 400
    
    # Récupération des paramètres
    params = {
        'doc_type': request.form.get('doc_type', 'custom'),
        'tone': request.form.get('tone', 'conversational'),
        'complexity': request.form.get('complexity', 'intermediate'),
        'max_depth': int(request.form.get('max_depth', 3)),
        'choices_per_level': int(request.form.get('choices_per_level', 3))
    }
    
    try:
        # Sauvegarder le fichier temporairement
        temp_dir = tempfile.mkdtemp()
        file_path = os.path.join(temp_dir, secure_filename(file.filename))
        file.save(file_path)
        
        # Traiter le document
        content = document_processor.process(file_path, params)
        if not content:
            return jsonify({'error': 'Impossible de traiter le document'}), 400
        
        # Générer le chatbot
        markdown = llm_service.generate_chatmd(content, params)
        if not markdown:
            return jsonify({'error': 'Erreur lors de la génération du chatbot'}), 500
        
        # Nettoyer
        os.remove(file_path)
        os.rmdir(temp_dir)
        
        return jsonify({'markdown': markdown, 'status': 'success'})
    except Exception as e:
        logger.error(f"Erreur lors de la génération du chatbot: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@app.route('/api/suggest-improvements', methods=['POST'])
def suggest_improvements():
    """Suggère des améliorations pour un chatbot existant"""
    data = request.json
    if not data or 'markdown' not in data:
        return jsonify({'error': 'Aucun contenu fourni'}), 400
    
    markdown = data.get('markdown')
    section = data.get('section')
    
    try:
        suggestions = llm_service.suggest_improvements(markdown, section)
        if not suggestions:
            return jsonify({'error': 'Erreur lors de la génération des suggestions'}), 500
        
        return jsonify({'suggestions': suggestions, 'status': 'success'})
    except Exception as e:
        logger.error(f"Erreur lors de la génération des suggestions: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@app.route('/api/toggle-llm-mode', methods=['POST'])
def toggle_llm_mode():
    """Change le mode LLM (local ou en ligne)"""
    global llm_service
    
    data = request.json
    if not data or 'use_online' not in data:
        return jsonify({'error': 'Paramètre use_online manquant'}), 400
    
    use_online = data.get('use_online', False)
    
    try:
        # Créer une nouvelle instance du service LLM avec le mode spécifié
        llm_service = LLMService(use_online=use_online)
        
        mode = "en ligne (Mistral API)" if use_online else "local (Jan.ai)"
        logger.info(f"Mode LLM changé: {mode}")
        
        return jsonify({
            'status': 'success',
            'mode': mode,
            'use_online': use_online
        })
    except Exception as e:
        logger.error(f"Erreur lors du changement de mode LLM: {str(e)}")
        return jsonify({'error': f'Erreur: {str(e)}'}), 500

@app.route('/api/llm-status', methods=['GET'])
def llm_status():
    """Retourne le statut du LLM"""
    return jsonify({
        'use_online': llm_service.use_online,
        'model': llm_service.model,
        'api_url': llm_service.api_url if not llm_service.use_online else llm_service.online_api_url
    })

# Créer les répertoires nécessaires
os.makedirs('static/js', exist_ok=True)
os.makedirs('static/css', exist_ok=True)
os.makedirs('templates', exist_ok=True)
os.makedirs('models', exist_ok=True)

# Point d'entrée WSGI
application = app
