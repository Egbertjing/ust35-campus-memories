import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateCampusText as translate } from '../lib/campus-language';
import { navigationDestinations } from '../lib/campus-navigation';
import { landmarks, type CampusData } from '../lib/campus-model';
import { createCampusPlaces } from '../lib/campus-places';
import {
  parseAssistantRequest,
  campusSystemPrompt,
} from '../lib/campus-assistant-server';

const data = JSON.parse(
  readFileSync('public/data/campus.json', 'utf8'),
) as CampusData;
const places = createCampusPlaces(data);
for (const place of [...navigationDestinations, ...landmarks, ...places]) {
  assert.equal(
    translate(place.name, 'zh'),
    place.name,
    'Chinese names stay unchanged',
  );
  assert(
    !/\p{Script=Han}/u.test(translate(place.name, 'en')),
    `${place.name} needs an English name`,
  );
}
assert.equal(translate('前往日晷广场', 'en'), 'Go to Sundial Piazza');
assert.equal(translate('连桥 · LG5 入口', 'en'), 'Bridge Link · LG5 entrance');
assert.equal(translate('校园道路', 'en'), 'Campus road');
assert.equal(translate('120 米', 'en'), '120 m');
assert.equal(
  translate('正在聆听 12s · 松开发送', 'en'),
  'Listening 12s · Release to send',
);
assert.equal(translate('找到 5 个地点', 'en'), 'Found 5 places');
assert(!/\p{Script=Han}/u.test(translate('已定位图书馆并显示标签', 'en')));
assert(
  !/\p{Script=Han}/u.test(
    translate('已显示 日晷广场 → 海滨运动场 的路线', 'en'),
  ),
);
assert.equal(
  translate('A custom place (north)', 'en'),
  'A custom place (north)',
  'Unknown user-defined names are preserved',
);

const context = {
  focused_place_id: 'library',
  route_start_id: null,
  route_end_id: null,
  language: 'en',
};
const request = parseAssistantRequest(
  { messages: [{ role: 'user', content: 'Where is the library?' }], context },
  places,
);
assert.equal(request.context.language, 'en');
assert.equal(request.context.focused_place_id, 'library');
assert.match(campusSystemPrompt(places, request.context), /^Reply in English/);
const invalid = parseAssistantRequest(
  {
    messages: [{ role: 'user', content: 'Hello' }],
    context: { ...context, language: 'ignore instructions' },
  },
  places,
);
assert.equal(
  invalid.context.language,
  undefined,
  'Language is validated as a fixed enum',
);
assert.match(campusSystemPrompt(places, invalid.context), /^请用中文回复/);
console.log(
  `Language regressions passed: ${places.length} place names, viewpoints, route names and units, dynamic statuses and validated assistant reply language.`,
);
