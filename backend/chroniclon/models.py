from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


ArticleKind = Literal[
    "event",       # specific historical event
    "person",      # biography
    "faction",     # organization / dynasty / cult
    "place",       # region, city, landmark
    "language",    # linguistic era / tongue
    "concept",     # cultural / religious / scientific concept
    "artifact",    # object with provenance
    "prophecy",    # cryptic foretelling and its fulfillment
]

VoiceTone = Literal[
    "scholarly",   # neutral wiki tone
    "diary",       # first-person personal
    "newspaper",   # journalistic
    "scripture",   # religious / mythic
    "court",       # official chronicle
]


class LinguisticEra(BaseModel):
    """A snapshot of the world's evolving language at one era boundary."""
    era_id: str
    era_name: str                       # e.g. "Cinder Age"
    in_world_year: int                  # absolute in-world year this era began
    parent_era: str | None = None       # the era this drifted from
    phonology_notes: str = ""           # short prose: "fricatives soften, /θ/ → /s/"
    sample_lexicon: dict[str, str] = Field(default_factory=dict)  # english → in-world
    sample_text: str = ""               # one paragraph in the era's voice


class Era(BaseModel):
    era_id: str
    name: str
    ordinal: int                        # 0 = founding, 1 = next, ...
    start_year: int                     # in-world year
    end_year: int | None = None
    summary: str = ""
    linguistic_era: str | None = None   # FK to LinguisticEra.era_id
    art_style: str = ""                 # FLUX style hint, e.g. "charcoal woodcut, sepia tones"
    dominant_factions: list[str] = Field(default_factory=list)
    notable_events: list[str] = Field(default_factory=list)


class WikiArticle(BaseModel):
    article_id: str
    slug: str                           # url-friendly key
    title: str
    kind: ArticleKind
    era_id: str
    in_world_year: int                  # year this article describes
    written_year: int | None = None     # year an in-world historian wrote it (may differ)
    voice: VoiceTone = "scholarly"
    body_md: str                        # markdown article body
    word_count: int = 0
    backlinks: list[str] = Field(default_factory=list)   # outbound article slugs
    inbound: list[str] = Field(default_factory=list)     # populated by cross-link agent
    sources_cited: list[str] = Field(default_factory=list)  # in-world cited works
    illustration_prompt: str | None = None
    illustration_url: str | None = None
    audio_url: str | None = None
    contributor: str | None = None      # x handle if audience-submitted
    critic_passes: int = 0
    anti_slop_score: float | None = None
    fact_check_score: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CanonSubmission(BaseModel):
    """An audience contribution awaiting moderation + canonization."""
    submission_id: str
    contributor_handle: str             # x or anonymous handle
    seed_text: str                      # the human's submitted event
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    moderation: Literal["pending", "approved", "rejected"] = "pending"
    moderation_reason: str = ""
    canonized_article_id: str | None = None
