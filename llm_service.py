import requests
import json
import logging
import os
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

logger = logging.getLogger(__name__)

class LLMService:
    """Service d'interaction avec le LLM"""
    
    def __init__(self, api_url=None, model=None, use_online=False):
        # Utiliser les variables d'environnement ou les valeurs par défaut
        self.api_url = api_url or os.getenv("LOCAL_API_URL", "http://localhost:1337/v1/chat/completions")
        self.model = model or os.getenv("LOCAL_MODEL", "mistral:7b")
        self.use_online = use_online
        
        # Configuration de l'API en ligne
        self.online_api_key = os.getenv("MISTRAL_API_KEY", "")
        self.online_api_url = os.getenv("MISTRAL_API_URL", "https://api.mistral.ai/v1/chat/completions")
        self.online_model = os.getenv("MISTRAL_MODEL", "codestral-latest")
    
    def _call_api(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> Optional[str]:
        """Appelle l'API LLM locale et retourne la réponse"""
        if self.use_online:
            return self._call_online_api(messages, temperature)
        
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature
            }
            
            response = requests.post(self.api_url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Erreur lors de l'appel à l'API LLM locale: {str(e)}")
            # En cas d'erreur avec l'API locale, essayer l'API en ligne comme fallback
            if not self.use_online:
                logger.info("Tentative de fallback vers l'API en ligne...")
                return self._call_online_api(messages, temperature)
            return None
    
    def _call_online_api(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> Optional[str]:
        """Appelle l'API Mistral en ligne et retourne la réponse"""
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.online_api_key}"
            }
            
            payload = {
                "model": self.online_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 2000  # Valeur par défaut raisonnable
            }
            
            response = requests.post(self.online_api_url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Erreur lors de l'appel à l'API Mistral en ligne: {str(e)}")
            return None
    
    def generate_chatmd(self, content: str, params: Dict[str, Any]) -> Optional[str]:
        """Génère un chatbot au format ChatMD à partir du contenu"""
        doc_type = params.get("doc_type", "custom")
        tone = params.get("tone", "conversational")
        complexity = params.get("complexity", "intermediate")
        max_depth = params.get("max_depth", 3)
        choices_per_level = params.get("choices_per_level", 3)
        
        # Construction du prompt pour la génération JSON
        system_prompt = self._get_json_system_prompt(doc_type, tone, complexity, max_depth, choices_per_level)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Voici le document à transformer en chatbot:\n\n{content}"}
        ]
        
        # Obtenir la réponse JSON du LLM
        json_response = self._call_api(messages, temperature=0.7)
        if not json_response:
            logger.error("Aucune réponse reçue du LLM")
            return None
        
        logger.info(f"Réponse brute du LLM: {json_response[:100]}...")
        
        # Plan B: Si le modèle ne génère pas de JSON valide, essayer avec un prompt direct pour Markdown
        try:
            # Extraire la partie JSON de la réponse (au cas où le modèle ajoute du texte avant/après)
            json_start = json_response.find('{')
            json_end = json_response.rfind('}') + 1
            
            if json_start == -1 or json_end == 0:
                logger.warning("Impossible de trouver une structure JSON valide dans la réponse, passage au plan B")
                return self._generate_chatmd_direct(content, params)
            
            json_str = json_response[json_start:json_end]
            logger.info(f"JSON extrait: {json_str[:100]}...")
            
            try:
                chatbot_data = json.loads(json_str)
                
                # Vérifier que la structure JSON est valide
                if not isinstance(chatbot_data, dict) or 'title' not in chatbot_data or 'welcome_message' not in chatbot_data:
                    logger.warning("Structure JSON invalide, passage au plan B")
                    return self._generate_chatmd_direct(content, params)
                
                # Convertir la structure JSON en format ChatMD
                return self._json_to_chatmd(chatbot_data)
            except json.JSONDecodeError as e:
                logger.warning(f"Erreur de décodage JSON: {str(e)}, passage au plan B")
                return self._generate_chatmd_direct(content, params)
        except Exception as e:
            logger.error(f"Erreur lors de la conversion JSON vers ChatMD: {str(e)}")
            # En cas d'erreur, essayer la méthode directe
            return self._generate_chatmd_direct(content, params)
    
    def _generate_chatmd_direct(self, content: str, params: Dict[str, Any]) -> Optional[str]:
        """Méthode de secours: génère directement un chatbot au format ChatMD en extrayant des informations du document"""
        doc_type = params.get("doc_type", "custom")
        tone = params.get("tone", "conversational")
        complexity = params.get("complexity", "intermediate")
        max_depth = params.get("max_depth", 3)
        choices_per_level = params.get("choices_per_level", 3)
        
        logger.info("Extraction d'informations pertinentes du document")
        
        # En-tête YAML
        yaml_header = "---\ngestionGrosMots: true\ntitresRéponses: [\"## \"]\n---\n\n"
        
        # Analyser le contenu pour extraire des informations
        lines = content.split('\n')
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        # Nettoyer le contenu
        clean_content = content.replace('\r', ' ').replace('\t', ' ')
        while '  ' in clean_content:  # Supprimer les espaces multiples
            clean_content = clean_content.replace('  ', ' ')
        
        # Extraire et nettoyer le titre (première ligne non vide)
        title = "Chatbot"
        for line in lines:
            if line.strip():
                # Nettoyer le titre en supprimant les espaces supplémentaires
                title = ' '.join(line.strip().split())
                break
        
        # Identifier les sections potentielles
        potential_sections = []
        
        # 1. Chercher les lignes qui se terminent par ":" et qui sont courtes (probablement des titres de section)
        for line in lines:
            line = line.strip()
            if line.endswith(':') and len(line) < 50:
                section_name = line.rstrip(':').strip()
                # Nettoyer le nom de la section
                section_name = ' '.join(section_name.split())
                if section_name and len(section_name.split()) <= 5:  # Limiter à 5 mots maximum
                    potential_sections.append(section_name)
        
        # 2. Chercher les lignes en majuscules (souvent des titres de section)
        for line in lines:
            line = line.strip()
            if line.isupper() and len(line) < 50:
                section_name = line.strip()
                # Nettoyer le nom de la section
                section_name = ' '.join(section_name.split())
                if section_name and len(section_name.split()) <= 5:  # Limiter à 5 mots maximum
                    potential_sections.append(section_name)
        
        # 3. Chercher les lignes qui commencent par des mots-clés typiques de sections
        section_keywords = ["produits", "services", "histoire", "à propos", "contact", "équipe", 
                           "mission", "valeurs", "tarifs", "prix", "promotions", "offres"]
        for line in lines:
            line = line.strip()
            if any(line.lower().startswith(keyword) for keyword in section_keywords):
                section_name = line.strip()
                # Nettoyer le nom de la section
                section_name = ' '.join(section_name.split())
                if section_name and len(section_name.split()) <= 5:  # Limiter à 5 mots maximum
                    potential_sections.append(section_name)
        
        # Filtrer les sections pour éviter les doublons et les sections trop longues
        filtered_sections = []
        for section in potential_sections:
            # Vérifier si la section est déjà dans la liste (ignorer la casse)
            if not any(section.lower() == s.lower() for s in filtered_sections):
                # Vérifier si la section n'est pas trop longue
                if len(section) <= 30:
                    filtered_sections.append(section)
        
        # Si pas assez de sections trouvées, créer des sections par défaut selon le type de document
        if len(filtered_sections) < 3:
            if doc_type == "company":
                default_sections = ["Produits et Services", "Notre Histoire", "Contactez-nous"]
            elif doc_type == "biography":
                default_sections = ["Jeunesse et Formation", "Carrière et Réalisations", "Vie Personnelle"]
            elif doc_type == "course":
                default_sections = ["Introduction", "Contenu du Cours", "Exercices Pratiques"]
            elif doc_type == "product":
                default_sections = ["Caractéristiques", "Utilisation", "Prix et Disponibilité"]
            else:
                default_sections = ["À propos", "Informations", "Contact"]
            
            # Ajouter les sections par défaut qui ne sont pas déjà présentes
            for section in default_sections:
                if not any(section.lower() == s.lower() for s in filtered_sections):
                    filtered_sections.append(section)
        
        # Limiter à 3 sections principales
        sections = filtered_sections[:3]
        
        # Extraire des paragraphes pertinents pour chaque section
        section_content = {}
        remaining_paragraphs = paragraphs.copy()
        
        # Essayer de trouver du contenu pertinent pour chaque section
        for section in sections:
            section_content[section] = []
            keywords = [word.lower() for word in section.split() if len(word) > 3]  # Ignorer les mots courts
            
            # Chercher des paragraphes contenant des mots-clés de la section
            for paragraph in remaining_paragraphs[:]:
                if any(keyword in paragraph.lower() for keyword in keywords):
                    # Nettoyer le paragraphe
                    clean_paragraph = ' '.join(paragraph.split())
                    section_content[section].append(clean_paragraph)
                    remaining_paragraphs.remove(paragraph)
                    if len(section_content[section]) >= 1:  # Limiter à 1 paragraphe par section
                        break
        
        # Distribuer les paragraphes restants si certaines sections sont vides
        for section in sections:
            if not section_content[section] and remaining_paragraphs:
                # Nettoyer le paragraphe
                clean_paragraph = ' '.join(remaining_paragraphs[0].split())
                section_content[section].append(clean_paragraph)
                remaining_paragraphs.pop(0)
        
        # Créer des sous-sections pertinentes pour chaque section principale
        subsections = {}
        
        # Fonction pour extraire des sous-sections potentielles du contenu
        def extract_subsections(content_text, section_name):
            subsection_candidates = []
            
            # Chercher des phrases qui pourraient être des sous-sections
            sentences = content_text.split('.')
            for sentence in sentences:
                sentence = sentence.strip()
                if len(sentence) > 10 and len(sentence) < 40 and sentence[0].isupper():
                    # Vérifier si la phrase contient des mots-clés de la section
                    section_keywords = [word.lower() for word in section_name.split() if len(word) > 3]
                    if any(keyword in sentence.lower() for keyword in section_keywords):
                        subsection_candidates.append(sentence)
            
            return subsection_candidates
        
        # Pour chaque section, créer des sous-sections basées sur le contenu ou par défaut
        for section in sections:
            # Essayer d'extraire des sous-sections du contenu
            content_text = " ".join(section_content[section])
            extracted_subsections = extract_subsections(content_text, section)
            
            # Si des sous-sections ont été trouvées, les utiliser
            if len(extracted_subsections) >= 3:
                subsections[section] = extracted_subsections[:3]
            else:
                # Sinon, utiliser des sous-sections par défaut selon le type de document et la section
                if doc_type == "company":
                    if "produit" in section.lower() or "service" in section.lower():
                        subsections[section] = ["Nos produits phares", "Services spéciaux", "Garanties et SAV"]
                    elif "histoire" in section.lower() or "propos" in section.lower():
                        subsections[section] = ["Notre fondation", "Évolution de l'entreprise", "Valeurs et mission"]
                    elif "contact" in section.lower() or "trouver" in section.lower():
                        subsections[section] = ["Coordonnées", "Horaires d'ouverture", "Service client"]
                    else:
                        subsections[section] = ["Informations principales", "Détails supplémentaires", "Foire aux questions"]
                else:
                    # Sous-sections génériques mais plus concises
                    subsections[section] = ["Informations principales", "Détails supplémentaires", "Foire aux questions"]
        
        # Créer le message d'accueil
        if doc_type == "company":
            welcome_message = f"Bienvenue chez {title}! Découvrez notre entreprise, nos produits et services."
        elif doc_type == "biography":
            welcome_message = f"Découvrez la vie et l'œuvre de {title}."
        elif doc_type == "course":
            welcome_message = f"Bienvenue dans ce cours sur {title}. Vous allez découvrir de nouveaux concepts et développer vos compétences."
        elif doc_type == "product":
            welcome_message = f"Découvrez {title} et ses caractéristiques exceptionnelles."
        else:
            welcome_message = f"Bienvenue dans ce chatbot interactif sur {title}."
        
        # Extraire un paragraphe d'introduction si disponible
        if paragraphs:
            # Chercher un paragraphe court qui pourrait servir d'introduction
            for paragraph in paragraphs:
                if 50 < len(paragraph) < 300:  # Paragraphe de taille raisonnable
                    # Nettoyer le paragraphe
                    welcome_message = ' '.join(paragraph.split())
                    break
        
        # Construire le chatbot
        chatmd = f"{yaml_header}# {title}\n{welcome_message}\n\n"
        
        # Ajouter les choix principaux
        for i, section in enumerate(sections, 1):
            chatmd += f"{i}. [{section}]({section})\n"
        chatmd += "\n"
        
        # Ajouter les sections principales
        for section in sections:
            chatmd += f"## {section}\n"
            
            # Ajouter des déclencheurs pertinents (limités à 3 maximum)
            keywords = [word.lower() for word in section.split() if len(word) > 3][:3]  # Prendre les 3 premiers mots significatifs
            for keyword in keywords:
                chatmd += f"- {keyword}\n"
            
            # Ajouter le contenu de la section
            if section_content[section]:
                chatmd += section_content[section][0] + "\n\n"
            else:
                chatmd += f"Informations sur {section}.\n\n"
            
            # Ajouter les sous-sections comme choix
            for i, subsection in enumerate(subsections[section], 1):
                chatmd += f"{i}. [{subsection}]({subsection})\n"
            chatmd += "\n"
        
        # Ajouter les sous-sections
        for section in sections:
            for subsection in subsections[section]:
                chatmd += f"## {subsection}\n"
                
                # Ajouter des déclencheurs (limités à 2)
                keywords = [word.lower() for word in subsection.split() if len(word) > 3][:2]  # Prendre les 2 premiers mots significatifs
                for keyword in keywords:
                    chatmd += f"- {keyword}\n"
                
                # Chercher du contenu pertinent pour cette sous-section
                subsection_content = "Informations détaillées sur ce sujet."
                for paragraph in paragraphs:
                    if any(keyword in paragraph.lower() for keyword in keywords):
                        # Nettoyer et limiter la longueur du paragraphe
                        clean_paragraph = ' '.join(paragraph.split())
                        if len(clean_paragraph) > 300:
                            clean_paragraph = clean_paragraph[:300] + "..."
                        subsection_content = clean_paragraph
                        break
                
                chatmd += subsection_content + "\n\n"
                
                # Ajouter un choix pour revenir à la section parente
                chatmd += f"1. [Retour à {section}]({section})\n\n"
        
        # Ajouter une section de retour à l'accueil
        chatmd += "## Retour à l'accueil\n"
        chatmd += "- retour\n"
        chatmd += "- accueil\n"
        chatmd += "Retour à la page d'accueil.\n\n"
        
        # Ajouter les choix principaux
        for i, section in enumerate(sections, 1):
            chatmd += f"{i}. [{section}]({section})\n"
        chatmd += "\n"
        
        return chatmd
    
    def suggest_improvements(self, current_markdown: str, section: str = None) -> Optional[str]:
        """Suggère des améliorations pour le markdown actuel"""
        system_prompt = """Tu es un assistant spécialisé dans la création de chatbots au format ChatMD.
        Analyse le contenu fourni et suggère des améliorations pour le rendre plus engageant,
        informatif et interactif. Concentre-toi sur la structure, les choix proposés,
        les déclencheurs et la qualité du contenu."""
        
        user_prompt = f"Voici le contenu actuel du chatbot:\n\n{current_markdown}"
        if section:
            user_prompt += f"\n\nJe souhaite améliorer spécifiquement la section: {section}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        return self._call_api(messages, temperature=0.8)
    
    def _json_to_chatmd(self, chatbot_data: Dict[str, Any]) -> str:
        """Convertit une structure JSON en format ChatMD"""
        # Construire l'en-tête YAML
        yaml_header = "---\ngestionGrosMots: true\ntitresRéponses: [\"## \"]\n---\n\n"
        
        # Construire le bloc d'accueil
        welcome_block = f"# {chatbot_data.get('title', 'Chatbot')}\n{chatbot_data.get('welcome_message', '')}\n"
        
        # Ajouter les choix du bloc d'accueil
        welcome_choices = chatbot_data.get('welcome_choices', [])
        for i, choice in enumerate(welcome_choices, 1):
            welcome_block += f"{i}. [{choice['text']}]({choice['target']})\n"
        
        welcome_block += "\n"
        
        # Construire les blocs de réponse
        response_blocks = ""
        responses = chatbot_data.get('responses', {})
        
        for response_id, response_data in responses.items():
            response_blocks += f"## {response_id}\n"
            
            # Ajouter les déclencheurs
            triggers = response_data.get('triggers', [])
            for trigger in triggers:
                response_blocks += f"- {trigger}\n"
            
            # Ajouter le contenu
            response_blocks += f"{response_data.get('content', '')}\n"
            
            # Ajouter les choix
            choices = response_data.get('choices', [])
            for i, choice in enumerate(choices, 1):
                response_blocks += f"{i}. [{choice['text']}]({choice['target']})\n"
            
            response_blocks += "\n"
        
        # Assembler le document ChatMD complet
        return yaml_header + welcome_block + response_blocks
    
    def _get_json_system_prompt(self, doc_type: str, tone: str, complexity: str, max_depth: int, choices_per_level: int) -> str:
        """Retourne le prompt système pour la génération JSON selon les paramètres"""
        base_prompt = f"""Tu es un expert en création de chatbots interactifs. Ta tâche est de transformer le document fourni en une structure JSON qui sera ensuite convertie en chatbot interactif.

IMPORTANT: Tu dois ABSOLUMENT générer une structure JSON valide et bien formée selon le schéma ci-dessous. Ne fais PAS une simple analyse de texte.

Schéma JSON requis:
```json
{{
  "title": "Titre du chatbot basé sur le document",
  "welcome_message": "Message d'accueil qui présente le sujet principal du document",
  "welcome_choices": [
    {{
      "text": "Premier choix",
      "target": "Réponse 1"
    }},
    {{
      "text": "Deuxième choix",
      "target": "Réponse 2"
    }},
    {{
      "text": "Troisième choix",
      "target": "Réponse 3"
    }}
  ],
  "responses": {{
    "Réponse 1": {{
      "triggers": ["déclencheur 1", "déclencheur 2"],
      "content": "Contenu détaillé sur le premier aspect du document",
      "choices": [
        {{
          "text": "Sous-option 1.1",
          "target": "Sous-réponse 1.1"
        }},
        {{
          "text": "Sous-option 1.2",
          "target": "Sous-réponse 1.2"
        }}
      ]
    }},
    "Réponse 2": {{
      "triggers": ["déclencheur 1", "déclencheur 2"],
      "content": "Contenu détaillé sur le deuxième aspect du document",
      "choices": [
        {{
          "text": "Sous-option 2.1",
          "target": "Sous-réponse 2.1"
        }},
        {{
          "text": "Sous-option 2.2",
          "target": "Sous-réponse 2.2"
        }}
      ]
    }},
    "Réponse 3": {{
      "triggers": ["déclencheur 1", "déclencheur 2"],
      "content": "Contenu détaillé sur le troisième aspect du document",
      "choices": [
        {{
          "text": "Sous-option 3.1",
          "target": "Sous-réponse 3.1"
        }},
        {{
          "text": "Sous-option 3.2",
          "target": "Sous-réponse 3.2"
        }}
      ]
    }},
    "Sous-réponse 1.1": {{
      "triggers": ["déclencheur spécifique"],
      "content": "Contenu détaillé sur cet aspect spécifique",
      "choices": [
        {{
          "text": "Option pour continuer",
          "target": "Autre réponse"
        }},
        {{
          "text": "Revenir en arrière",
          "target": "Réponse 1"
        }}
      ]
    }},
    "Sous-réponse 1.2": {{
      "triggers": ["déclencheur spécifique"],
      "content": "Contenu détaillé sur cet aspect spécifique",
      "choices": [
        {{
          "text": "Option pour continuer",
          "target": "Autre réponse"
        }},
        {{
          "text": "Revenir en arrière",
          "target": "Réponse 1"
        }}
      ]
    }}
    // Et ainsi de suite pour toutes les sous-réponses...
  }}
}}
```

Directives OBLIGATOIRES:
- Ton: {tone}
- Niveau de complexité: {complexity}
- Profondeur maximale: {max_depth} niveaux (pas plus!)
- Nombre de choix par niveau: exactement {choices_per_level} options
- Inclure 2-3 déclencheurs pertinents pour chaque bloc de réponse
- Créer une structure cohérente et logique basée sur le contenu du document
- Assurer que TOUS les liens entre les blocs fonctionnent correctement (chaque "target" doit correspondre à une clé existante dans "responses")
- Générer un JSON valide et bien formé, sans erreurs de syntaxe
        """
        
        # Ajout de directives spécifiques selon le type de document
        if doc_type == "company":
            base_prompt += """
STRUCTURE SPÉCIFIQUE POUR UNE DESCRIPTION D'ENTREPRISE:

# [Nom de l'entreprise]
Bienvenue dans le chatbot de [Nom de l'entreprise]! Découvrez notre entreprise, nos produits et services, et comment nous pouvons répondre à vos besoins.

1. [Produits et Services](Produits et Services)
2. [Notre Histoire](Notre Histoire)
3. [Contactez-nous](Contactez-nous)

## Produits et Services
- produits
- services
- offres
Découvrez notre gamme complète de produits et services:

1. [Produit/Service Phare](Produit/Service Phare)
2. [Autres Offres](Autres Offres)
3. [Tarifs et Disponibilité](Tarifs et Disponibilité)

## Notre Histoire
- histoire
- fondation
- évolution
[Nom de l'entreprise] a été fondée en [année] par [fondateur]. Voici notre parcours:

1. [Débuts et Vision](Débuts et Vision)
2. [Croissance et Développement](Croissance et Développement)
3. [Notre Mission et Nos Valeurs](Notre Mission et Nos Valeurs)

## Contactez-nous
- contact
- adresse
- téléphone
Vous souhaitez nous contacter? Voici toutes les informations nécessaires:

1. [Nos Bureaux et Points de Vente](Nos Bureaux et Points de Vente)
2. [Service Client](Service Client)
3. [Opportunités de Carrière](Opportunités de Carrière)

[Et continuer avec toutes les sous-sections...]
"""
        elif doc_type == "biography":
            base_prompt += """
STRUCTURE SPÉCIFIQUE POUR UNE BIOGRAPHIE:

# [Nom de la Personne]
Découvrez la vie et l'œuvre de [Nom de la Personne], [brève description de sa notoriété ou de son domaine].

1. [Jeunesse et Formation](Jeunesse et Formation)
2. [Carrière et Réalisations](Carrière et Réalisations)
3. [Vie Personnelle](Vie Personnelle)

## Jeunesse et Formation
- enfance
- éducation
- formation
[Nom] est né(e) le [date] à [lieu]. Voici les moments clés de sa jeunesse:

1. [Origines Familiales](Origines Familiales)
2. [Éducation et Influences](Éducation et Influences)
3. [Premiers Pas](Premiers Pas)

## Carrière et Réalisations
- carrière
- travail
- accomplissements
Découvrez le parcours professionnel remarquable de [Nom]:

1. [Débuts Professionnels](Débuts Professionnels)
2. [Principales Œuvres/Réalisations](Principales Œuvres/Réalisations)
3. [Reconnaissance et Prix](Reconnaissance et Prix)

## Vie Personnelle
- famille
- loisirs
- vie privée
En dehors de sa carrière, [Nom] a mené une vie personnelle riche:

1. [Famille et Relations](Famille et Relations)
2. [Passions et Intérêts](Passions et Intérêts)
3. [Philosophie et Valeurs](Philosophie et Valeurs)

[Et continuer avec toutes les sous-sections...]
"""
        elif doc_type == "course":
            base_prompt += """
STRUCTURE SPÉCIFIQUE POUR UN COURS:

# [Titre du Cours]
Bienvenue dans ce cours sur [Sujet]. Vous allez découvrir les concepts fondamentaux et développer vos compétences dans ce domaine.

1. [Introduction et Concepts de Base](Introduction et Concepts de Base)
2. [Modules Principaux](Modules Principaux)
3. [Exercices Pratiques](Exercices Pratiques)

## Introduction et Concepts de Base
- introduction
- concepts
- fondamentaux
Commençons par comprendre les bases essentielles de [Sujet]:

1. [Définitions Clés](Définitions Clés)
2. [Contexte Historique](Contexte Historique)
3. [Pourquoi Étudier Ce Sujet](Pourquoi Étudier Ce Sujet)

## Modules Principaux
- modules
- chapitres
- leçons
Le cours est divisé en plusieurs modules thématiques:

1. [Module 1: Titre](Module 1)
2. [Module 2: Titre](Module 2)
3. [Module 3: Titre](Module 3)

## Exercices Pratiques
- exercices
- pratique
- applications
Mettez en pratique vos connaissances avec ces exercices:

1. [Exercices de Niveau Débutant](Exercices Débutant)
2. [Exercices de Niveau Intermédiaire](Exercices Intermédiaire)
3. [Projets Pratiques](Projets Pratiques)

[Et continuer avec toutes les sous-sections, incluant des quiz à la fin de chaque module...]
"""
        elif doc_type == "product":
            base_prompt += """
STRUCTURE SPÉCIFIQUE POUR UNE DESCRIPTION DE PRODUIT:

# [Nom du Produit]
Découvrez [Nom du Produit], [brève description du produit et de sa valeur principale].

1. [Caractéristiques et Avantages](Caractéristiques et Avantages)
2. [Utilisation et Applications](Utilisation et Applications)
3. [Prix et Disponibilité](Prix et Disponibilité)

## Caractéristiques et Avantages
- caractéristiques
- spécifications
- avantages
Voici ce qui rend [Nom du Produit] unique:

1. [Caractéristiques Techniques](Caractéristiques Techniques)
2. [Avantages Principaux](Avantages Principaux)
3. [Comparaison avec d'Autres Produits](Comparaison)

## Utilisation et Applications
- utilisation
- mode d'emploi
- applications
Comment tirer le meilleur parti de [Nom du Produit]:

1. [Guide de Démarrage Rapide](Guide de Démarrage)
2. [Cas d'Utilisation Courants](Cas d'Utilisation)
3. [Conseils et Astuces](Conseils et Astuces)

## Prix et Disponibilité
- prix
- achat
- disponibilité
Informations sur l'achat de [Nom du Produit]:

1. [Options d'Achat](Options d'Achat)
2. [Garantie et Support](Garantie et Support)
3. [Produits Complémentaires](Produits Complémentaires)

[Et continuer avec toutes les sous-sections...]
"""
        
        return base_prompt
