import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const requests = await prisma.payment_requests.findMany({
      select: {
        id: true,
        payee: true,
        purpose: true,
        amount: true,
        project_id: true,
        requested_by: true,
        created_at: true,
      }
    })
    console.log("Found", requests.length, "payment requests.")
    for (const r of requests) {
      if (r.requested_by === 'e11f4d89-4be1-4490-9c00-d10457def85d') {
        console.log("MADAN INPUT:", r)
      }
    }
  } catch (e) {
    console.error("Error:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
