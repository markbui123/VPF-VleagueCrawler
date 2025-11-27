-- CreateIndex
CREATE INDEX `Match_seasonId_matchDateTime_idx` ON `Match`(`seasonId`, `matchDateTime`);

-- CreateIndex
CREATE INDEX `Match_seasonId_vong_idx` ON `Match`(`seasonId`, `vong`);
