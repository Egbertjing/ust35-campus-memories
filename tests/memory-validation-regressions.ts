import assert from 'node:assert/strict';
import {validMemoryDate,validatePhoto} from '../lib/memory-validation';
for(const date of ['', '2024-02-29','2000-02-29','2026-11-24','0001-01-01'])assert.ok(validMemoryDate(date),date);
for(const date of ['2026-02-29','1900-02-29','2026-04-31','0000-01-01','2026-13-01','2026-01-00','2026-1-01','not-a-date'])assert.equal(validMemoryDate(date),false,date);
assert.equal(validatePhoto({type:'image/png',size:8*1024*1024}),null);
assert.ok(validatePhoto({type:'image/png',size:8*1024*1024+1}));
assert.ok(validatePhoto({type:'image/svg+xml',size:42}));
assert.ok(validatePhoto({type:'image/png',size:0}));
console.log('PASS: real calendar dates, leap years, MIME types, empty files and upload-size boundaries');
