import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamRegen, type RegenEvent } from './streamRegen';

/**
 * Helper — turn a list of SSE chunks into a ReadableStream<Uint8Array> the
 * way fetch() would deliver one. Lets us drive the parser end-to-end without
 * a real network round-trip.
 */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

function mockFetchOk(body: ReadableStream<Uint8Array>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamRegen SSE parser', () => {
  it('dispatches a progress event', async () => {
    const stream = sseStream([
      'event: progress\n',
      'data: {"stage":"spawning_world","detail":"5 regions"}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('a seed', 1, 'kimi', (e) => got.push(e));

    await new Promise((r) => setTimeout(r, 20));
    expect(got).toContainEqual({
      t: 'progress',
      stage: 'spawning_world',
      detail: '5 regions',
    });
  });

  it('dispatches a world_ready event with all fields', async () => {
    const payload = {
      world_id: 'w-01',
      name: 'Oyo',
      regions: 5,
      factions: 3,
      characters: 5,
    };
    const stream = sseStream([
      'event: world_ready\n',
      `data: ${JSON.stringify(payload)}\n\n`,
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'nous', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'world_ready', ...payload });
  });

  it('derives new_events_count from the new_events array on day_complete', async () => {
    const stream = sseStream([
      'event: day_complete\n',
      'data: {"day":7,"new_events":[{"id":"e1"},{"id":"e2"},{"id":"e3"}]}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'day_complete', day: 7, new_events_count: 3 });
  });

  it('treats missing new_events as zero count', async () => {
    const stream = sseStream([
      'event: day_complete\n',
      'data: {"day":2}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'day_complete', day: 2, new_events_count: 0 });
  });

  it('handles a chunk split mid-line (incremental SSE)', async () => {
    const stream = sseStream([
      'event: progress\ndata: {"stage":"',  // split happens here
      'writing","detail":"Kimi-K2.6"}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'progress', stage: 'writing', detail: 'Kimi-K2.6' });
  });

  it('skips ping events without dispatching', async () => {
    const stream = sseStream([
      'event: ping\ndata: 1\n\n',
      'event: progress\ndata: {"stage":"after_ping"}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ t: 'progress', stage: 'after_ping' });
  });

  it('emits an error event when fetch rejects with a non-abort error', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('fetch', failing);

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'error', message: 'boom' });
  });

  it('returns an abort function that cancels the request', async () => {
    const stream = sseStream(['event: progress\ndata: {"stage":"x"}\n\n']);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const abort = streamRegen('seed', 1, 'kimi', () => {});
    expect(typeof abort).toBe('function');
    abort();
  });

  it('routes article_canonized payloads through the right discriminant', async () => {
    const article = {
      slug: 'long-drought',
      title: 'The Long Drought of the Walled-City',
      kind: 'event',
      voice: 'scripture',
      word_count: 612,
      writer: 'kimi',
      writer_label: 'Kimi-K2.6',
    };
    const stream = sseStream([
      'event: article_canonized\n',
      `data: ${JSON.stringify(article)}\n\n`,
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got[0]).toEqual({ t: 'article_canonized', ...article });
  });

  it('survives a malformed JSON line without crashing', async () => {
    const stream = sseStream([
      'event: progress\ndata: {not_json\n\n',
      'event: progress\ndata: {"stage":"recovered"}\n\n',
    ]);
    vi.stubGlobal('fetch', mockFetchOk(stream));

    const got: RegenEvent[] = [];
    streamRegen('seed', 1, 'kimi', (e) => got.push(e));
    await new Promise((r) => setTimeout(r, 20));

    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ t: 'progress', stage: 'recovered' });
  });
});
