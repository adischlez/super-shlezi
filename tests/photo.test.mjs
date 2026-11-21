import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParsed, hebrewAiError, quotaKey, DAILY_LIMIT } from '../photo.js';

test('normalize parsed items', () => {
  const items = normalizeParsed({ items: [
    { name: '  חלב 3%  ', qty: 2, dept: 'dairy', unclear: false },
    { name: 'עגבניות', qty: 0, dept: 'nope', unclear: true, note: 'עגנ' },
    { name: '  ', qty: 1, dept: 'produce' },
    { name: 'ספריי ניקוי', qty: 1.4, dept: 'cleaning' },
  ]});
  assert.equal(items.length, 3);
  assert.equal(items[0].name, 'חלב 3%'); assert.equal(items[0].qty, 2); assert.equal(items[0].dept, 'dairy');
  assert.equal(items[1].dept, 'produce'); assert.equal(items[1].unclear, true); assert.equal(items[1].qty, 1);
  assert.equal(items[2].qty, 1);
});
test('hebrew errors', () => {
  assert.match(hebrewAiError({ message: 'PERMISSION_DENIED' }).title, /לא זמינה|הרשאה|עדיין/);
  assert.match(hebrewAiError(null, 'quota').body, new RegExp(String(DAILY_LIMIT)));
  assert.match(hebrewAiError({ message: 'Failed to fetch' }).title, /רשת/);
  assert.match(hebrewAiError({ code: 'AI/fetch-error', message: 'Firebase AI Logic genai config not found' }).title, /עדיין לא זמינה/);
});
test('quota key is a date', () => {
  assert.match(quotaKey(new Date('2026-11-21T20:00:00+02:00')), /^ss:ai-quota:\d{4}-\d{2}-\d{2}$/);
});
