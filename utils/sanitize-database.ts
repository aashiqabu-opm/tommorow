import { PrismaClient } from '@prisma/client'

// Initialize a PrismaClient instance
const prisma = new PrismaClient()

/**
 * Helper to identify corrupted characters, replacement strings, or infinite overflows
 */
function hasMalformedCharacters(val: any): boolean {
  if (typeof val === 'string') {
    // Check for common Unicode replacement characters or known data corruption strings
    return val.includes('') || val.includes('undefined') || val.includes('NaN')
  }
  if (typeof val === 'number') {
    return !Number.isFinite(val) || Number.isNaN(val)
  }
  return false
}

/**
 * Automated database data validation and corruption repair utility script
 */
export async function sanitizeDatabase() {
  console.log('Starting Database Data Validation and Corruption Repair...')
  
  // Dynamically read available operational model keys to iterate through
  const modelsToAudit = [
    'cash_entries',
    'bank_accounts',
    'crew_payments',
    'payment_requests',
    'petty_cash_txns'
  ]

  const errorLog: any[] = []

  for (const modelName of modelsToAudit) {
    // Map snake_case or raw strings to Prisma's dynamic client model format if necessary
    // E.g. 'cash_entries' might be 'cash_entries' or 'cashEntries' on the Prisma instance
    let prismaModel = (prisma as any)[modelName]
    
    // Fallback camelCase check for Prisma standard mappings
    if (!prismaModel) {
      const camelCaseName = modelName.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      prismaModel = (prisma as any)[camelCaseName]
    }

    if (!prismaModel) {
      console.warn(`[WARN] Model '${modelName}' not detected on Prisma instance. Skipping.`)
      continue
    }

    console.log(`[AUDIT] Scanning active table: ${modelName}`)
    const records = await prismaModel.findMany()

    for (const record of records) {
      let needsMathCorrection = false
      let correctedData: any = {}
      let requiresHumanIntervention = false

      // 1. Check for Malformed/Corrupted characters
      for (const [key, value] of Object.entries(record)) {
        if (hasMalformedCharacters(value)) {
          errorLog.push({ type: 'CORRUPTED_CHARACTER', model: modelName, id: record.id, field: key, value })
          requiresHumanIntervention = true
        }
      }

      // 2. Broken mathematical invariants check
      // E.g. 'closing_cash' value that does not equal 'opening_cash + cash_in - cash_out'
      if ('closing_cash' in record && 'opening_cash' in record) {
        const opening = Number(record.opening_cash) || 0
        const cashIn = Number(record.cash_in) || 0
        const cashOut = Number(record.cash_out) || 0
        const expectedClosing = opening + cashIn - cashOut
        const actualClosing = Number(record.closing_cash) || 0

        if (expectedClosing !== actualClosing) {
          console.log(`[MATH CORRECTION] ${modelName} ID: ${record.id} | Expected: ${expectedClosing}, Actual: ${actualClosing}`)
          needsMathCorrection = true
          correctedData.closing_cash = expectedClosing
        }
      }

      // 3. Orphaned rows / Corrupt Foreign Keys
      for (const [key, value] of Object.entries(record)) {
        // Flag broken foreign key constraints (e.g., empty strings or strict known invalid tokens)
        if (key.endsWith('_id') && (value === '' || value === 'null' || value === 'INVALID_FK')) {
          errorLog.push({ type: 'ORPHANED_ROW', model: modelName, id: record.id, field: key })
          requiresHumanIntervention = true
        }
      }

      // 4. Safe .update() correction block
      if (needsMathCorrection && !requiresHumanIntervention) {
        try {
          await prismaModel.update({
            where: { id: record.id },
            data: correctedData
          })
          console.log(`[REPAIRED] Successfully repaired broken math fields on ${modelName} ID: ${record.id}`)
        } catch (e: any) {
          errorLog.push({ type: 'UPDATE_FAILED', model: modelName, id: record.id, error: e.message })
        }
      } else if (requiresHumanIntervention) {
        // Log the specific entity ID to error tracking if structural human intervention is required
        console.error(`[MANUAL INTERVENTION REQUIRED] Entity ID: ${record.id} in table ${modelName} contains unresolvable structural corruptions.`)
      }
    }
  }

  console.log('Sanitization Complete. Error Tracking Log:')
  console.log(JSON.stringify(errorLog, null, 2))
}

// To run script standalone:
if (require.main === module) {
  sanitizeDatabase()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e)
      prisma.$disconnect()
      process.exit(1)
    })
}
