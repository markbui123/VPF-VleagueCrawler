/*
  Warnings:

  - A unique constraint covering the columns `[seasonId,vong,stt]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Match` ADD COLUMN `awayHref` VARCHAR(191) NULL,
    ADD COLUMN `contentHash` VARCHAR(191) NULL,
    ADD COLUMN `crawledAt` DATETIME(3) NULL,
    ADD COLUMN `dataSource` VARCHAR(191) NOT NULL DEFAULT 'vpf.vn',
    ADD COLUMN `homeHref` VARCHAR(191) NULL,
    ADD COLUMN `matchUrl` VARCHAR(191) NULL,
    ADD COLUMN `rawJson` JSON NULL,
    ADD COLUMN `roundElementId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Match_seasonId_vong_stt_key` ON `Match`(`seasonId`, `vong`, `stt`);
