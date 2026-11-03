import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchDestination } from '../src/lib/search'

test('searches only on submission and encodes queries for the selected engine', () => {
  assert.equal(searchDestination(' hello & world ', 'duckduckgo'), 'https://duckduckgo.com/?q=hello%20%26%20world')
  assert.equal(searchDestination('hello', 'bing'), 'https://www.bing.com/search?q=hello')
  assert.equal(searchDestination('  ', 'google'), null)
})

test('navigates to ordinary web addresses and treats unsafe or malformed inputs as searches', () => {
  assert.equal(searchDestination('example.com/path?q=1', 'google'), 'https://example.com/path?q=1')
  assert.equal(searchDestination('http://localhost:3000', 'google'), 'http://localhost:3000/')
  assert.equal(searchDestination('javascript:alert(1)', 'google'), 'https://www.google.com/search?q=javascript%3Aalert(1)')
  assert.equal(searchDestination('https://', 'google'), 'https://www.google.com/search?q=https%3A%2F%2F')
  assert.equal(searchDestination('https://user:pass@example.com', 'google'), 'https://www.google.com/search?q=https%3A%2F%2Fuser%3Apass%40example.com')
})
