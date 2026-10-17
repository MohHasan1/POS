'use client'

import { Download, Upload } from 'lucide-react'
import { type SubmitEvent, useRef, useState, useTransition } from 'react'

import { importProductsAction } from '@/actions/product-transfer'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import { productCsvHeaders } from '@/lib/product-csv'

export function ProductImportExport({ dictionary }: { dictionary: Dictionary }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const file = formData.get('file')

    if (!(file instanceof File) || !file.size) {
      setResult(null)
      setError(dictionary.selectCsvFile)
      return
    }

    setError('')
    setResult(null)
    startTransition(async () => {
      try {
        const response = await importProductsAction(await file.text())
        if (!response.ok) {
          setError(response.error)
          return
        }

        setResult(response.data)
        formRef.current?.reset()
      } catch {
        setError(dictionary.productImportFailed)
      }
    })
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">{dictionary.exportProducts}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dictionary.exportProductsDescription}
          </p>
        </div>
        <a
          className={buttonVariants({ size: 'sm' })}
          download
          href="/products/import-export/export"
        >
          <Download aria-hidden="true" />
          {dictionary.downloadProductsCsv}
        </a>
      </section>

      <section className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">{dictionary.importProducts}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dictionary.importProductsDescription}
          </p>
        </div>
        <p className="overflow-x-auto text-xs text-muted-foreground">
          {dictionary.csvColumns}: <code>{productCsvHeaders.join(', ')}</code>
        </p>
        <form ref={formRef} className="space-y-3" onSubmit={submit}>
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="productCsv">{dictionary.csvFile}</Label>
            <Input id="productCsv" name="file" type="file" accept=".csv,text/csv" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Upload aria-hidden="true" />
            {pending ? dictionary.importingProducts : dictionary.importProducts}
          </Button>
        </form>
        {result && (
          <p className="text-sm text-foreground" role="status">
            {dictionary.productImportComplete} {result.created} {dictionary.productsCreated},{' '}
            {result.updated} {dictionary.productsUpdated}.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
