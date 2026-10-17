import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QuickPOS',
    short_name: 'QuickPOS',
    description: 'A lightweight Saudi Arabia retail point of sale application.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f7f7',
    theme_color: '#171717',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
