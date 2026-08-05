import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateStats, getStatusGroup, normalizeBoolean } from './candidateHelpers.js';

test('normalizeBoolean handles 0/1 and true/false values', () => {
  assert.equal(normalizeBoolean(true), true);
  assert.equal(normalizeBoolean(false), false);
  assert.equal(normalizeBoolean(1), true);
  assert.equal(normalizeBoolean(0), false);
  assert.equal(normalizeBoolean('true'), true);
  assert.equal(normalizeBoolean('false'), false);
});

test('getStatusGroup treats missing or lowercase status as pending', () => {
  assert.equal(getStatusGroup(null), 'pending');
  assert.equal(getStatusGroup(''), 'pending');
  assert.equal(getStatusGroup('pending'), 'pending');
  assert.equal(getStatusGroup('Shortlisted'), 'shortlisted');
  assert.equal(getStatusGroup('Rejected'), 'rejected');
});

test('calculateStats treats missing or lowercase status as pending', () => {
  const stats = calculateStats([
    { id: 1, application_status: null },
    { id: 2, application_status: '' },
    { id: 3, application_status: 'pending' },
    { id: 4, application_status: 'Shortlisted' },
    { id: 5, application_status: 'Rejected' },
  ]);

  assert.equal(stats.total, 5);
  assert.equal(stats.pending, 3);
  assert.equal(stats.shortlisted, 1);
  assert.equal(stats.rejected, 1);
});
