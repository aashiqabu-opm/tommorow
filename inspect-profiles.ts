import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const profiles = await prisma.profiles.findMany({
      select: {
        id: true,
        full_name: true,
        role: true,
        email: true
      }
    })
    console.log(profiles)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
