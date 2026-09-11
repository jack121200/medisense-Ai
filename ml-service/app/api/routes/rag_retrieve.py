"""
Retrieval endpoint for the AI Doctor's knowledge base.

Called once per consultation (at call setup, and again when the post-call
report is generated) — never per conversation turn, so it stays off the
live voice latency path.
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.rag.retriever import get_retriever, render_for_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000,
                       description="Chief complaint or transcript excerpt")
    top_k: int = Field(4, ge=1, le=10)
    render: bool = Field(True, description="Also return a prompt-ready text block")
    max_chars: int = Field(
        1800, ge=200, le=4000,
        description="Budget for prompt_block. The live call asks for a compact block "
                    "because it is re-sent on every conversation turn; the post-call "
                    "report can afford the full one.",
    )


class RetrievedDocument(BaseModel):
    id: str
    collection: str
    title: str
    text: str
    score: float
    dosage: str | None = None
    contraindications: str | None = None
    self_care: str | None = None
    diet: str | None = None
    escalate: str | None = None
    action: str | None = None
    practice: str | None = None
    source: str | None = None


class RetrieveResponse(BaseModel):
    query: str
    count: int
    documents: list[RetrievedDocument]
    prompt_block: str = ""
    has_red_flag: bool = Field(
        False,
        description="True when a safety/red-flag document matched, so the caller "
                    "can raise urgency without re-parsing the documents.",
    )


@router.post("/retrieve", response_model=RetrieveResponse,
             summary="Retrieve grounded health knowledge for a complaint")
def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    try:
        results = get_retriever().search(req.query, top_k=req.top_k)
    except Exception as exc:
        logger.exception("RAG retrieval failed")
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {exc}") from exc

    return RetrieveResponse(
        query=req.query,
        count=len(results),
        documents=[RetrievedDocument(**r) for r in results],
        prompt_block=render_for_prompt(results, max_chars=req.max_chars) if req.render else "",
        has_red_flag=any(r["collection"] == "safety" for r in results),
    )


@router.get("/status", summary="RAG knowledge base status")
def status() -> dict:
    r = get_retriever()
    by_collection: dict[str, int] = {}
    for doc in r.documents:
        by_collection[doc.collection] = by_collection.get(doc.collection, 0) + 1
    return {
        "ready": True,
        "n_documents": len(r.documents),
        "n_features": len(r.vectorizer.vocabulary_),
        "collections": by_collection,
        "retrieval": "TF-IDF (1-2 grams) + cosine similarity",
    }
