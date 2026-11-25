export class CampusRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: ArrayBuffer[] = [];
  private total = 0;
  private finish: (() => void) | null = null;
  private cancelled = false;

  async start(signal: AbortSignal) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error('语音需要在 localhost 或 HTTPS 页面使用。');
    this.context = new AudioContext({ sampleRate: 16000 });
    // Resume in the original user gesture, before awaiting microphone permission.
    const resumed = this.context.resume().catch(() => {});
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (signal.aborted || this.cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException('Cancelled', 'AbortError');
    }
    this.stream = stream;
    await resumed;
    await this.context.audioWorklet.addModule('/campus-voice-worklet.js');
    if (signal.aborted || this.cancelled)
      throw new DOMException('Cancelled', 'AbortError');
    this.node = new AudioWorkletNode(this.context, 'campus-recorder');
    this.node.port.onmessage = ({
      data,
    }: MessageEvent<{ pcm?: ArrayBuffer; done?: boolean }>) => {
      if (data.pcm && this.total < 960000) {
        const chunk = data.pcm.slice(0, 960000 - this.total);
        this.chunks.push(chunk);
        this.total += chunk.byteLength;
      }
      if (data.done) this.finish?.();
    };
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.node);
    // Worklet outputs silence; connecting keeps processing active on Safari too.
    this.node.connect(this.context.destination);
  }
  async stop(): Promise<Blob> {
    if (!this.node || this.cancelled)
      throw new DOMException('Cancelled', 'AbortError');
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('录音结束失败，请重试。')),
          1500,
        );
        this.finish = () => {
          clearTimeout(timer);
          resolve();
        };
        this.node!.port.postMessage('stop');
      });
      if (this.total < 9600)
        throw new Error('录音太短，请按住按钮说完一句话再松开。');
      return new Blob(this.chunks, { type: 'application/octet-stream' });
    } finally {
      this.cancel();
    }
  }
  cancel() {
    this.cancelled = true;
    this.finish?.();
    this.finish = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source?.disconnect();
    this.node?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    this.node = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.chunks = [];
  }
}

export async function voiceResponse(response: Response) {
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      result &&
        typeof result === 'object' &&
        'error' in result &&
        typeof result.error === 'string'
        ? result.error
        : '语音服务暂时不可用，请重试。',
    );
  return result;
}
export class CampusSpeechPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private request: AbortController | null = null;
  private cached: { text: string; buffer: AudioBuffer } | null = null;
  unlock() {
    this.context ??= new AudioContext();
    return this.context.resume().catch(() => {});
  }
  stop() {
    this.request?.abort();
    this.request = null;
    try {
      this.source?.stop();
    } catch {
      /* Already stopped. */
    }
    this.source = null;
  }
  async play(text: string, signal: AbortSignal, onPlaying: () => void) {
    this.stop();
    const controller = new AbortController();
    this.request = controller;
    const combined = AbortSignal.any([signal, controller.signal]);
    try {
      const context = this.context;
      if (!context || context.state !== 'running')
        throw new Error('浏览器暂停了声音，点击“播放回复”即可播放。');
      let buffer = this.cached?.text === text ? this.cached.buffer : null;
      if (!buffer) {
        const response = await fetch('/api/campus-voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: combined,
        });
        if (!response.ok) await voiceResponse(response);
        buffer = await context.decodeAudioData(await response.arrayBuffer());
        combined.throwIfAborted();
        this.cached = { text, buffer };
      }
      combined.throwIfAborted();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      this.source = source;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          source.onended = null;
          try {
            source.stop();
          } catch {
            /* Already stopped. */
          }
          source.disconnect();
          reject(new DOMException('Cancelled', 'AbortError'));
        };
        combined.addEventListener('abort', abort, { once: true });
        source.onended = () => {
          combined.removeEventListener('abort', abort);
          source.disconnect();
          resolve();
        };
        source.start();
        onPlaying();
      });
    } finally {
      if (this.request === controller) {
        this.request = null;
        this.source = null;
      }
    }
  }
  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.cached = null;
  }
}
