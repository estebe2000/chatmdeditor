#!/bin/bash

# Script de lancement en production pour ChatMD Editor
# Auteur: Cline
# Date: 22/04/2025

# Définition des couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier si Python est installé
if ! command -v python &> /dev/null; then
    log_error "Python n'est pas installé. Veuillez installer Python 3.7 ou supérieur."
    exit 1
fi

# Vérifier la version de Python
PYTHON_VERSION=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
REQUIRED_VERSION="3.7"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    log_error "Python $REQUIRED_VERSION ou supérieur est requis. Version actuelle: $PYTHON_VERSION"
    exit 1
fi

# Vérifier si pip est installé
if ! command -v pip &> /dev/null; then
    log_error "pip n'est pas installé. Veuillez installer pip."
    exit 1
fi

# Vérifier si le fichier de configuration existe
if [ ! -f "config_prod.json" ]; then
    log_warn "Le fichier de configuration de production n'existe pas. Création du fichier par défaut..."
    python -c "
import json
config = {
    'max_upload_size_kb': 1024,
    'allowed_extensions': ['.md'],
    'base_template': '---\ngestionGrosMots: true\ntitresRéponses: [\"## \"]\n---\n\n# Mon Chatbot\nMessage initial du chatbot\n1. [Premier choix](Réponse 1)\n2. [Deuxième choix](Réponse 2)\n\n## Réponse 1\n- déclencheur 1\n- déclencheur 2\nContenu de la réponse 1\n1. [Option 1](Option 1)\n2. [Option 2](Option 2)\n\n## Réponse 2\n- déclencheur\nContenu de la réponse 2\n',
    'debug': False,
    'host': '0.0.0.0',
    'port': 8000,
    'workers': 4,
    'timeout': 120
}
with open('config_prod.json', 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2)
"
    if [ $? -ne 0 ]; then
        log_error "Erreur lors de la création du fichier de configuration."
        exit 1
    fi
    log_info "Fichier de configuration créé avec succès."
fi

# Charger les paramètres de configuration
HOST=$(python -c "import json; print(json.load(open('config_prod.json'))['host'])")
PORT=$(python -c "import json; print(json.load(open('config_prod.json'))['port'])")
WORKERS=$(python -c "import json; print(json.load(open('config_prod.json'))['workers'])")
TIMEOUT=$(python -c "import json; print(json.load(open('config_prod.json'))['timeout'])")

# Créer les répertoires nécessaires s'ils n'existent pas
mkdir -p static/js static/css templates models

# Installer ou mettre à jour les dépendances
log_info "Installation des dépendances..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    log_error "Erreur lors de l'installation des dépendances."
    exit 1
fi

log_info "Dépendances installées avec succès."

# Vérifier si Gunicorn est installé
if ! pip show gunicorn &> /dev/null; then
    log_warn "Gunicorn n'est pas installé. Installation..."
    pip install gunicorn
    if [ $? -ne 0 ]; then
        log_error "Erreur lors de l'installation de Gunicorn."
        exit 1
    fi
    log_info "Gunicorn installé avec succès."
fi

# Lancer l'application avec Gunicorn
log_info "Démarrage de ChatMD Editor en mode production..."
log_info "Serveur accessible à l'adresse: http://$HOST:$PORT"

# Exporter les variables d'environnement
export FLASK_APP=wsgi.py
export FLASK_ENV=production

# Lancer Gunicorn
gunicorn --bind $HOST:$PORT --workers $WORKERS --timeout $TIMEOUT wsgi:application

# Vérifier si Gunicorn s'est lancé correctement
if [ $? -ne 0 ]; then
    log_error "Erreur lors du démarrage de Gunicorn."
    exit 1
fi
