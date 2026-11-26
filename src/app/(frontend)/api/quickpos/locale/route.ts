import { dictionaryForLocale, saveLocale } from '@/lib/localization'
import { getLockScreenIdentity } from '@/services/settings'

export async function POST(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (request.headers.get('x-quickpos-locale') !== '1' || (fetchSite && fetchSite !== 'same-origin')) {
    return new Response(null, { status: 403 })
  }
  const data = await request.json().catch(() => null)
  const locale = data?.locale
  if (locale !== 'en' && locale !== 'bn') return new Response(null, { status: 400 })

  const dictionary = dictionaryForLocale(locale)
  const identity = await getLockScreenIdentity(locale, dictionary.defaultShopName)
  await saveLocale(locale)
  return Response.json({ dictionary, identity, locale }, { headers: { 'Cache-Control': 'no-store' } })
}
