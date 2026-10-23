// Makes the shareable winner card: an HTML page is drawn to a PNG image.
// It is built in memory (off screen), turned into a picture, and then shared or downloaded.
import html2canvas from 'html2canvas'
import { APP_NAME } from '../config'

// Small helper to make an element with style and text (textContent keeps user text safe)
function el(tag, css, text) {
  const node = document.createElement(tag)
  node.style.cssText = css
  if (text !== undefined) node.textContent = text
  return node
}

// Builds the card and returns it as a PNG Blob
export async function makeWinnerCard({ imageUrl, caption, username, title }) {
  const card = el(
    'div',
    'position:fixed;left:-10000px;top:0;width:1080px;height:1350px;background:#111;color:#fff;' +
      'font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:space-between;padding:60px;box-sizing:border-box;'
  )

  const header = el('div', 'font-size:44px;font-weight:800;letter-spacing:4px;color:#ffcc00;', `${APP_NAME} DAILY WINNER`)

  const img = document.createElement('img')
  img.src = imageUrl
  img.crossOrigin = 'anonymous' // lets the browser draw the image (the image host must allow it)
  img.style.cssText = 'width:900px;height:620px;object-fit:contain;border-radius:24px;'

  const capText = el(
    'div',
    'font-size:60px;font-weight:800;text-align:center;line-height:1.15;max-width:960px;',
    `"${caption}"`
  )
  const who = el('div', 'font-size:34px;opacity:0.75;', `by @${username}`)
  const footer = el('div', 'font-size:28px;opacity:0.5;', `${title} - play daily`)

  card.append(header, img, capText, who, footer)
  document.body.appendChild(card)

  try {
    await img.decode() // wait for the picture to load before drawing
  } catch (e) {
    // If the image fails, the card still renders without it
  }

  try {
    const canvas = await html2canvas(card, { useCORS: true, backgroundColor: '#111111', scale: 1 })
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  } finally {
    card.remove()
  }
}

// Opens the phone share sheet if available, otherwise downloads the PNG
export async function shareCard(blob, text) {
  const file = new File([blob], 'capbattle-winner.png', { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: APP_NAME, text })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'capbattle-winner.png'
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
