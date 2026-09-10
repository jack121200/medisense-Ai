"""
Retrieval quality regression tests.

The corpus is hand-curated, so the real risk is a well-meaning edit (adding
keywords, rewording a document) quietly degrading which document wins for a
common complaint. These assert on retrieval *behaviour* — the right document
reaches the top for the way patients actually phrase things, in English and
Hinglish — rather than on exact scores, which will drift with the corpus.
"""
import pytest

from app.rag.retriever import get_retriever, render_for_prompt


@pytest.fixture(scope="module")
def retriever():
    return get_retriever()


def top_id(retriever, query: str) -> str:
    hits = retriever.search(query, top_k=3)
    assert hits, f"no results for {query!r}"
    return hits[0]["id"]


@pytest.mark.parametrize("query,expected", [
    # English
    ("acidity and burning in my chest after late meals", "cond-acidity-gerd"),
    ("my knees hurt and are stiff every morning", "cond-joint-pain"),
    ("I cannot sleep at night", "cond-insomnia"),
    ("irregular periods and pcos", "cond-menstrual-pcos"),
    ("blood sugar is high, what should I eat", "cond-diabetes"),
    # Hinglish — patients rarely describe symptoms in clean English
    ("pet mein jalan aur khatti dakar", "cond-acidity-gerd"),
    ("ghutno mein dard aur subah akadan", "cond-joint-pain"),
    ("sir dard bahut ho raha hai", "cond-headache-migraine"),
    ("kamar mein dard", "cond-back-pain"),
    ("neend nahi aa rahi", "cond-insomnia"),
    ("sardi khansi gala kharab", "cond-cold-cough"),
])
def test_common_complaints_reach_the_right_document(retriever, query, expected):
    assert top_id(retriever, query) == expected


@pytest.mark.parametrize("query,expected", [
    ("chest pain with sweating going to my left arm", "red-cardiac"),
    ("seene mein dard aur pasina", "red-cardiac"),
    ("muh tedha ho gaya, bolne mein dikkat", "red-stroke"),
    ("I want to end my life", "red-mental-health"),
    ("blood in vomit", "red-gi-bleed"),
])
def test_emergencies_surface_the_red_flag_first(retriever, query, expected):
    assert top_id(retriever, query) == expected


def test_red_flags_ride_along_with_ordinary_complaints(retriever):
    """
    Burning chest pain is the classic case where a gastric complaint and a
    cardiac emergency present identically. The safety document must reach the
    prompt alongside the acidity advice, not be crowded out by it.
    """
    hits = retriever.search("chest burning and discomfort", top_k=4)
    collections = {h["collection"] for h in hits}
    assert "safety" in collections


def test_pregnancy_caution_is_retrievable(retriever):
    hits = retriever.search("I am pregnant and have a cough", top_k=4)
    assert any(h["id"] == "red-pregnancy" for h in hits)


def test_herb_documents_carry_contraindications(retriever):
    """
    Every herb the assistant can suggest must retrieve with its interaction
    text attached — that is what keeps the spoken advice aligned with the
    deterministic guard in the backend.
    """
    for query in ["ashwagandha for stress", "licorice for sore throat",
                  "neem for skin", "arjuna for heart"]:
        hits = retriever.search(query, top_k=3)
        herb_hits = [h for h in hits if h["collection"] == "herbs"]
        assert herb_hits, f"no herb document for {query!r}"
        assert herb_hits[0].get("contraindications"), \
            f"{herb_hits[0]['id']} retrieved without contraindications"


def test_empty_query_returns_nothing(retriever):
    assert retriever.search("") == []
    assert retriever.search("   ") == []


def test_prompt_block_respects_its_budget(retriever):
    hits = retriever.search("diabetes and high blood pressure", top_k=6)
    block = render_for_prompt(hits, max_chars=600)
    assert len(block) <= 700  # last chunk may finish slightly over the budget
    assert block, "expected a non-empty prompt block"


def test_prompt_block_is_readable_text(retriever):
    hits = retriever.search("constipation", top_k=2)
    block = render_for_prompt(hits)
    assert "Constipation" in block
    assert "—" in block
