import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantMarkdown } from '../components/assistant-markdown';

const render = (content: string) =>
  renderToStaticMarkup(createElement(AssistantMarkdown, { content }));
const routeReply = `The route is now displayed in the 3D scene: **Sundial Piazza → Waterfront Sports Ground**, about **669 m, roughly 12 minutes** on foot.

The path involves several level changes, so here's the sequence:

1. **Sundial Piazza · Atrium passageway** (81 m walk)
2. **Atrium lift** — down to LG5
   - Follow signs for the bridge.
3. **Waterfront Sports Ground**

> Entrances and travel times are model estimates.`;
const html = render(routeReply);
assert.match(
  html,
  /<strong>Sundial Piazza → Waterfront Sports Ground<\/strong>/,
);
assert.match(html, /<strong>669 m, roughly 12 minutes<\/strong>/);
assert.match(html, /<ol>/);
assert.match(html, /<ul>/);
assert.match(html, /<blockquote>/);
assert.equal(
  (html.match(/<p>/g) ?? []).length,
  3,
  'Paragraphs and blockquotes have semantic blocks',
);
assert(
  !html.includes('**'),
  'Markdown emphasis must not appear as literal asterisks',
);

const rich = render(
  '## 校园路线\n\n`LG5` → **连桥**\n\n| 地点 | 距离 |\n| --- | ---: |\n| 日晷 | 81 m |\n\n- [x] 已到达\n- [ ] 下一站\n\n~~旧路线~~\n\n[校园地图](https://mtpc.hkust.edu.hk/resources/maps)\n\n```js\nconst direction = "<north>";\n```',
);
assert.match(rich, /<h2>校园路线<\/h2>/);
assert.match(rich, /<code>LG5<\/code>/);
assert.match(rich, /assistant-markdown-table/);
assert.match(rich, /<table>/);
assert.match(rich, /type="checkbox"/);
assert.match(rich, /<del>旧路线<\/del>/);
assert.match(rich, /target="_blank" rel="noopener noreferrer"/);
assert.match(rich, /<pre><code class="language-js">/);
assert.match(rich, /&lt;north&gt;/);

const unsafe = render(
  '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[bad](javascript:alert(1))\n\n**Still formatted**',
);
assert(
  !/<script|onerror=|javascript:/i.test(unsafe),
  'Raw HTML and unsafe URLs are not executable',
);
assert.match(unsafe, /<strong>Still formatted<\/strong>/);
const plain = render('科大校园 / HKUST\n\n中文和 English 都能正常阅读。');
assert.match(plain, /中文和 English/);
console.log(
  'Markdown regressions passed: screenshot reply, paragraphs, emphasis, nested lists, tables, task lists, code, links, bilingual text and untrusted markup.',
);
