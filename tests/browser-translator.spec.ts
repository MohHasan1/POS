import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  type BrowserTranslatorFactory,
  downloadEnglishTranslation,
  getEnglishTranslationAvailability,
  ProductTranslationError,
  shouldAutoTranslateProductName,
  translateEnglishProductName,
} from '@/services/browser-translator'

const originalTranslator = Object.getOwnPropertyDescriptor(globalThis, 'Translator')

function setTranslator(factory?: BrowserTranslatorFactory) {
  if (!factory) {
    Reflect.deleteProperty(globalThis, 'Translator')
    return
  }

  Object.defineProperty(globalThis, 'Translator', {
    configurable: true,
    value: factory,
  })
}

afterEach(() => {
  if (originalTranslator) {
    Object.defineProperty(globalThis, 'Translator', originalTranslator)
  } else {
    Reflect.deleteProperty(globalThis, 'Translator')
  }
})

describe('browser product translation', () => {
  it('translates English product names into Arabic and Bangla', async () => {
    const requests: string[] = []
    setTranslator({
      availability: async () => 'available',
      create: async ({ targetLanguage }) => ({
        translate: async (text) => {
          requests.push(`${targetLanguage}:${text}`)
          return targetLanguage === 'ar' ? 'زيت الطبخ' : 'রান্নার তেল'
        },
      }),
    })

    assert.equal(await translateEnglishProductName(' Cooking Oil ', 'ar'), 'زيت الطبخ')
    assert.equal(await translateEnglishProductName('Cooking Oil', 'bn'), 'রান্নার তেল')
    assert.deepEqual(requests, ['ar:Cooking Oil', 'bn:Cooking Oil'])
  })

  it('reports unsupported browsers and language pairs as unavailable', async () => {
    setTranslator()
    assert.equal(await getEnglishTranslationAvailability('ar'), 'unavailable')
    await assert.rejects(
      translateEnglishProductName('Cooking Oil', 'ar'),
      (error) => error instanceof ProductTranslationError && error.code === 'unavailable',
    )
  })

  it('downloads a missing language model and reports progress', async () => {
    const progress: number[] = []
    let destroyed = false
    setTranslator({
      availability: async () => 'downloadable',
      create: async ({ monitor }) => {
        monitor?.({
          addEventListener: (_type, listener) => {
            listener({ loaded: 0.4 })
            listener({ loaded: 1 })
          },
        })
        return {
          destroy: () => {
            destroyed = true
          },
          translate: async (text) => text,
        }
      },
    })

    await downloadEnglishTranslation('bn', (loaded) => progress.push(loaded))
    assert.deepEqual(progress, [0.4, 1])
    assert.equal(destroyed, true)
  })

  it('rejects an empty English product name before creating a translator', async () => {
    let created = false
    setTranslator({
      availability: async () => 'available',
      create: async () => {
        created = true
        return { translate: async (text) => text }
      },
    })

    await assert.rejects(
      translateEnglishProductName('   ', 'ar'),
      (error) => error instanceof ProductTranslationError && error.code === 'empty',
    )
    assert.equal(created, false)
  })

  it('normalizes failed translation attempts', async () => {
    let destroyed = false
    setTranslator({
      availability: async () => 'available',
      create: async () => ({
        destroy: () => {
          destroyed = true
        },
        translate: async () => {
          throw new Error('model failed')
        },
      }),
    })

    await assert.rejects(
      translateEnglishProductName('Cooking Oil', 'ar'),
      (error) => error instanceof ProductTranslationError && error.code === 'failed',
    )
    assert.equal(destroyed, true)
  })

  it('only auto-translates blank names so manual edits are preserved', () => {
    assert.equal(shouldAutoTranslateProductName(''), true)
    assert.equal(shouldAutoTranslateProductName('   '), true)
    assert.equal(shouldAutoTranslateProductName('زيت طبخ معدل'), false)
    assert.equal(shouldAutoTranslateProductName('সম্পাদিত নাম'), false)
  })
})
