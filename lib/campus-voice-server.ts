import { gzipSync, gunzipSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

export class VoiceError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export function voiceConfig(env: Record<string, unknown>) {
  const value = (name: string, fallback = '') =>
    typeof env[name] === 'string' && env[name].trim()
      ? env[name].trim()
      : fallback;
  const config = {
    apiKey: value('VOLC_VOICE_API_KEY'),
    asrUrl: value(
      'VOLC_ASR_URL',
      'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async',
    ),
    asrResource: value('VOLC_ASR_RESOURCE_ID', 'volc.seedasr.sauc.duration'),
    ttsUrl: value(
      'VOLC_TTS_URL',
      'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse',
    ),
    ttsResource: value('VOLC_TTS_RESOURCE_ID', 'seed-tts-2.0'),
    speaker: value('VOLC_TTS_VOICE', 'zh_female_wenroushunv_uranus_bigtts'),
    sampleRate: Number(value('VOLC_TTS_SAMPLE_RATE', '24000')),
  };
  for (const [address, protocol] of [
    [config.asrUrl, 'wss:'],
    [config.ttsUrl, 'https:'],
  ]) {
    const url = new URL(address);
    if (
      url.protocol !== protocol ||
      url.hostname !== 'openspeech.bytedance.com' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new VoiceError('语音服务地址配置不正确。', 503);
  }
  if (
    ![8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(
      config.sampleRate,
    )
  )
    throw new VoiceError('语音采样率配置不正确。', 503);
  return config;
}
type Config = ReturnType<typeof voiceConfig>;
const requireKey = (config: Config) => {
  if (!config.apiKey)
    throw new VoiceError('尚未配置语音服务，请设置 VOLC_VOICE_API_KEY。', 503);
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function asrPacket(payload: Uint8Array, initial = false, last = false) {
  const compressed = gzipSync(payload);
  const packet = Buffer.alloc((initial ? 12 : 8) + compressed.length);
  packet.set([
    0x11,
    initial ? 0x11 : last ? 0x22 : 0x20,
    initial ? 0x11 : 0x01,
    0,
  ]);
  if (initial) packet.writeInt32BE(1, 4);
  packet.writeUInt32BE(compressed.length, initial ? 8 : 4);
  packet.set(compressed, initial ? 12 : 8);
  return packet;
}
export function parseAsrPacket(bytes: ArrayBuffer) {
  const data = Buffer.from(bytes);
  if (data.length < 8) throw new VoiceError('语音识别响应不完整。');
  const type = data[1] >> 4,
    flags = data[1] & 15;
  let offset = (data[0] & 15) * 4;
  if (offset < 4 || data[0] >> 4 !== 1)
    throw new VoiceError('语音识别协议不匹配。');
  if (type === 15)
    throw new VoiceError('语音识别服务拒绝了请求，请检查语音资源权限或额度。');
  if (type !== 9)
    throw new VoiceError(`语音识别响应格式不正确（帧类型 ${type}）。`);
  let sequence = 0;
  if (flags & 1) {
    if (data.length < offset + 4) throw new VoiceError('语音识别响应不完整。');
    sequence = data.readInt32BE(offset);
    offset += 4;
  }
  if (data.length < offset + 4) throw new VoiceError('语音识别响应不完整。');
  const size = data.readUInt32BE(offset);
  offset += 4;
  if (size > 1024 * 1024 || data.length !== offset + size)
    throw new VoiceError('语音识别响应长度异常。');
  const body = data.subarray(offset);
  const payload: unknown = JSON.parse(
    ((data[2] & 15) === 1
      ? gunzipSync(body, { maxOutputLength: 1024 * 1024 })
      : body
    ).toString('utf8'),
  );
  if (!record(payload)) throw new VoiceError('语音识别结果格式不正确。');
  if (
    typeof payload.code === 'number' &&
    ![0, 1000, 20000000].includes(payload.code)
  )
    throw new VoiceError('语音识别未完成，请重试。');
  const result = record(payload.result) ? payload.result : {};
  return {
    text: typeof result.text === 'string' ? result.text : '',
    final: !!(flags & 2) || sequence < 0,
  };
}
interface UpstreamSocket {
  binaryType: string;
  accept(): void;
  send(data: Uint8Array): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: string,
    listener: (event: { data?: unknown }) => void,
  ): void;
}
export async function recognizeSpeech(
  config: Config,
  pcm: Uint8Array,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  requireKey(config);
  if (pcm.length < 9600 || pcm.length > 960000 || pcm.length % 2)
    throw new VoiceError('请录制 0.3–30 秒的语音。', 400);
  signal.throwIfAborted();
  const upstream = (await fetcher(config.asrUrl.replace(/^wss:/, 'https:'), {
    headers: {
      Upgrade: 'websocket',
      'X-Api-Key': config.apiKey,
      'X-Api-Resource-Id': config.asrResource,
      'X-Api-Connect-Id': crypto.randomUUID(),
      'X-Api-Request-Id': crypto.randomUUID(),
    },
    signal,
  })) as Response & { webSocket?: UpstreamSocket };
  const ws = upstream.webSocket;
  if (!ws)
    throw new VoiceError('无法连接语音识别服务，请检查语音资源权限或网络。');
  return new Promise((resolve, reject) => {
    let settled = false,
      sent = false,
      text = '',
      offset = 0;
    let sender: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      () => finish(new VoiceError('语音识别超时，请重试。')),
      35000,
    );
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(sender);
      signal.removeEventListener('abort', abort);
      try {
        ws.close(1000, 'complete');
      } catch {
        /* Already closed. */
      }
      if (error) reject(error);
      else if (!text.trim())
        reject(new VoiceError('没有听清，请靠近麦克风再说一次。', 422));
      else if (text.length > 1000)
        reject(new VoiceError('这段语音较长，请分成两次提问。', 400));
      else resolve(text.trim());
    };
    const abort = () => finish(new VoiceError('语音识别已取消。', 499));
    const sendNext = () => {
      if (settled) return;
      try {
        const next = Math.min(offset + 6400, pcm.length);
        ws.send(
          asrPacket(pcm.subarray(offset, next), false, next === pcm.length),
        );
        offset = next;
        if (offset < pcm.length) sender = setTimeout(sendNext, 20);
      } catch {
        finish(new VoiceError('语音上传中断，请重试。'));
      }
    };
    ws.addEventListener('message', (event) => {
      if (settled) return;
      try {
        if (!(event.data instanceof ArrayBuffer))
          throw new VoiceError(
            `语音识别响应格式不正确（数据类型 ${Object.prototype.toString.call(event.data)}）。`,
          );
        const response = parseAsrPacket(event.data);
        if (response.text) text = response.text;
        if (response.final) {
          finish();
          return;
        }
        if (!sent) {
          sent = true;
          sendNext();
        }
      } catch (error) {
        finish(
          error instanceof VoiceError
            ? error
            : new VoiceError('语音识别响应无法解析。'),
        );
      }
    });
    ws.addEventListener('error', () =>
      finish(new VoiceError('语音识别连接中断，请重试。')),
    );
    ws.addEventListener('close', () =>
      finish(new VoiceError('语音识别未完成，请重试。')),
    );
    signal.addEventListener('abort', abort, { once: true });
    try {
      ws.binaryType = 'arraybuffer';
      ws.accept();
      if (signal.aborted) {
        abort();
        return;
      }
      ws.send(
        asrPacket(
          new TextEncoder().encode(
            JSON.stringify({
              user: { uid: 'hkust-campus' },
              audio: {
                format: 'pcm',
                codec: 'raw',
                rate: 16000,
                sample_rate: 16000,
                bits: 16,
                channel: 1,
              },
              request: {
                model_name: 'bigmodel',
                enable_punc: true,
                enable_itn: true,
                show_utterances: true,
              },
            }),
          ),
          true,
        ),
      );
    } catch {
      finish(new VoiceError('无法启动语音识别，请重试。'));
    }
  });
}

export async function synthesizeSpeech(
  config: Config,
  text: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  requireKey(config);
  if (!text.trim() || text.length > 2000)
    throw new VoiceError('播报文字需要为 1–2000 字。', 400);
  const response = await fetcher(config.ttsUrl, {
    method: 'POST',
    signal,
    headers: {
      'X-Api-Key': config.apiKey,
      'X-Api-Resource-Id': config.ttsResource,
      'X-Api-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      user: { uid: 'hkust-campus' },
      req_params: {
        text: text.trim(),
        speaker: config.speaker,
        audio_params: { format: 'mp3', sample_rate: config.sampleRate },
        additions: JSON.stringify({
          disable_markdown_filter: true,
          max_length_to_filter_parenthesis: 100,
        }),
      },
    }),
  });
  if (!response.ok || !response.body)
    throw new VoiceError('语音合成服务不可用，请检查语音资源权限或额度。');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let pending = '',
    total = 0,
    received = 0,
    finished = false;
  const event = (raw: string) => {
    let id = 0;
    const lines: string[] = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) id = Number(line.slice(6).trim());
      if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
    }
    if (!lines.length) return;
    const value: unknown = JSON.parse(lines.join('\n'));
    if (!record(value)) throw new VoiceError('语音合成返回格式不正确。');
    if (
      [151, 153].includes(id) ||
      (typeof value.code === 'number' && ![0, 20000000].includes(value.code))
    )
      throw new VoiceError('语音合成失败，请检查音色和语音资源配置。');
    if (id === 352 && typeof value.data === 'string') {
      const bytes = Buffer.from(value.data, 'base64');
      total += bytes.length;
      if (total > 8 * 1024 * 1024) throw new VoiceError('播报音频过长。');
      chunks.push(bytes);
    }
    if (id === 152) finished = true;
  };
  try {
    while (!finished) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        pending += decoder.decode();
        if (pending.trim()) event(pending);
        break;
      }
      received += value.length;
      if (received > 12 * 1024 * 1024) throw new VoiceError('语音响应过长。');
      pending += decoder.decode(value, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let end: number;
      while ((end = pending.indexOf('\n\n')) !== -1) {
        event(pending.slice(0, end));
        pending = pending.slice(end + 2);
      }
    }
    if (!finished || !total) throw new VoiceError('语音合成未完成，请重试。');
    return new Uint8Array(Buffer.concat(chunks));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
