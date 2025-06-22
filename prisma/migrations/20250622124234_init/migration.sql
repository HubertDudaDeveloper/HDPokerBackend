/*
  Warnings:

  - The `points` column on the `Room` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `image` on the `Task` table. All the data in the column will be lost.
  - The `points` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "points",
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "image",
DROP COLUMN "points",
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;
