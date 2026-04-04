// Document processing utilities - V0 MVP (extraction only)

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { randomBytes } from 'crypto'
import * as XLSX from 'xlsx'

const execAsync = promisify(exec)

/**
 * Extract text from PDF buffer using pdftotext command-line tool
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const tempFile = `/tmp/pdf_${randomBytes(8).toString('hex')}.pdf`
  const textFile = `/tmp/text_${randomBytes(8).toString('hex')}.txt`

  try {
    // Write PDF buffer to temp file
    writeFileSync(tempFile, buffer)

    // Use pdftotext to extract text
    await execAsync(`pdftotext "${tempFile}" "${textFile}"`)

    // Read extracted text
    const fs = require('fs')
    const text = fs.readFileSync(textFile, 'utf-8')

    console.log('PDF extracted successfully, text length:', text.length, 'chars')

    if (!text || text.trim().length === 0) {
      throw new Error('PDF contains no extractable text (possibly scanned image)')
    }

    return text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PDF extraction error:', msg)
    throw new Error(`PDF extraction failed: ${msg}`)
  } finally {
    // Cleanup temp files
    try {
      unlinkSync(tempFile)
      const fs = require('fs')
      if (fs.existsSync(textFile)) {
        unlinkSync(textFile)
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Extract text from CSV buffer
 */
export async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  try {
    const Papa = require('papaparse')
    const csvText = buffer.toString('utf-8')

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        complete: (results: any) => {
          console.log('📊 [CSV] Extracted', results.data.length, 'rows')

          // Convert to readable format
          const lines = results.data.map((row: Record<string, string>) => {
            return Object.entries(row)
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ')
          })

          const text = lines.filter((line: string) => line.trim()).join('\n')
          resolve(text)
        },
        error: (error: Error) => {
          console.error('❌ [CSV] Parse failed:', error.message)
          reject(error)
        },
      })
    })
  } catch (err) {
    console.error('❌ [CSV] Extraction failed:', err instanceof Error ? err.message : String(err))
    throw new Error('Failed to extract CSV text')
  }
}

/**
 * Extract text from XLSX (Excel) buffer
 */
export async function extractTextFromXLSX(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)

      if (data.length > 0) {
        lines.push(`[Planilha: ${sheetName}]`)

        // Convert rows to readable format
        const sheetLines = (data as Record<string, any>[]).map(row => {
          return Object.entries(row)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
              // Safely convert value to string
              let strValue: string
              if (typeof v === 'object') {
                strValue = JSON.stringify(v)
              } else if (typeof v === 'number') {
                strValue = String(v)
              } else {
                strValue = String(v || '')
              }
              return `${k}: ${strValue}`
            })
            .join(' | ')
        })

        lines.push(...sheetLines.filter((line: string) => line.trim()))
        lines.push('') // Add blank line between sheets
      }
    }

    const text = lines.filter((line: string) => line.trim()).join('\n')
    console.log('📊 [XLSX] Extracted successfully, length:', text.length, 'chars')

    if (!text || text.trim().length === 0) {
      throw new Error('XLSX contains no extractable data')
    }

    return text
  } catch (err) {
    console.error('❌ [XLSX] Extraction failed:', err instanceof Error ? err.message : String(err))
    throw new Error('Failed to extract XLSX text')
  }
}

/**
 * Extract text from DOCX (Word) buffer
 */
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const JSZip = require('jszip')
    const zip = new JSZip()
    const zipData = await zip.loadAsync(buffer)

    // Read the main document XML
    const docXmlText = await zipData.file('word/document.xml')?.async('text')

    if (!docXmlText) {
      throw new Error('Could not find document.xml in DOCX')
    }

    // Extract text between XML tags (simple approach)
    // Matches text content between <w:t> tags
    const textMatches = docXmlText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    const text = textMatches
      .map((match: string) => match.replace(/<w:t[^>]*>|<\/w:t>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    console.log('📄 [DOCX] Extracted successfully, length:', text.length, 'chars')

    if (!text || text.length === 0) {
      throw new Error('DOCX contains no extractable text')
    }

    return text
  } catch (err) {
    console.error('❌ [DOCX] Extraction failed:', err instanceof Error ? err.message : String(err))
    throw new Error('Failed to extract DOCX text')
  }
}

