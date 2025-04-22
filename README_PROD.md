# ChatMD Editor - Launcher de Production

Ce dossier contient les fichiers nécessaires pour déployer ChatMD Editor en environnement de production.

## Fichiers Inclus

- `config_prod.json` : Configuration pour l'environnement de production
- `wsgi.py` : Point d'entrée WSGI pour les serveurs de production
- `launch_prod.sh` : Script de lancement pour Linux/macOS
- `launch_prod.bat` : Script de lancement pour Windows
- `PRODUCTION.md` : Documentation détaillée sur le déploiement en production

## Démarrage Rapide

### Sous Windows

```
launch_prod.bat
```

### Sous Linux/macOS

```bash
chmod +x launch_prod.sh
./launch_prod.sh
```

## Configuration

Vous pouvez modifier les paramètres de production dans le fichier `config_prod.json` :

- `host` : Adresse IP d'écoute (0.0.0.0 pour toutes les interfaces)
- `port` : Port d'écoute (8000 par défaut)
- `workers` : Nombre de workers Gunicorn (4 par défaut)
- `timeout` : Délai d'attente en secondes (120 par défaut)

## Documentation Complète

Pour plus d'informations sur le déploiement en production, consultez le fichier [PRODUCTION.md](PRODUCTION.md).
