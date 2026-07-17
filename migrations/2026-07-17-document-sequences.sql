CREATE TABLE IF NOT EXISTS `document_sequences` (
  `document_type` VARCHAR(30) NOT NULL,
  `sequence_year` INT NOT NULL,
  `last_number` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_type`, `sequence_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- De applicatie reserveert nummers binnen een database-transactie.
-- Formaten:
-- OFF-2026-0001  offerte
-- FAC-2026-0001  factuur
-- WRK-2026-0001  werkbon
-- CRD-2026-0001  creditfactuur
