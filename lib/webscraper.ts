import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedContent {
  url: string
  title: string
  content: string
  metadata: {
    description?: string
    keywords?: string
    author?: string
  }
  scrapedAt: string
}

// Lista de domínios bloqueados (security)
const BLOCKED_DOMAINS = [
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'tiktok.com',
  'snapchat.com',
]

export async function scrapeUrl(url: string, selector?: string): Promise<ScrapedContent> {
  try {
    // Validar URL
    const urlObj = new URL(url)

    // Checar blocklist
    if (BLOCKED_DOMAINS.some((domain) => urlObj.hostname.includes(domain))) {
      throw new Error('Domain ' + urlObj.hostname + ' is blocked for scraping')
    }

    // HTTP request com timeout
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; C-Lvls-Bot/1.0 +https://seu-site.com)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    })

    const $ = cheerio.load(response.data)

    // Remover scripts, styles, nav, footer, header, forms
    $('script, style, nav, footer, header, form').remove()

    // Extrair conteúdo
    let content: string
    if (selector) {
      content = $(selector).text().trim()
    } else {
      // Priorizar article, main, .content
      const article = $('article').text() || $('main').text() || $('.content').text() || $.text()
      content = article.trim()
    }

    // Limpar espaços em branco excessivos
    content = content
      .replace(/\n\s*\n/g, '\n\n') // Múltiplas quebras
      .replace(/\s+/g, ' ') // Espaços múltiplos
      .substring(0, 5000) // Limitar a 5000 chars

    // Extrair metadata
    const title = $('title').text().trim() || $('h1').first().text().trim() || ''
    const description = $('meta[name="description"]').attr('content') || ''
    const keywords = $('meta[name="keywords"]').attr('content') || ''
    const author =
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      ''

    return {
      url,
      title,
      content,
      metadata: { description, keywords, author },
      scrapedAt: new Date().toISOString(),
    }
  } catch (error) {
    throw new Error(
      'Failed to scrape ' + url + ': ' + (error instanceof Error ? error.message : 'Unknown error')
    )
  }
}

// URL detection regex
export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const urls = text.match(urlRegex) || []
  return [...new Set(urls)] // Remove duplicates
}

// URL validation
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}
