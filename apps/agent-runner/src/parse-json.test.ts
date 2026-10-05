import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonOutput } from './kimi';

test('parses a JSON object surrounded by model prose', () => {
  assert.deepEqual(parseJsonOutput('Here is the result:\n{"ok":true}\nDone.'), {
    ok: true,
  });
});

test('parses the first complete JSON value without joining later values', () => {
  assert.deepEqual(parseJsonOutput('{"items":[{"name":"A"}]}\n{"ignored":true}'), {
    items: [{ name: 'A' }],
  });
});

test('parses a JSON array with nested strings and braces', () => {
  assert.deepEqual(
    parseJsonOutput('```json\n[{"note":"brace } and bracket ] in text"}]\n```'),
    [{ note: 'brace } and bracket ] in text' }],
  );
});
