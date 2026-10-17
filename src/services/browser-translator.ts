export type TranslationAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'

export type ProductTranslationErrorCode = 'empty' | 'failed' | 'unavailable'

export type TranslationTarget = 'ar' | 'bn'

type LanguagePair = {
  sourceLanguage: 'en'
  targetLanguage: TranslationTarget
}

type DownloadProgressEvent = {
  loaded: number
}

type DownloadMonitor = {
  addEventListener: (
    type: 'downloadprogress',
    listener: (event: DownloadProgressEvent) => void,
  ) => void
}

type TranslatorCreateOptions = LanguagePair & {
  monitor?: (monitor: DownloadMonitor) => void
}

type BrowserTranslator = {
  destroy?: () => void
  translate: (text: string) => Promise<string>
}

export type BrowserTranslatorFactory = {
  availability: (options: LanguagePair) => Promise<TranslationAvailability>
  create: (options: TranslatorCreateOptions) => Promise<BrowserTranslator>
}

type TranslationProgressHandler = (progress: number) => void

const languagePairs: Record<TranslationTarget, LanguagePair> = {
  ar: { sourceLanguage: 'en', targetLanguage: 'ar' },
  bn: { sourceLanguage: 'en', targetLanguage: 'bn' },
}

export class ProductTranslationError extends Error {
  constructor(readonly code: ProductTranslationErrorCode) {
    super(code)
    this.name = 'ProductTranslationError'
  }
}

function getTranslatorFactory(): BrowserTranslatorFactory | null {
  const translator = (globalThis as typeof globalThis & {
    Translator?: BrowserTranslatorFactory
  }).Translator

  if (
    !translator ||
    typeof translator.availability !== 'function' ||
    typeof translator.create !== 'function'
  ) {
    return null
  }

  return translator
}

function destroyTranslator(translator: BrowserTranslator) {
  try {
    translator.destroy?.()
  } catch {}
}

async function createEnglishTranslator(
  targetLanguage: TranslationTarget,
  onProgress?: TranslationProgressHandler,
): Promise<BrowserTranslator> {
  const factory = getTranslatorFactory()
  if (!factory) throw new ProductTranslationError('unavailable')

  let availability: TranslationAvailability
  try {
    availability = await factory.availability(languagePairs[targetLanguage])
  } catch {
    throw new ProductTranslationError('failed')
  }

  if (availability === 'unavailable') {
    throw new ProductTranslationError('unavailable')
  }

  try {
    return await factory.create({
      ...languagePairs[targetLanguage],
      monitor: onProgress
        ? (monitor) => {
            monitor.addEventListener('downloadprogress', (event) => {
              onProgress(Math.min(1, Math.max(0, event.loaded)))
            })
          }
        : undefined,
    })
  } catch {
    throw new ProductTranslationError('failed')
  }
}

export async function getEnglishTranslationAvailability(
  targetLanguage: TranslationTarget,
): Promise<TranslationAvailability> {
  const factory = getTranslatorFactory()
  if (!factory) return 'unavailable'

  try {
    return await factory.availability(languagePairs[targetLanguage])
  } catch {
    return 'unavailable'
  }
}

export async function downloadEnglishTranslation(
  targetLanguage: TranslationTarget,
  onProgress?: TranslationProgressHandler,
): Promise<void> {
  const translator = await createEnglishTranslator(targetLanguage, onProgress)
  destroyTranslator(translator)
}

export async function translateEnglishProductName(
  englishName: string,
  targetLanguage: TranslationTarget,
  onProgress?: TranslationProgressHandler,
): Promise<string> {
  const source = englishName.trim()
  if (!source) throw new ProductTranslationError('empty')

  const translator = await createEnglishTranslator(targetLanguage, onProgress)
  try {
    const translated = (await translator.translate(source)).trim()
    if (!translated) throw new ProductTranslationError('failed')
    return translated
  } catch (error) {
    if (error instanceof ProductTranslationError) throw error
    throw new ProductTranslationError('failed')
  } finally {
    destroyTranslator(translator)
  }
}

export function shouldAutoTranslateProductName(currentName: string): boolean {
  return !currentName.trim()
}
