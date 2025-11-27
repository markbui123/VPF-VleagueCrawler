/*
  Warnings:

  - A unique constraint covering the columns `[seasonId,matchUrl]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Match` DROP FOREIGN KEY `Match_seasonId_fkey`;

-- DropIndex
DROP INDEX `Match_seasonId_vong_stt_key` ON `Match`;

-- CreateIndex
CREATE UNIQUE INDEX `Match_seasonId_matchUrl_key` ON `Match`(`seasonId`, `matchUrl`);

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
