import test from 'node:test';
import assert from 'node:assert/strict';
import { merge } from '../cloud-sync.js';
import { occurrence, streak } from '../app/model.js';

test('recurring month-end payments keep their original billing day', () => {
  const item = { kind: 'subscription', date: '2024-01-31', repeat: 'monthly' };
  assert.equal(occurrence(item, '2024-02-01'), '2024-02-29');
  assert.equal(occurrence(item, '2024-03-01'), '2024-03-31');
  assert.equal(occurrence({ kind: 'birthday', date: '2000-02-29' }, '2025-02-01'), '2025-02-28');
});

test('current streak can continue until the end of the current day', () => {
  assert.equal(streak(['2025-01-01', '2025-01-02', '2025-01-02'], '2025-01-03'), 2);
  assert.equal(streak(['2025-01-02'], '2025-01-04'), 0);
});

test('independent record edits survive sync and confirmed deletions stay deleted', () => {
  const base = [{ id: 'a', title: 'Old' }, { id: 'b', title: 'Delete' }];
  const local = [{ id: 'a', title: 'Updated' }];
  const remote = [...base, { id: 'c', title: 'New' }];
  assert.deepEqual(merge(base, local, remote), [...local, remote[2]]);
});

test('independent habit dates merge across devices', () => {
  assert.deepEqual(merge(['2025-01-01'], ['2025-01-01', '2025-01-02'], ['2025-01-03']),
    ['2025-01-02', '2025-01-03']);
});

test('metadata object merge only uses own keys', () => {
  const local = JSON.parse('{"__proto__":{"flag":true}}');
  const result = merge({}, local, { other: 3 });
  assert.equal(Object.getPrototypeOf(result), null);
  assert.equal(result.__proto__.flag, true);
  assert.equal({}.flag, undefined);
});
