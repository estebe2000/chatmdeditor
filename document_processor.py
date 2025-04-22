import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Classe pour traiter différents formats de documents"""
    
    def __init__(self):
        self.supported_formats = {
            '.txt': self._process_txt,
            '.md': self._process_md,
            '.pdf': self._process_pdf,
            '.docx': self._process_docx
        }
    
    def process(self, file_path: str, params: Dict[str, Any] = None) -> Optional[str]:
        """Traite un document et retourne son contenu textuel"""
        if params is None:
            params = {}
            
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.supported_formats:
            logger.error(f"Format non supporté: {ext}")
            return None
        
        try:
            return self.supported_formats[ext](file_path, params)
        except Exception as e:
            logger.error(f"Erreur lors du traitement du document {file_path}: {str(e)}")
            return None
    
    def _process_txt(self, file_path: str, params: Dict[str, Any] = None) -> str:
        """Traite un fichier texte"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _process_md(self, file_path: str, params: Dict[str, Any] = None) -> str:
        """Traite un fichier Markdown"""
        # Similaire à txt mais pourrait inclure un traitement spécifique
        return self._process_txt(file_path, params)
    
    def _process_pdf(self, file_path: str, params: Dict[str, Any] = None) -> str:
        """Traite un fichier PDF"""
        try:
            import PyPDF2
            text = ""
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() + "\n\n"
            return text
        except ImportError:
            logger.error("PyPDF2 est requis pour traiter les fichiers PDF")
            raise ImportError("PyPDF2 est requis pour traiter les fichiers PDF")
    
    def _process_docx(self, file_path: str, params: Dict[str, Any] = None) -> str:
        """Traite un fichier DOCX"""
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n\n".join([para.text for para in doc.paragraphs])
        except ImportError:
            logger.error("python-docx est requis pour traiter les fichiers DOCX")
            raise ImportError("python-docx est requis pour traiter les fichiers DOCX")
