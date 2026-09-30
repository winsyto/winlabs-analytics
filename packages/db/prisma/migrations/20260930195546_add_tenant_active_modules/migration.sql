-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[];
