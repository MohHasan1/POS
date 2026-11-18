'use client'

import { Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useState, useTransition } from 'react'

import {
  createProductAction,
  updateProductAction,
  type ActionResult,
  type ProductActionInput,
} from '@/actions/products'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dictionary } from '@/lib/localization'
import { decimalToMinor, minorToDecimal } from '@/lib/money'
import { localizedName, normalizedTranslations, type MarketProfile, type SecondaryLanguage } from '@/lib/market'
import type { ProductSummary } from '@/lib/pos-types'
import {
  ProductTranslationError,
  shouldAutoTranslateProductName,
  translateEnglishProductName,
} from '@/services/browser-translator'

type CreateProductAction = (input: ProductActionInput) => Promise<ActionResult<unknown>>

export type ProductFormProps = {
  createAction?: CreateProductAction
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  onDone: () => void
  product: ProductSummary | null
  market: MarketProfile
  secondaryLanguage: SecondaryLanguage
  autoTranslateProducts: boolean
}

export function ProductForm({
  createAction = createProductAction,
  defaultPriceIncludesVat,
  dictionary,
  onDone,
  product,
  market,
  secondaryLanguage,
  autoTranslateProducts,
}: ProductFormProps) {
  const router = useRouter()
  const [nameEnglish, setNameEnglish] = useState(product?.nameEnglish ?? '')
  const initialTranslations = normalizedTranslations(product?.translations, {
    ar: product?.nameArabic,
    bn: product?.nameBangla,
  })
  const [nameBangla, setNameBangla] = useState(localizedName(initialTranslations, 'bn') ?? '')
  const [nameArabic, setNameArabic] = useState(localizedName(initialTranslations, 'ar') ?? '')
  const [includesVat, setIncludesVat] = useState(
    product?.priceIncludesVat ?? defaultPriceIncludesVat,
  )
  const [error, setError] = useState('')
  const [translationMessage, setTranslationMessage] = useState('')
  const [translationPending, setTranslationPending] = useState(false)
  const [pending, startTransition] = useTransition()

  function translationErrorMessage(translationError: unknown) {
    return translationError instanceof ProductTranslationError &&
      translationError.code === 'unavailable'
      ? dictionary.translationUnavailableMessage
      : dictionary.translationFailed
  }

  async function translateMissingNames(showFailure: boolean): Promise<{
    translatedArabic: string
    translatedBangla: string
  } | null> {
    let translatedArabic = nameArabic.trim()
    let translatedBangla = nameBangla.trim()

    if (!nameEnglish.trim()) {
      setError(dictionary.translationEmptyEnglish)
      return null
    }

    const targetValue = secondaryLanguage === 'ar' ? translatedArabic : translatedBangla
    if (secondaryLanguage === 'none' || !shouldAutoTranslateProductName(targetValue)) {
      return { translatedArabic, translatedBangla }
    }

    setTranslationMessage('')
    setTranslationPending(true)

    try {
      if (secondaryLanguage === 'ar' && shouldAutoTranslateProductName(translatedArabic)) {
        setTranslationMessage(dictionary.translatingArabic)
        try {
          translatedArabic = await translateEnglishProductName(nameEnglish, 'ar', (loaded) => {
            setTranslationMessage(`${dictionary.translatingArabic} ${Math.round(loaded * 100)}%`)
          })
          setNameArabic(translatedArabic)
        } catch (translationError) {
          if (showFailure) setError(translationErrorMessage(translationError))
          return { translatedArabic, translatedBangla }
        }
      }

      if (secondaryLanguage === 'bn' && shouldAutoTranslateProductName(translatedBangla)) {
        setTranslationMessage(dictionary.translatingBangla)
        try {
          translatedBangla = await translateEnglishProductName(nameEnglish, 'bn', (loaded) => {
            setTranslationMessage(`${dictionary.translatingBangla} ${Math.round(loaded * 100)}%`)
          })
          setNameBangla(translatedBangla)
        } catch (translationError) {
          if (showFailure) setError(translationErrorMessage(translationError))
          translatedBangla = ''
        }
      }

      return { translatedArabic, translatedBangla }
    } finally {
      setTranslationPending(false)
      setTranslationMessage('')
    }
  }

  async function autoTranslate() {
    setError('')
    await translateMissingNames(true)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError('')

    const priceMinor = decimalToMinor(String(formData.get('price') || ''), market)
    if (priceMinor === null) {
      setError('Enter a valid price with up to two decimal places.')
      return
    }

    const translatedNames = autoTranslateProducts
      ? await translateMissingNames(false)
      : { translatedArabic: nameArabic.trim(), translatedBangla: nameBangla.trim() }
    if (!translatedNames) return

    const input = {
      nameEnglish,
      nameBangla: translatedNames.translatedBangla,
      nameArabic: translatedNames.translatedArabic,
      translations: [
        ...(translatedNames.translatedArabic
          ? [{ language: 'ar', name: translatedNames.translatedArabic }]
          : []),
        ...(translatedNames.translatedBangla
          ? [{ language: 'bn', name: translatedNames.translatedBangla }]
          : []),
      ],
      sku: String(formData.get('sku') || ''),
      priceMinor,
      vatCategory: String(formData.get('vatCategory')) as ProductSummary['vatCategory'],
      priceIncludesVat: includesVat,
    }

    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, input)
        : await createAction(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="nameEnglish">
              <span>
                {dictionary.nameEnglish}{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
            </Label>
            {secondaryLanguage !== 'none' && <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={pending || translationPending}
              onClick={autoTranslate}
            >
              <Languages aria-hidden="true" />
              {dictionary.autoTranslate}
            </Button>}
          </div>
          <Input
            id="nameEnglish"
            name="nameEnglish"
            disabled={translationPending}
            onChange={(event) => setNameEnglish(event.target.value)}
            value={nameEnglish}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">
            <span>
              {dictionary.price} ({market.currencyCode}){' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </span>
          </Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={product ? minorToDecimal(product.priceMinor, market) : ''}
            required
          />
        </div>
        {secondaryLanguage === 'ar' && <div className="space-y-1.5">
          <Label htmlFor="nameArabic">{dictionary.nameArabic}</Label>
          <Input
            id="nameArabic"
            name="nameArabic"
            dir="rtl"
            disabled={translationPending}
            onChange={(event) => setNameArabic(event.target.value)}
            value={nameArabic}
          />
        </div>}
        {secondaryLanguage === 'bn' && <div className="space-y-1.5">
          <Label htmlFor="nameBangla">{dictionary.nameBangla}</Label>
          <Input
            id="nameBangla"
            name="nameBangla"
            disabled={translationPending}
            onChange={(event) => setNameBangla(event.target.value)}
            value={nameBangla}
          />
        </div>}
        {market.taxMode === 'saudiVat' && <div className="space-y-1.5">
          <Label htmlFor="sku">{dictionary.sku}</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku || ''} />
        </div>}
        <div className="space-y-1.5">
          <Label htmlFor="vatCategory">{dictionary.vatCategory}</Label>
          <Select name="vatCategory" defaultValue={product?.vatCategory || 'standard'}>
            <SelectTrigger id="vatCategory" className="w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="standard">{dictionary.standardRated}</SelectItem>
              <SelectItem value="zero">{dictionary.zeroRated}</SelectItem>
              <SelectItem value="exempt">{dictionary.exempt}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {product && market.taxMode === 'saudiVat' && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includesVat} onCheckedChange={setIncludesVat} />
          {dictionary.priceIncludesVat}
        </label>
      )}
      {translationMessage && (
        <p className="text-sm text-muted-foreground" role="status">
          {translationMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <DialogFooter className="mx-0 mb-0 px-0 pb-0">
        <Button type="button" variant="outline" onClick={onDone}>
          {dictionary.cancel}
        </Button>
        <Button type="submit" disabled={pending || translationPending}>
          {pending ? dictionary.saving : dictionary.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
