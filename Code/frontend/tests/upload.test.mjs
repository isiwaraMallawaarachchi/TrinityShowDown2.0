import assert from 'node:assert/strict';
import test from 'node:test';
import { submitRegistration } from '../src/shared/api.js';

function simulateUploads(t, outcomes) {
  const sent = [];
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class {
    upload = {};

    open(method, url) {
      assert.equal(method, 'POST');
      assert.equal(url, '/api/public/registrations/clash-of-clans');
    }

    send(data) {
      const outcome = outcomes[sent.length];
      sent.push(data);
      queueMicrotask(() => {
        this.upload.onprogress({ loaded: 5, total: 10, lengthComputable: true });
        this.status = outcome.status;
        this.response = outcome.body;
        if (this.status === 0) this.onerror();
        else {
          this.upload.onload();
          this.onload();
        }
      });
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = previous;
  });
  return sent;
}

test('an interrupted upload retries the same submission with every attachment', async t => {
  const sent = simulateUploads(t, [{ status: 0 }, { status: 201, body: { reference: 'registration-reference' } }]);
  const statuses = [];
  const data = new FormData();
  data.set('requestId', '36fb33d4-4b72-4217-96d0-17c80477f4cc');
  for (let index = 0; index < 13; index++) data.set('image-' + index, new File(['synthetic'], 'test.jpg'));
  const receipt = await submitRegistration('clash-of-clans', data, {
    signal: new AbortController().signal, onStatus: (status) => statuses.push(status),
  });
  assert.equal(receipt.reference, 'registration-reference');
  assert.equal(sent.length, 2);
  assert.ok(sent.every(body => body === data));
  assert.ok(statuses.some(status => status.includes('50%')));
  assert.ok(statuses.some(status => status.includes('Retrying')));
});

test('a validation error displays the server message without reuploading', async t => {
  const sent = simulateUploads(t, [{ status: 400, body: { error: 'Attach proof of payment.' } }]);
  await assert.rejects(submitRegistration('clash-of-clans', new FormData(), {
    signal: new AbortController().signal, onStatus() {},
  }), { message: 'Attach proof of payment.' });
  assert.equal(sent.length, 1);
});
