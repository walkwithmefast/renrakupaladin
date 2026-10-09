import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, dataMod } from './helpers.mjs';

const { newCharacter, derive } = engine;
const { describeItem } = await import('../src/engine/describe.js');
const { idx } = dataMod;

const have = globalThis.SR5TEXT && Object.keys(globalThis.SR5TEXT).length > 0;
const skip = !have && 'no rulebook excerpts built on this machine (run tools/extract_text.py)';

test('a quality carries its rulebook wording and the page it was found on', { skip }, () => {
  const q = idx('qualities', 'qualities').list.find((x) => x.name === 'Analytical Mind' && x.source === 'SR5');
  const info = describeItem('qualities', q, null, derive(newCharacter()));
  assert.ok(info.excerpt, 'has an excerpt');
  assert.match(info.excerpt.text, /^Analytical Mind describes the uncanny ability/);
  assert.doesNotMatch(info.excerpt.text, /^Cost:/);       // metadata lines are not part of the quote
  assert.equal(info.excerpt.source, 'SR5');
  assert.equal(String(info.excerpt.page), q.page);        // the data's page is the page the entry was found on
});

test('spells, programs and lifestyles get clean text (no subtitles, footers or hyphen breaks)', { skip }, () => {
  const d = derive(newCharacter());
  const ex = (file, sec, name) => describeItem(file, idx(...sec).list.find((x) => x.name === name && x.source === 'SR5'), null, d).excerpt;
  const fire = ex('spells', ['spells', 'spells'], 'Fireball');
  assert.match(fire.text, /^These spells create an explosion of flames/);
  assert.doesNotMatch(fire.text, />>|Indirect, Elemental/);
  const hammer = ex('gear', ['gear', 'gears'], 'Hammer');
  assert.match(hammer.text, /Matrix damage/i);
  const squat = ex('lifestyles', ['lifestyles', 'lifestyles'], 'Squatter');
  assert.match(squat.text, /^Life stinks for the squatter/);
});

test('every excerpt is a bounded quote with a page', { skip }, () => {
  for (const [id, [text, page]] of Object.entries(globalThis.SR5TEXT)) {
    assert.ok(text.length >= 40 && text.length <= 1100, `${id}: ${text.length} chars`);
    assert.ok(Number.isInteger(page) && page > 0, `${id}: page`);
    assert.ok(!text.includes('\u0000'), `${id}: clean`);
  }
});
