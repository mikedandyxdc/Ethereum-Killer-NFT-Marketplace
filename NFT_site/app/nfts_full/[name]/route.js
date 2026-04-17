import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

// Serves files from /app/public/nfts_full/ at runtime.
// Needed because Next.js standalone only indexes public/ at build time —
// these assets are bind-mounted in via docker-compose.yml.
const NAME_RE = /^Ethereum Killer#\d{4}$/

export async function GET(request, { params }) {
  const { name } = await params
  if (!NAME_RE.test(name)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const filePath = join(process.cwd(), 'public', 'nfts_full', name)
  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
