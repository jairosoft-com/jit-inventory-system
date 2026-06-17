-- CreateIndex
CREATE INDEX "borrow_records_created_at_idx" ON "borrow_records"("created_at");

-- CreateIndex
CREATE INDEX "stock_in_created_at_idx" ON "stock_in"("created_at");

-- CreateIndex
CREATE INDEX "stock_out_created_at_idx" ON "stock_out"("created_at");
