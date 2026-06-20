import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const pipelines = await prisma.pipelines.findMany({
      take: 1
    })
    console.log("Success:", pipelines)
  } catch (e) {
    console.error("Error:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
