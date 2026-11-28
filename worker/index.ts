/**
 * UST35 Campus Memories API on Cloudflare Workers (free plan).
 * Port of scripts/memory-server.py from the original server: same endpoints and rules.
 *   D1 (DB)      memories, version history, legacy change requests, upload log
 *   KV (PHOTOS)  photo bytes, one key per uploaded image (versions share keys, so edits that
 *                do not replace the photo cost no storage)
 * Static files (the Vite build in ./dist) are served by the assets binding; only /api/* runs here.
 */
interface Env {
  DB: D1;
  PHOTOS: KV;
  ASSETS: { fetch(request: Request): Promise<Response> };
  ADMIN_KEY: string;
  UPLOAD_PER_IP?: string;
  UPLOAD_WINDOW?: string;
  UPLOAD_PER_IP_DAY?: string;
  UPLOAD_GLOBAL_DAY?: string;
  MAX_STORE_BYTES?: string;
}
type D1Result<T = Record<string, unknown>> = { results: T[]; meta: { changes: number } };
type D1Stmt = { bind(...v: unknown[]): D1Stmt; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; run(): Promise<D1Result> };
type D1 = { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<D1Result[]> };
type KV = {
  get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  put(key: string, value: ArrayBuffer, options?: { metadata?: unknown }): Promise<void>;
};
type PhotoRef = { key: string; type: string; size: number };
type Point = { x: number; y: number; z: number; name?: string };
type Item = { id: string; title: string; story: string; date: string; point: Point; photo: PhotoRef };
type Row = { id: string; payload: string; revision: number; hidden: number };

class APIError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const now = () => new Date().toISOString();
const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

function text(value: unknown, limit: number, required = false): string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new APIError(400, 'Text is invalid or too long');
  return required ? value.trim() : value;
}
function point(p: unknown): Point {
  const o = p as Record<string, unknown>;
  if (!o || typeof o !== 'object' || !['x', 'y', 'z'].every(k => typeof o[k] === 'number' && Number.isFinite(o[k]) && Math.abs(o[k] as number) < 10000))
    throw new APIError(400, 'Invalid location coordinates');
  return { x: o.x as number, y: o.y as number, z: o.z as number, ...('name' in o ? { name: text(o.name, 120) } : {}) };
}
function date(value: unknown): string {
  const v = text(value ?? '', 10);
  if (v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new APIError(400, 'Invalid date');
  }
  return v;
}
/** Checks the file signature (not the client's claimed type) and stores the bytes in KV. */
async function storePhoto(env: Env, file: unknown): Promise<PhotoRef> {
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) throw new APIError(400, 'Invalid photo');
  const bytes = await (file as Blob).arrayBuffer();
  const h = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const type =
    h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff ? 'image/jpeg'
    : h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47 ? 'image/png'
    : String.fromCharCode(...h.slice(0, 4)) === 'RIFF' && String.fromCharCode(...h.slice(8, 12)) === 'WEBP' ? 'image/webp'
    : '';
  if (!type || bytes.byteLength <= 0 || bytes.byteLength > 8 * 1024 * 1024) throw new APIError(400, 'Only JPG, PNG and WebP images under 8 MB are accepted');
  const used = await env.DB.prepare('SELECT COALESCE(SUM(size),0) AS n FROM blobs').first<{ n: number }>();
  if ((used?.n ?? 0) + bytes.byteLength > num(env.MAX_STORE_BYTES, 950 * 1024 * 1024)) throw new APIError(507, 'Photo storage is full. Please contact an administrator.');
  const key = crypto.randomUUID();
  await env.PHOTOS.put(key, bytes, { metadata: { type } });
  await env.DB.prepare('INSERT INTO blobs VALUES(?,?,?,?)').bind(key, type, bytes.byteLength, now()).run();
  return { key, type, size: bytes.byteLength };
}
async function ipHash(request: Request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ust35-upload:' + ip));
  return [...new Uint8Array(digest).slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function checkUpload(env: Env, ip: string) {
  const t = Math.floor(Date.now() / 1000), day = t - 86400, win = t - num(env.UPLOAD_WINDOW, 600);
  await env.DB.prepare('DELETE FROM uploads WHERE ts<?').bind(day).run();
  const c = await env.DB.prepare('SELECT SUM(ip=? AND ts>=?) AS recent, SUM(ip=?) AS mine, COUNT(*) AS everyone FROM uploads').bind(ip, win, ip).first<{ recent: number | null; mine: number | null; everyone: number }>();
  if ((c?.recent ?? 0) >= num(env.UPLOAD_PER_IP, 20) || (c?.mine ?? 0) >= num(env.UPLOAD_PER_IP_DAY, 80)) throw new APIError(429, 'Too many uploads from your network. Please try again later.');
  // Workers KV free plan allows 1,000 writes per day; keep headroom for administrator photo replacements.
  if ((c?.everyone ?? 0) >= num(env.UPLOAD_GLOBAL_DAY, 800)) throw new APIError(429, 'The daily upload limit for the site has been reached. Please try again tomorrow.');
}
const photoUrl = (r: Row) => `/api/photos/${r.id}?v=${r.revision}`;
const blobUrl = (p: PhotoRef | string | undefined) => (typeof p === 'object' && p ? `/api/blobs/${p.key}` : p);
const parse = (r: Row) => JSON.parse(r.payload) as Item;
async function getMemory(env: Env, id: unknown): Promise<Row> {
  const r = typeof id === 'string' ? await env.DB.prepare('SELECT * FROM memories WHERE id=?').bind(id).first<Row>() : null;
  if (!r) throw new APIError(404, 'Photo not found');
  return r;
}
/** New revision + version row in one transaction, only if nobody changed the photo meanwhile. */
async function commitVersion(env: Env, r: Row, item: Item, hidden: number, action: string) {
  const rev = r.revision + 1, payload = JSON.stringify(item);
  const [update] = await env.DB.batch([
    env.DB.prepare('UPDATE memories SET payload=?,hidden=?,revision=? WHERE id=? AND revision=?').bind(payload, hidden, rev, r.id, r.revision),
    env.DB.prepare('INSERT INTO versions SELECT ?,?,?,?,?,? WHERE changes()=1').bind(r.id, rev, payload, hidden, now(), action),
  ]);
  if (update.meta.changes !== 1) throw new APIError(409, 'The version has changed. Please refresh.');
  return rev;
}
async function admin(env: Env, request: Request) {
  const given = new TextEncoder().encode(request.headers.get('Authorization') || '');
  const expected = new TextEncoder().encode('Bearer ' + (env.ADMIN_KEY || ''));
  const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean };
  if (!env.ADMIN_KEY || given.byteLength !== expected.byteLength || !subtle.timingSafeEqual(given, expected))
    throw new APIError(401, 'Invalid administrator key. Please sign in again.');
}
/** JSON body, or multipart with a "data" JSON field plus a "photo" file (photos are sent as raw bytes). */
async function body(request: Request): Promise<{ data: Record<string, unknown>; photo?: unknown }> {
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > 12 * 1024 * 1024) throw new APIError(413, 'Request exceeds the size limit');
  try {
    if ((request.headers.get('Content-Type') || '').startsWith('multipart/form-data')) {
      const form = await request.formData();
      const data = JSON.parse(String(form.get('data') ?? '{}'));
      if (!data || typeof data !== 'object') throw 0;
      return { data, photo: form.get('photo') };
    }
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw 0;
    return { data: data as Record<string, unknown> };
  } catch {
    throw new APIError(400, 'Invalid request format');
  }
}

async function handleGet(env: Env, request: Request, path: string): Promise<Response> {
  if (path === '/api/memories') {
    // List carries text + a photo URL only; images are fetched (and cached) one by one.
    const { results } = await env.DB.prepare('SELECT * FROM memories WHERE hidden=0 ORDER BY rowid DESC').all<Row>();
    return json(200, results.map(r => ({ ...parse(r), revision: r.revision, photo: photoUrl(r) })));
  }
  let m = /^\/api\/photos\/([0-9A-Za-z-]{1,64})$/.exec(path);
  if (m) {
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(request.url);
    if (hit) return hit;
    const r = await env.DB.prepare('SELECT * FROM memories WHERE id=? AND hidden=0').bind(m[1]).first<Row>();
    if (!r) throw new APIError(404, 'Photo not found');
    const ref = parse(r).photo;
    const response = await servePhoto(env, ref.key, ref.type, 'public, max-age=31536000, immutable');
    // Edge copy for a day keeps KV reads (100k/day free) low when many visitors load the same pins.
    const edge = new Response(response.clone().body, response);
    edge.headers.set('Cache-Control', 'public, max-age=86400');
    await cache.put(request.url, edge);
    return response;
  }
  // Content-addressed by an unguessable key; used by the moderation view, including hidden photos and old versions.
  m = /^\/api\/blobs\/([0-9a-f-]{36})$/.exec(path);
  if (m) {
    const b = await env.DB.prepare('SELECT type FROM blobs WHERE key=?').bind(m[1]).first<{ type: string }>();
    if (!b) throw new APIError(404, 'Photo not found');
    return servePhoto(env, m[1], b.type, 'private, max-age=86400');
  }
  if (path.startsWith('/api/admin/')) {
    await admin(env, request);
    if (path === '/api/admin/dashboard') {
      const memories = (await env.DB.prepare('SELECT * FROM memories ORDER BY rowid DESC').all<Row>()).results.map(r => ({ ...parse(r), photo: blobUrl(parse(r).photo), revision: r.revision, hidden: !!r.hidden }));
      const requests = (await env.DB.prepare('SELECT * FROM requests ORDER BY rowid DESC LIMIT 200').all<Record<string, unknown>>()).results.map(r => {
        const patch = JSON.parse(String(r.patch));
        return { ...r, patch: { ...patch, ...(patch.photo ? { photo: blobUrl(patch.photo) } : {}) } };
      });
      return json(200, { memories, requests });
    }
    m = /^\/api\/admin\/memories\/([^/]+)\/versions$/.exec(path);
    if (m) {
      await getMemory(env, m[1]);
      const { results } = await env.DB.prepare('SELECT * FROM versions WHERE memory_id=? ORDER BY revision DESC').bind(m[1]).all<Record<string, unknown>>();
      return json(200, results.map(v => {
        const payload = JSON.parse(String(v.payload));
        return { ...v, payload: { ...payload, photo: blobUrl(payload.photo) } };
      }));
    }
  }
  throw new APIError(404, 'Endpoint not found');
}
async function servePhoto(env: Env, key: string, type: string, cacheControl: string) {
  const stream = await env.PHOTOS.get(key, 'stream');
  if (!stream) throw new APIError(404, 'Photo not found');
  return new Response(stream, { headers: { 'Content-Type': type, 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' } });
}

async function handlePost(env: Env, request: Request, path: string): Promise<Response> {
  if (path.startsWith('/api/admin/')) await admin(env, request);
  if (path === '/api/modifications') throw new APIError(410, 'Visitor change requests are disabled. Please contact an administrator.');
  const { data: d, photo } = await body(request);
  if (path === '/api/memories') {
    const fields = { title: text(d.title, 80, true), story: text(d.story ?? '', 2000), date: date(d.date), point: point(d.point) };
    const ip = await ipHash(request);
    await checkUpload(env, ip);
    const item: Item = { id: crypto.randomUUID(), ...fields, photo: await storePhoto(env, photo) };
    const payload = JSON.stringify(item);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO memories(id,payload,revision,hidden) VALUES(?,?,1,0)').bind(item.id, payload),
      env.DB.prepare("INSERT INTO versions VALUES(?,1,?,0,?,'created')").bind(item.id, payload, now()),
      env.DB.prepare('INSERT INTO uploads VALUES(?,?)').bind(ip, Math.floor(Date.now() / 1000)),
    ]);
    return json(201, { id: item.id, revision: 1 });
  }
  if (path === '/api/admin/edit') {
    // Direct administrator edit: one new revision, previous content kept in versions.
    const r = await getMemory(env, d.memory_id);
    if (d.revision !== r.revision) throw new APIError(409, 'The version has changed. Please refresh.');
    const kind = d.kind, patch = (d.patch ?? {}) as Record<string, unknown>, item = parse(r);
    if (kind === 'edit') {
      const keys = Object.keys(patch);
      if (!keys.length || keys.some(k => !['title', 'story', 'date'].includes(k))) throw new APIError(400, 'A text edit cannot change the image or location');
      if ('title' in patch) item.title = text(patch.title, 80, true);
      if ('story' in patch) item.story = text(patch.story, 2000);
      if ('date' in patch) item.date = date(patch.date);
    } else if (kind === 'replace') item.photo = await storePhoto(env, photo);
    else if (kind === 'move') item.point = point(patch.point);
    else if (kind !== 'hide') throw new APIError(400, 'Invalid change type');
    const rev = await commitVersion(env, r, item, kind === 'hide' ? 1 : r.hidden, 'admin-edit:' + kind);
    return json(200, { ok: true, revision: rev });
  }
  if (path === '/api/admin/review') {
    const req = await env.DB.prepare('SELECT * FROM requests WHERE id=?').bind(String(d.request_id ?? '')).first<Record<string, unknown>>();
    if (!req) throw new APIError(404, 'Request not found');
    if (req.status !== 'pending') throw new APIError(409, 'This request has already been reviewed');
    const decision = d.decision, note = text(d.note ?? '', 1000);
    if (decision !== 'approve' && decision !== 'reject') throw new APIError(400, 'Invalid review decision');
    if (decision === 'approve') {
      const r = await getMemory(env, req.memory_id);
      if (r.revision !== req.base_revision) throw new APIError(409, 'The current version has changed. Reject this stale request and submit a new one to avoid overwriting changes.');
      await commitVersion(env, r, { ...parse(r), ...JSON.parse(String(req.patch)) }, req.kind === 'hide' ? 1 : r.hidden, 'approved:' + req.id);
    }
    await env.DB.prepare('UPDATE requests SET status=?,reviewed=?,note=? WHERE id=?').bind(decision === 'approve' ? 'approved' : 'rejected', now(), note, req.id).run();
    return json(200, { ok: true });
  }
  if (path === '/api/admin/visibility') {
    const r = await getMemory(env, d.memory_id);
    if (d.revision !== r.revision) throw new APIError(409, 'The version has changed. Please refresh.');
    if (typeof d.hidden !== 'boolean') throw new APIError(400, 'Invalid visibility status');
    if (!!r.hidden === d.hidden) throw new APIError(409, 'The status is unchanged');
    await commitVersion(env, r, parse(r), d.hidden ? 1 : 0, d.hidden ? 'admin-hide' : 'admin-restore');
    return json(200, { ok: true });
  }
  if (path === '/api/admin/rollback') {
    const r = await getMemory(env, d.memory_id);
    if (d.revision !== r.revision) throw new APIError(409, 'The version has changed. Please refresh.');
    const old = await env.DB.prepare('SELECT * FROM versions WHERE memory_id=? AND revision=?').bind(r.id, d.target_revision ?? -1).first<{ payload: string; revision: number }>();
    if (!old) throw new APIError(404, 'Version not found');
    // Content rollback preserves current visibility; restoring hidden photos is a separate action.
    await commitVersion(env, r, JSON.parse(old.payload), r.hidden, 'rollback:' + old.revision);
    return json(200, { ok: true });
  }
  throw new APIError(404, 'Endpoint not found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.method === 'GET' || request.method === 'HEAD') return await handleGet(env, request, path);
      if (request.method === 'POST') return await handlePost(env, request, path);
      return json(405, { error: 'Method not allowed' });
    } catch (e) {
      if (e instanceof APIError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Something went wrong. Please try again.' });
    }
  },
};
