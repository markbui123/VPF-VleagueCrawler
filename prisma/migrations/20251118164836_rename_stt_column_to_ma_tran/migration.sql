/*
  Warnings:

  - You are about to drop the column `stt` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Match` DROP COLUMN `stt`,
    ADD COLUMN `maTran` VARCHAR(191) NULL;
