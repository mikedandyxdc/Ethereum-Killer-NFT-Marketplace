import { readFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const { id } = await params
  const tokenId = parseInt(id, 10)

  if (isNaN(tokenId) || tokenId < 0 || tokenId > 9999) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const paddedId = String(tokenId).padStart(4, '0')
  const filePath = join(process.cwd(), 'public', 'nfts_full', `Ethereum Killer#${paddedId}`)

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
