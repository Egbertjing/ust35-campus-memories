import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  asrPacket,
  parseAsrPacket,
  recognizeSpeech,
  synthesizeSpeech,
  voiceConfig,
} from '../lib/campus-voice-server';

const config = voiceConfig({ VOLC_VOICE_API_KEY: 'test-placeholder' });
assert.throws(() => voiceConfig({ VOLC_ASR_URL: 'wss://example.com/asr' }));
const init = asrPacket(Buffer.from('{"audio":{}}'), true);
assert.equal(init.readInt32BE(4), 1);
assert.equal(gunzipSync(init.subarray(12)).toString(), '{"audio":{}}');
assert.equal(asrPacket(Buffer.from([1, 2]), false, true)[1], 0x22);
function response(text: string, final = false) {
  const payload = gzipSync(Buffer.from(JSON.stringify({ result: { text } })));
  const packet = Buffer.alloc(12 + payload.length);
  packet.set([0x11, final ? 0x93 : 0x91, 0x11, 0]);
  packet.writeInt32BE(final ? -1 : 1, 4);
  packet.writeUInt32BE(payload.length, 8);
  packet.set(payload, 12);
  return packet.buffer.slice(
    packet.byteOffset,
    packet.byteOffset + packet.length,
  ) as ArrayBuffer;
}
assert.deepEqual(parseAsrPacket(response('图书馆', true)), {
  text: '图书馆',
  final: true,
});
assert.throws(() => parseAsrPacket(new ArrayBuffer(2)));
let closed = 0,
  audioFrames = 0;
const listeners = new Map<string, (event: { data?: unknown }) => void>();
const ws = {
  binaryType: 'blob',
  accept() {},
  close() {
    closed++;
  },
  addEventListener(name: string, handler: (event: { data?: unknown }) => void) {
    listeners.set(name, handler);
  },
  send(data: Uint8Array) {
    if (data[1] === 0x11)
      queueMicrotask(() => listeners.get('message')?.({ data: response('') }));
    else {
      audioFrames++;
      if (data[1] === 0x22)
        queueMicrotask(() =>
          listeners.get('message')?.({
            data: response('我在日晷广场，想去图书馆。', true),
          }),
        );
    }
  },
};
const fakeFetch = (async () => ({ webSocket: ws })) as unknown as typeof fetch;
assert.equal(
  await recognizeSpeech(
    config,
    new Uint8Array(9600),
    AbortSignal.timeout(2000),
    fakeFetch,
  ),
  '我在日晷广场，想去图书馆。',
);
assert.equal(ws.binaryType, 'arraybuffer');
assert.equal(closed, 1);
assert.equal(audioFrames, 2);
await assert.rejects(
  recognizeSpeech(
    config,
    new Uint8Array(4),
    new AbortController().signal,
    fakeFetch,
  ),
  /0.3/,
);
const aborted = new AbortController();
aborted.abort();
await assert.rejects(
  recognizeSpeech(config, new Uint8Array(9600), aborted.signal, fakeFetch),
);
await assert.rejects(
  synthesizeSpeech(voiceConfig({}), '你好', new AbortController().signal),
  /尚未配置/,
);
const sse =
  'event: 350\r\ndata: {"sentence":{"text":"你好"}}\r\n\r\nevent: 352\r\ndata: {"data":"aGVsbG8="}\r\n\r\nevent: 152\r\ndata: {"code":20000000}';
const encoded = new TextEncoder().encode(sse);
const ttsFetch = (async (_url: unknown, options?: RequestInit) => {
  const headers = new Headers(options?.headers);
  assert.equal(headers.get('X-Api-Key'), 'test-placeholder');
  const body = JSON.parse(options!.body as string);
  assert.equal(typeof body.req_params.additions, 'string');
  assert.equal(body.req_params.audio_params.format, 'mp3');
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < encoded.length; i += 7)
          controller.enqueue(encoded.slice(i, i + 7));
        controller.close();
      },
    }),
  );
}) as typeof fetch;
assert.equal(
  Buffer.from(
    await synthesizeSpeech(
      config,
      '你好',
      new AbortController().signal,
      ttsFetch,
    ),
  ).toString(),
  'hello',
);
await assert.rejects(
  synthesizeSpeech(
    config,
    '你好',
    new AbortController().signal,
    (async () =>
      new Response('event: 153\ndata: {"code":55000000}\n\n')) as typeof fetch,
  ),
  /语音合成失败/,
);

// Execute only the pure audio processor, with no browser or microphone access.
for (const rate of [16000, 44100, 48000]) {
  const packets: ArrayBuffer[] = [];
  let Processor: any;
  class Worklet {
    port = {
      onmessage: null as any,
      postMessage(data: { pcm?: ArrayBuffer }) {
        if (data.pcm) packets.push(data.pcm);
      },
    };
  }
  runInNewContext(readFileSync('public/campus-voice-worklet.js', 'utf8'), {
    AudioWorkletProcessor: Worklet,
    sampleRate: rate,
    registerProcessor(_name: string, processor: any) {
      Processor = processor;
    },
  });
  const worklet = new Processor();
  for (let at = 0; at < rate; at += 128)
    worklet.process([[new Float32Array(Math.min(128, rate - at)).fill(0.5)]]);
  worklet.port.onmessage({ data: 'stop' });
  assert.equal(
    packets.reduce((sum, p) => sum + p.byteLength, 0),
    32000,
    `${rate} Hz must yield exactly 16000 PCM samples, including partial last block`,
  );
  assert.equal(new DataView(packets[0]).getInt16(0, true), 16384);
  assert.equal(worklet.process([[new Float32Array(128)]]), false);
}
console.log(
  'Voice checks passed: ASR frames and finalization, cancellation, SSE chunk boundaries/errors, credentials isolation, 16/44.1/48 kHz recording and final partial-frame flush. No live provider requests in these tests.',
);
