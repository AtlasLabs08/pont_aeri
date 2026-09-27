/* Proves de src/app/bus.js (tasca C2).
 *
 * Correr:  npm test
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, on, off, emit, _resetBus } from '../../src/app/bus.js';

afterEach(() => { _resetBus(); });

describe('bus', () => {
  test('TOPICS conte els cinc temes i esta congelat', () => {
    assert.deepEqual(TOPICS, [
      'career:changed', 'flight:finished', 'dispatch:resolved', 'rank:up', 'save:error'
    ]);
    assert.ok(Object.isFrozen(TOPICS));
  });

  test('on amb un tema desconegut llanca', () => {
    assert.throws(() => on('no-existeix', () => {}), /no-existeix/);
  });

  test('emit amb un tema desconegut llanca', () => {
    assert.throws(() => emit('no-existeix', {}), /no-existeix/);
  });

  test('emit crida els subscriptors amb el payload', () => {
    const rebuts = [];
    on('rank:up', p => rebuts.push(p));
    emit('rank:up', { rank: 'private' });
    assert.deepEqual(rebuts, [{ rank: 'private' }]);
  });

  test('emit sense subscriptors no fa res ni llanca', () => {
    assert.doesNotThrow(() => emit('rank:up', {}));
  });

  test('un subscriptor que llanca no bloqueja els altres, i emit no llanca', () => {
    const rebuts = [];
    const originalError = console.error;
    let logged = 0;
    console.error = () => { logged++; };
    try {
      on('save:error', () => { throw new Error('trencat'); });
      on('save:error', p => rebuts.push(p));
      assert.doesNotThrow(() => emit('save:error', { reason: 'invalid' }));
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(rebuts, [{ reason: 'invalid' }]);
    assert.equal(logged, 1);
  });

  test('off treu la funcio i deixa de rebre', () => {
    const rebuts = [];
    const fn = p => rebuts.push(p);
    on('career:changed', fn);
    off('career:changed', fn);
    emit('career:changed', { a: 1 });
    assert.deepEqual(rebuts, []);
  });

  test('off d una funcio no subscrita no fa res', () => {
    assert.doesNotThrow(() => off('career:changed', () => {}));
  });

  test('_resetBus buida tots els subscriptors', () => {
    const rebuts = [];
    on('rank:up', p => rebuts.push(p));
    _resetBus();
    emit('rank:up', { rank: 'captain' });
    assert.deepEqual(rebuts, []);
  });
});
