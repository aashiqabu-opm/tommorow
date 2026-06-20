import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const deleted = await prisma.payment_requests.deleteMany({
      where: {
        id: {
          in: [
            '353ad719-84eb-474f-940a-52ed266d07ed', // Dream Mill
            'cc99cd65-b18c-461f-a4f3-f6f926e5edaa'  // Anirudh
          ]
        }
      }
    })
    console.log("Deleted", deleted.count, "fake payment requests.")
  } catch (e) {
    console.error("Error deleting:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
