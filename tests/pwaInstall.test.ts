import assert from 'node:assert/strict'
import test from 'node:test'
import { getInstallPlatform } from '../src/pwaInstall.ts'

const baseEnvironment = {
  userAgent: 'Mozilla/5.0',
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  displayStandalone: false,
}

test('recognises an already installed standalone app', () => {
  assert.equal(
    getInstallPlatform({ ...baseEnvironment, displayStandalone: true }),
    'installed',
  )
})

test('recognises iPhone, iPadOS and Android install instructions', () => {
  assert.equal(
    getInstallPlatform({
      ...baseEnvironment,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
    }),
    'ios',
  )

  assert.equal(
    getInstallPlatform({
      ...baseEnvironment,
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }),
    'ios',
  )

  assert.equal(
    getInstallPlatform({
      ...baseEnvironment,
      userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)',
    }),
    'android',
  )
})

test('falls back to general instructions on desktop browsers', () => {
  assert.equal(getInstallPlatform(baseEnvironment), 'other')
})
