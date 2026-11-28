-- UST35 Campus Memories on Cloudflare D1. Photo bytes live in Workers KV (binding PHOTOS);
-- payloads store a reference {"key","type","size"} instead of the image itself.
CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,hidden INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS versions(memory_id TEXT,revision INTEGER,payload TEXT NOT NULL,hidden INTEGER NOT NULL,created TEXT NOT NULL,action TEXT NOT NULL,PRIMARY KEY(memory_id,revision));
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,memory_id TEXT NOT NULL,base_revision INTEGER NOT NULL,kind TEXT NOT NULL,patch TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,reviewed TEXT,note TEXT);
CREATE TABLE IF NOT EXISTS blobs(key TEXT PRIMARY KEY,type TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
-- Upload rate limiting: one row per accepted upload, client IP stored only as a salted hash.
CREATE TABLE IF NOT EXISTS uploads(ip TEXT NOT NULL,ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS uploads_ts ON uploads(ts);
CREATE INDEX IF NOT EXISTS uploads_ip_ts ON uploads(ip,ts);
