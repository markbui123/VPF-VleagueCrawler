-- CreateTable
CREATE TABLE `Season` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `thoiGianToChuc` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `seasonId` INTEGER NOT NULL,
    `vong` VARCHAR(191) NOT NULL,
    `thuNgay` VARCHAR(191) NOT NULL,
    `gio` VARCHAR(191) NULL,
    `stt` VARCHAR(191) NULL,
    `svd` VARCHAR(191) NULL,
    `doiNha` VARCHAR(191) NOT NULL,
    `logoDoiNha` VARCHAR(191) NULL,
    `ketQua` VARCHAR(191) NULL,
    `trangThaiVar` VARCHAR(191) NULL,
    `doiKhach` VARCHAR(191) NOT NULL,
    `logoDoiKhach` VARCHAR(191) NULL,
    `kenhTv` VARCHAR(191) NULL,
    `khanGia` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
