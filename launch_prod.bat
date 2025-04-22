@echo off
:: Script de lancement en production pour ChatMD Editor (Windows)
:: Auteur: Cline
:: Date: 22/04/2025

echo [INFO] Vérification de l'environnement...

:: Vérifier si Python est installé
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python n'est pas installé. Veuillez installer Python 3.7 ou supérieur.
    exit /b 1
)

:: Vérifier la version de Python
for /f "tokens=2" %%I in ('python --version 2^>^&1') do set PYTHON_VERSION=%%I
echo [INFO] Version de Python détectée: %PYTHON_VERSION%

:: Vérifier si le fichier de configuration existe
if not exist config_prod.json (
    echo [WARN] Le fichier de configuration de production n'existe pas. Création du fichier par défaut...
    python -c "import json; config = {'max_upload_size_kb': 1024, 'allowed_extensions': ['.md'], 'base_template': '---\ngestionGrosMots: true\ntitresRéponses: [\"## \"]\n---\n\n# Mon Chatbot\nMessage initial du chatbot\n1. [Premier choix](Réponse 1)\n2. [Deuxième choix](Réponse 2)\n\n## Réponse 1\n- déclencheur 1\n- déclencheur 2\nContenu de la réponse 1\n1. [Option 1](Option 1)\n2. [Option 2](Option 2)\n\n## Réponse 2\n- déclencheur\nContenu de la réponse 2\n', 'debug': False, 'host': '0.0.0.0', 'port': 8000, 'workers': 4, 'timeout': 120}; f=open('config_prod.json', 'w', encoding='utf-8'); json.dump(config, f, indent=2); f.close()"
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Erreur lors de la création du fichier de configuration.
        exit /b 1
    )
    echo [INFO] Fichier de configuration créé avec succès.
)

:: Charger les paramètres de configuration
for /f "tokens=*" %%a in ('python -c "import json; print(json.load(open('config_prod.json'))['host'])"') do set HOST=%%a
for /f "tokens=*" %%a in ('python -c "import json; print(json.load(open('config_prod.json'))['port'])"') do set PORT=%%a
for /f "tokens=*" %%a in ('python -c "import json; print(json.load(open('config_prod.json'))['workers'])"') do set WORKERS=%%a
for /f "tokens=*" %%a in ('python -c "import json; print(json.load(open('config_prod.json'))['timeout'])"') do set TIMEOUT=%%a

:: Créer les répertoires nécessaires s'ils n'existent pas
if not exist static\js mkdir static\js
if not exist static\css mkdir static\css
if not exist templates mkdir templates
if not exist models mkdir models

:: Installer ou mettre à jour les dépendances
echo [INFO] Installation des dépendances...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Erreur lors de l'installation des dépendances.
    exit /b 1
)
echo [INFO] Dépendances installées avec succès.

:: Vérifier si Gunicorn est installé
pip show gunicorn >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARN] Gunicorn n'est pas installé. Installation...
    pip install gunicorn
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Erreur lors de l'installation de Gunicorn.
        exit /b 1
    )
    echo [INFO] Gunicorn installé avec succès.
)

:: Lancer l'application avec Gunicorn
echo [INFO] Démarrage de ChatMD Editor en mode production...
echo [INFO] Serveur accessible à l'adresse: http://%HOST%:%PORT%

:: Exporter les variables d'environnement
set FLASK_APP=wsgi.py
set FLASK_ENV=production

:: Lancer Gunicorn
echo [INFO] Lancement de Gunicorn...
gunicorn --bind %HOST%:%PORT% --workers %WORKERS% --timeout %TIMEOUT% wsgi:application

:: Vérifier si Gunicorn s'est lancé correctement
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Erreur lors du démarrage de Gunicorn.
    exit /b 1
)
