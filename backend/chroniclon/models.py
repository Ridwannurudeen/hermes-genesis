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


class PhonologicalRule(BaseModel):
    """A single sound shift from the parent era. Renders as `from → to / context`
    in the UI sound-change tree."""
    from_sound: str = ""        # IPA-ish or letter, e.g. "/θ/" or "th"
    to_sound: str = ""          # what it became, e.g. "/s/" or "s"
    context: str = ""           # word-initial / intervocalic / before vowel / etc.


class Morphology(BaseModel):
    """How the era inflects words. These are coined for the fictional language;
    they are not real linguistic claims."""
    plural_marker: str = ""         # e.g. "-ar suffix"
    honorific_prefix: str = ""      # e.g. "ael-" before noble names
    place_name_suffix: str = ""     # e.g. "-vael" for sacred sites
    diminutive: str = ""            # e.g. "-ik" affectionate ending
    notes: str = ""                 # other agglutinative / inflectional hints


class Inscription(BaseModel):
    """An in-world inscription with translation. Used for visual demos: stones,
    banners, scripture margins, ceremonial seals."""
    in_world_text: str = ""
    translation: str = ""
    context: str = ""               # gravestone, banner, scripture margin, seal


class LinguisticEra(BaseModel):
    """A snapshot of the world's evolving language at one era boundary."""
    era_id: str
    era_name: str                       # e.g. "Cinder Age"
    in_world_year: int                  # absolute in-world year this era began
    parent_era: str | None = None       # the era this drifted from
    phonology_notes: str = ""           # short prose: "fricatives soften, /θ/ → /s/"
    phonological_rules: list[PhonologicalRule] = Field(default_factory=list)
    morphology: Morphology = Field(default_factory=Morphology)
    sample_lexicon: dict[str, str] = Field(default_factory=dict)  # english → in-world
    sample_text: str = ""               # one paragraph in the era's voice
    inscriptions: list[Inscription] = Field(default_factory=list)


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
    # Provenance: which simulation event was canonized into this article.
    # Lets the Civilization Autopsy view trace article → event → causal chain.
    source_event_id: str | None = None
    source_world_id: str | None = None
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
