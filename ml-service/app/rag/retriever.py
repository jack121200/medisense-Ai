"""
Retrieval over the curated health knowledge base.

Deliberately TF-IDF + cosine similarity rather than dense embeddings.
Reasons, in order of weight:

1. The service already loads XGBoost, scikit-learn, pgmpy and a PyTorch
   autoencoder. A sentence-transformer model on top of that pushes RSS past
   what a free-tier container is given, and an OOM-killed service is worse
   than slightly coarser retrieval.
2. scikit-learn is already a dependency, so this adds no install surface.
3. The corpus is small (~50 curated documents) and its vocabulary is
   domain-specific. Lexical overlap between a chief complaint and a
   document's keyword list is a strong signal at this scale — dense
   retrieval earns its cost on large, paraphrase-heavy corpora, which this
   is not.

Hindi/Hinglish terms are carried in each document's `keywords`, which is why
a query like "pet mein jalan" still reaches the acidity document.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

CORPUS_DIR = Path(__file__).parent / "corpus"

# Hinglish filler. Without these, "ghutno MEIN DARD" scores against the
# cardiac red flag purely on shared filler words. Only grammatical filler
# is listed —
# body-part and symptom words (including "dard") stay indexable.
HINGLISH_STOPWORDS = [
    "mein", "me", "aur", "hai", "hain", "ho", "raha", "rahi", "rahe", "ka",
    "ki", "ke", "se", "ko", "par", "bhi", "kya", "kar", "karta", "karti",
    "bahut", "thoda", "jyada", "zyada", "nahi", "nai", "haan", "toh", "to",
    "mera", "meri", "mujhe", "aap", "aapko", "yeh", "ye", "woh", "wo",
    "problem", "issue", "feel", "feeling", "lagta", "lagti", "hota",
    "hoti", "kuch", "sir", "doctor", "please", "help",
]



@dataclass
class Document:
    id: str
    collection: str
    title: str
    keywords: list[str]
    text: str
    extra: dict[str, str] = field(default_factory=dict)

    def indexable_text(self) -> str:
        """
        Keywords are repeated three times so an exact complaint term
        ("acidity", "pet mein jalan") outweighs incidental prose overlap.
        Without this the long `text` field dominates the vector and short
        keyword hits get buried.
        """
        keyword_blob = " ".join(self.keywords)
        parts = [self.title, keyword_blob, keyword_blob, keyword_blob, self.text]
        parts.extend(self.extra.values())
        return " ".join(parts)

    def to_payload(self) -> dict[str, Any]:
        payload = {
            "id": self.id,
            "collection": self.collection,
            "title": self.title,
            "text": self.text,
        }
        payload.update(self.extra)
        return payload


# Fields carried through to the prompt alongside `text`, per collection.
_EXTRA_FIELDS = ("dosage", "contraindications", "self_care", "diet",
                 "escalate", "action", "practice", "source")


def load_corpus(corpus_dir: Path = CORPUS_DIR) -> list[Document]:
    docs: list[Document] = []
    for path in sorted(corpus_dir.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        collection = raw.get("collection", path.stem)
        for entry in raw.get("documents", []):
            extra = {k: entry[k] for k in _EXTRA_FIELDS if entry.get(k)}
            docs.append(Document(
                id=entry["id"],
                collection=collection,
                title=entry["title"],
                keywords=entry.get("keywords", []),
                text=entry["text"],
                extra=extra,
            ))
    if not docs:
        raise ValueError(f"No corpus documents found under {corpus_dir}")
    return docs


class KnowledgeRetriever:
    def __init__(self, documents: list[Document], vectorizer: TfidfVectorizer, matrix):
        self.documents = documents
        self.vectorizer = vectorizer
        self.matrix = matrix

    @classmethod
    def build(cls, corpus_dir: Path = CORPUS_DIR) -> "KnowledgeRetriever":
        documents = load_corpus(corpus_dir)
        vectorizer = TfidfVectorizer(
            # Word bigrams catch multi-word complaints ("chest pain",
            # "blood in stool") that unigrams alone would split apart.
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            strip_accents="unicode",
            lowercase=True,
            token_pattern=r"(?u)\b\w\w+\b",
            stop_words=HINGLISH_STOPWORDS,
        )
        matrix = vectorizer.fit_transform(d.indexable_text() for d in documents)
        logger.info("RAG index built: %d docs, %d features",
                    len(documents), len(vectorizer.vocabulary_))
        return cls(documents, vectorizer, matrix)

    def search(self, query: str, top_k: int = 4, min_score: float = 0.04
               ) -> list[dict[str, Any]]:
        query = (query or "").strip()
        if not query:
            return []

        scores = cosine_similarity(self.vectorizer.transform([query]), self.matrix)[0]

        # A safety document that matches at all is always worth surfacing:
        # the whole point of the red-flag entries is that they appear
        # alongside the remedy for the same complaint, not instead of it,
        # and lexically they are short so they lose on raw cosine score.
        ranked = np.argsort(scores)[::-1]
        picked: list[int] = []
        for idx in ranked:
            if scores[idx] < min_score:
                break
            picked.append(int(idx))
            if len(picked) >= top_k:
                break

        safety_hits = [
            int(i) for i in ranked
            if self.documents[int(i)].collection == "safety"
            and scores[int(i)] >= min_score
            and int(i) not in picked
        ]
        for idx in safety_hits[:2]:
            picked.append(idx)

        results = []
        for idx in picked:
            doc = self.documents[idx]
            payload = doc.to_payload()
            payload["score"] = round(float(scores[idx]), 4)
            results.append(payload)
        return results

@lru_cache(maxsize=1)
def get_retriever() -> "KnowledgeRetriever":
    """Process-wide singleton. Built on first use, then reused."""
    return KnowledgeRetriever.build()


def render_for_prompt(results: Iterable[dict[str, Any]], max_chars: int = 1800) -> str:
    """
    Flatten retrieved documents into the block spliced into the AI Doctor's
    system prompt. Capped because this text is re-sent on every turn of a
    live voice call, where extra input tokens are paid for in latency.
    """
    lines: list[str] = []
    budget = max_chars
    for r in results:
        chunk = [f"— {r['title']}: {r['text']}"]
        for key, label in (("dosage", "Dose"), ("self_care", "Self-care"),
                           ("diet", "Diet"), ("contraindications", "Avoid if"),
                           ("action", "Action"), ("escalate", "See a doctor")):
            if r.get(key):
                chunk.append(f"  {label}: {r[key]}")
        block = "\n".join(chunk)
        if len(block) > budget:
            # Never return nothing just because the best-matching document is
            # verbose — a truncated top hit still grounds the model, whereas an
            # empty block silently removes grounding from the prompt entirely.
            if not lines and budget > 200:
                lines.append(block[:budget].rsplit(" ", 1)[0] + "…")
            break
        lines.append(block)
        budget -= len(block)
    return "\n".join(lines)


def _strip(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()
