-- CreateIndex
CREATE INDEX "UserEntitlement_status_idx" ON "UserEntitlement"("status");

-- CreateIndex
CREATE INDEX "UserEntitlement_validUntil_idx" ON "UserEntitlement"("validUntil");

-- CreateIndex
CREATE INDEX "UserSubscription_status_idx" ON "UserSubscription"("status");

-- CreateIndex
CREATE INDEX "UserSubscription_currentPeriodEnd_idx" ON "UserSubscription"("currentPeriodEnd");
