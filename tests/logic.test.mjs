import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListText, suggestDept, parseReceipt, compareReceipt, seedItems, nameScore, RECEIPT_EXAMPLE, normalize } from '../logic.js';

test('parse list text with quantities', () => {
  const r = parseListText('קוטג׳ ×5\nקוטג׳ - 5\n- חלב\n2x ביצים\n\nפירות וירקות');
  assert.deepEqual(r.map(x => [x.name, x.qty]), [['קוטג׳', 5], ['קוטג׳', 5], ['חלב', 1], ['ביצים', 2], ['פירות וירקות', 1]]);
});
test('dept suggestion', () => {
  assert.equal(suggestDept('חלב 3%'), 'dairy');
  assert.equal(suggestDept('עגבניות שרי'), 'produce');
  assert.equal(suggestDept('ספריי ניקוי כללי'), 'cleaning');
  assert.equal(suggestDept('נקניק פרוס דק דק'), 'deli');
  assert.equal(suggestDept('משהו לא ידוע'), 'other');
});
test('normalize & fuzzy', () => {
  assert.equal(normalize('קוטג׳'), 'קוטג');
  assert.ok(nameScore('ביצים', 'ביצה L 12') >= 0.5);
  assert.ok(nameScore('קוטג׳', 'קוטג 5% תנובה') >= 0.5);
  assert.equal(nameScore('חלב', 'במבה אסם'), 0);
});
test('receipt parse text/json', () => {
  const r = parseReceipt(RECEIPT_EXAMPLE);
  assert.equal(r.store, 'רמי לוי'); assert.equal(r.total, 85.1); assert.equal(r.lines.length, 5);
  assert.equal(r.lines[2].qty, 5); assert.equal(r.lines[2].price, 35);
  const j = parseReceipt('{"total":10,"lines":[{"name":"חלב","qty":2,"price":12.5,"barcode":"7290000000001"}]}');
  assert.equal(j.lines[0].barcode, '7290000000001'); assert.equal(j.total, 10);
  const f = parseReceipt('קוטג 5% 5x 35.00\nחלב 6.90\nהנחה מבצע -3.00\nסה"כ 38.90');
  assert.equal(f.lines[0].qty, 5); assert.equal(f.lines[0].price, 35); assert.equal(f.lines[1].price, 6.9); assert.ok(f.lines[2].discount);
});
test('compare seed list to receipt', () => {
  const snap = seedItems().map(i => ({ id: i.id, name: i.name, qty: i.qty, cart: i.name !== 'דגנה בר' && i.name !== 'עוגיות חיוכים' }));
  const rc = parseReceipt(RECEIPT_EXAMPLE);
  const res = compareReceipt(snap, rc);
  const mnames = res.matched.map(m => m.item.name).sort();
  assert.deepEqual(mnames, ['ביצים', 'חלב', 'נקניק פרוס דק דק', 'קוטג׳'].sort());
  assert.ok(res.extra.some(l => l.name.includes('במבה')));
  assert.ok(res.missing.some(m => m.name === 'פירות וירקות'));
  assert.ok(res.missingInCart.some(m => m.name === 'טחינה הר ברכה'));
  assert.ok(!res.missingNotInCart.some(m => m.name === 'טחינה הר ברכה'));
  assert.equal(res.matched.find(m => m.item.name === 'קוטג׳').qtyStatus, 'ok');
  assert.equal(res.totals.receipt, 85.1);
});
test('manual match and barcode alias', () => {
  const snap = [{ id: 'a', name: 'פירות וירקות', qty: 1, cart: true }, { id: 'b', name: 'מילקי טופ', qty: 1, cart: true }];
  const rc = parseReceipt('עגבניות 8.9\nמשהו 7290011 | 1 | 5.9');
  const res = compareReceipt(snap, rc, { manual: { 0: 'a' } });
  assert.equal(res.matched.length, 1);
  const rc2 = { lines: [{ name: 'קינדר 1234', qty: 1, price: 5, barcode: '7290000000009' }] };
  const res2 = compareReceipt(snap, rc2, { barcodes: { '7290000000009': { name: 'קינדר', listName: 'מילקי טופ' } } });
  assert.equal(res2.matched[0].item.id, 'b');
});
