USE `sql7833304`;

ALTER TABLE `appointments`
  ADD COLUMN IF NOT EXISTS `appointment_type` VARCHAR(40) NOT NULL DEFAULT 'klus',
  ADD COLUMN IF NOT EXISTS `priority` VARCHAR(20) NOT NULL DEFAULT 'normaal',
  ADD COLUMN IF NOT EXISTS `assigned_to` INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `all_day` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `color` VARCHAR(20) NOT NULL DEFAULT '#f5c400',
  ADD COLUMN IF NOT EXISTS `reminder_minutes` INT NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS `completed_at` DATETIME DEFAULT NULL;

CREATE INDEX `idx_appointments_start_at` ON `appointments` (`start_at`);
CREATE INDEX `idx_appointments_status` ON `appointments` (`status`);
CREATE INDEX `idx_appointments_assigned_to` ON `appointments` (`assigned_to`);
