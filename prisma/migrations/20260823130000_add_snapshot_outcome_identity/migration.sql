-- Records which outcome an estimate was actually about, and the price the model was shown for it.
--
-- Both are additive and nullable: existing rows keep their meaning and simply cannot answer the
-- two questions these columns exist for. That gap is the point. Without outcomeLabel a resolved
-- snapshot cannot be checked for a probability recorded against the wrong side of a market, and
-- without shownPrice there is no way to separate an estimate the model reasoned to from one it
-- copied off the quote it was given -- the two are identical in every other stored field.
ALTER TABLE "CapitalCircleCandidateSnapshot" ADD COLUMN "outcomeLabel" TEXT;
ALTER TABLE "CapitalCircleCandidateSnapshot" ADD COLUMN "shownPrice" DECIMAL(6,4);
