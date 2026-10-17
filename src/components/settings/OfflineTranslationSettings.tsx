'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/localization'
import {
  downloadEnglishTranslation,
  getEnglishTranslationAvailability,
  type TranslationAvailability,
  type TranslationTarget,
} from '@/services/browser-translator'

type TranslationStatus = TranslationAvailability | 'checking'

function TranslationModelStatus({
  dictionary,
  downloadLabel,
  languageLabel,
  targetLanguage,
}: {
  dictionary: Dictionary
  downloadLabel: string
  languageLabel: string
  targetLanguage: TranslationTarget
}) {
  const [status, setStatus] = useState<TranslationStatus>('checking')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function refreshStatus() {
      const nextStatus = await getEnglishTranslationAvailability(targetLanguage)
      if (cancelled) return

      setStatus(nextStatus)
      if (nextStatus === 'downloading') {
        timer = setTimeout(refreshStatus, 1_000)
      }
    }

    void refreshStatus()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [targetLanguage])

  async function downloadModel() {
    setError('')
    setProgress(null)
    setStatus('downloading')

    try {
      await downloadEnglishTranslation(targetLanguage, (loaded) => {
        setProgress(Math.round(loaded * 100))
      })
      setProgress(100)
      setStatus('available')
    } catch {
      setStatus(await getEnglishTranslationAvailability(targetLanguage))
      setError(dictionary.translationDownloadFailed)
    }
  }

  const statusText: Record<TranslationStatus, string> = {
    available: dictionary.translationReady,
    checking: dictionary.translationChecking,
    downloadable: dictionary.translationDownloadRequired,
    downloading: dictionary.translationDownloading,
    unavailable: dictionary.translationUnavailable,
  }

  return (
    <div className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">English → {languageLabel}</span>
        <Badge variant={status === 'unavailable' ? 'outline' : 'secondary'}>
          {statusText[status]}
          {status === 'downloading' && progress !== null ? ` ${progress}%` : ''}
        </Badge>
      </div>
      {status === 'downloadable' && (
        <Button type="button" size="sm" onClick={downloadModel}>
          {downloadLabel}
        </Button>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function OfflineTranslationSettings({ dictionary }: { dictionary: Dictionary }) {
  return (
    <section className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{dictionary.offlineTranslation}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.offlineTranslationDescription}
        </p>
      </div>
      <TranslationModelStatus
        dictionary={dictionary}
        downloadLabel={dictionary.downloadArabicTranslation}
        languageLabel="العربية"
        targetLanguage="ar"
      />
      <TranslationModelStatus
        dictionary={dictionary}
        downloadLabel={dictionary.downloadBanglaTranslation}
        languageLabel="বাংলা"
        targetLanguage="bn"
      />
    </section>
  )
}
