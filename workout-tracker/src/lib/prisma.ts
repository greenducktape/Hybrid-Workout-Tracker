import { Prisma, PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'

function resolveDatabaseUrl(): string {
  // Prefer explicit DATABASE_URL in deployed environments.
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const bundledDbPath = path.resolve(process.cwd(), 'prisma/dev.db')

  // Vercel/Serverless file systems are often read-only except /tmp.
  // For SQLite fallback, copy the bundled DB to /tmp so writes succeed.
  if (process.env.NODE_ENV === 'production') {
    const writableDbPath = path.join(os.tmpdir(), 'hybrid-workout-tracker.db')
    if (!fs.existsSync(writableDbPath) && fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, writableDbPath)
    }
    return `file:${writableDbPath}`
  }

  return `file:${bundledDbPath}`
}

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() })
  return new PrismaClient({ adapter } satisfies Prisma.PrismaClientOptions)
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
