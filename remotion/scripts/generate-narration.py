"""Generate presenter narration mp3s via ElevenLabs.

Two parts so Seraphina's audio can take the floor cleanly between them:
- presenter-1.mp3: opening through "Listen."
- presenter-2.mp3: from "Nine hundred and sixty articles" through the close

Run inside genesis-api:
    docker exec genesis-api python3 /tmp/generate-narration.py
"""
import os
import sys
import httpx

# Antoni — well-rounded male voice, free-tier, fits a first-person dev demo.
VOICE_ID = 'ErXwobaYiN019PkySvjV'

PARTS = [
    (
        '/tmp/presenter-1.mp3',
        """Chroniclon. A wikipedia for a world that doesn't exist.

Three agents.

Hermes-4 decides what's article-worthy.

Kimi K2.6 writes the prose.

Hermes critics score it.

This one. Seraphina's Final Entry.

Listen.""",
    ),
    (
        '/tmp/presenter-2.mp3',
        """And the language drifts.

Karim becomes cherim.

Hermesgenesis dot world.""",
    ),
]


def render(out_path: str, text: str) -> None:
    key = os.getenv('ELEVENLABS_API_KEY')
    if not key:
        print('ELEVENLABS_API_KEY missing', file=sys.stderr)
        sys.exit(1)
    print(f'{out_path}: {len(text)} chars', file=sys.stderr)
    r = httpx.post(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}',
        headers={
            'xi-api-key': key,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
        },
        json={
            'text': text,
            'model_id': 'eleven_multilingual_v2',
            'voice_settings': {
                'stability': 0.55,
                'similarity_boost': 0.75,
                'style': 0.0,
                'use_speaker_boost': True,
            },
        },
        timeout=180,
    )
    print(f'  status: {r.status_code}', file=sys.stderr)
    if r.status_code != 200:
        print(r.text[:400], file=sys.stderr)
        sys.exit(1)
    with open(out_path, 'wb') as f:
        f.write(r.content)
    print(f'  wrote {len(r.content)} bytes', file=sys.stderr)


def main() -> None:
    for out, text in PARTS:
        render(out, text)


if __name__ == '__main__':
    main()
