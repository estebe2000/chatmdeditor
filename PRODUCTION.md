# Guide de Déploiement en Production pour ChatMD Editor

Ce document explique comment déployer ChatMD Editor en environnement de production.

## Prérequis

- Python 3.7 ou supérieur
- pip (gestionnaire de paquets Python)
- Accès à un serveur (VPS, serveur dédié, etc.) ou machine locale pour le déploiement

## Fichiers de Production

Le projet inclut les fichiers suivants pour le déploiement en production :

- `config_prod.json` : Configuration pour l'environnement de production
- `wsgi.py` : Point d'entrée WSGI pour les serveurs de production
- `launch_prod.sh` : Script de lancement pour Linux/macOS
- `launch_prod.bat` : Script de lancement pour Windows
- `requirements.txt` : Liste des dépendances incluant Gunicorn

## Configuration

Le fichier `config_prod.json` contient les paramètres de configuration pour l'environnement de production :

```json
{
  "max_upload_size_kb": 1024,
  "allowed_extensions": [".md"],
  "base_template": "...",
  "debug": false,
  "host": "0.0.0.0",
  "port": 8000,
  "workers": 4,
  "timeout": 120
}
```

### Paramètres de Configuration

- `max_upload_size_kb` : Taille maximale des fichiers uploadés en KB
- `allowed_extensions` : Extensions de fichiers autorisées
- `base_template` : Modèle de base pour les nouveaux chatbots
- `debug` : Mode debug (toujours `false` en production)
- `host` : Adresse IP d'écoute (0.0.0.0 pour toutes les interfaces)
- `port` : Port d'écoute
- `workers` : Nombre de workers Gunicorn (recommandé : 2-4 × nombre de cœurs CPU)
- `timeout` : Délai d'attente en secondes avant timeout

## Lancement en Production

### Sous Windows

1. Ouvrez une invite de commande (cmd) ou PowerShell
2. Naviguez vers le répertoire du projet
3. Exécutez le script de lancement :

```
launch_prod.bat
```

### Sous Linux/macOS

1. Ouvrez un terminal
2. Naviguez vers le répertoire du projet
3. Rendez le script exécutable :

```bash
chmod +x launch_prod.sh
```

4. Exécutez le script de lancement :

```bash
./launch_prod.sh
```

## Déploiement avec un Serveur Web

Pour un déploiement plus robuste, il est recommandé d'utiliser un serveur web comme Nginx ou Apache comme proxy inverse devant Gunicorn.

### Exemple de Configuration Nginx

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Déploiement comme Service Système

### Sous Linux (systemd)

Créez un fichier de service systemd :

```bash
sudo nano /etc/systemd/system/chatmd-editor.service
```

Contenu du fichier :

```ini
[Unit]
Description=ChatMD Editor
After=network.target

[Service]
User=votre-utilisateur
WorkingDirectory=/chemin/vers/chatmd-editor
ExecStart=/usr/local/bin/gunicorn --bind 0.0.0.0:8000 --workers 4 --timeout 120 wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

Activez et démarrez le service :

```bash
sudo systemctl enable chatmd-editor
sudo systemctl start chatmd-editor
```

## Sécurité

Pour un déploiement en production, considérez les mesures de sécurité suivantes :

1. Utilisez HTTPS avec un certificat SSL/TLS (Let's Encrypt est gratuit)
2. Configurez un pare-feu pour limiter l'accès aux ports nécessaires
3. Utilisez un utilisateur dédié avec des privilèges limités pour exécuter l'application
4. Mettez régulièrement à jour les dépendances pour corriger les vulnérabilités

## Surveillance et Maintenance

- Configurez la rotation des logs pour éviter de remplir l'espace disque
- Mettez en place une surveillance des performances et de la disponibilité
- Créez des sauvegardes régulières des données importantes

## Dépannage

### Problèmes Courants

1. **Erreur "Address already in use"** : Un autre processus utilise déjà le port configuré. Changez le port dans `config_prod.json` ou arrêtez le processus existant.

2. **Gunicorn ne démarre pas** : Vérifiez que toutes les dépendances sont installées et que le fichier `wsgi.py` est présent.

3. **Erreurs 500 dans l'application** : Consultez les logs dans `chatmd_editor.log` pour identifier la cause.

### Logs

Les logs de l'application sont écrits dans le fichier `chatmd_editor.log` dans le répertoire du projet. Consultez ce fichier en cas de problème.

## Support

Pour toute question ou problème concernant le déploiement en production, veuillez ouvrir une issue sur le dépôt GitHub du projet.
