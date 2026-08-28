import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('pgvector extension ok');
} finally {
  await prisma.$disconnect();
}