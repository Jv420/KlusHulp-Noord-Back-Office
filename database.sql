-- KlusHulp Noord Back Office
-- Compatibel met oudere MySQL-versies
-- Database: sql7833304

USE `sql7833304`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(80) NOT NULL,
  `label` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_user_roles_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  KEY `idx_role_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `roles` (`id`, `name`, `label`) VALUES
  (1, 'owner', 'Eigenaar'),
  (2, 'admin', 'Administrator'),
  (3, 'bookkeeper', 'Boekhouder'),
  (4, 'employee', 'Medewerker'),
  (5, 'readonly', 'Alleen lezen');

INSERT IGNORE INTO `permissions` (`id`, `code`, `label`) VALUES
  (1, '*', 'Alle rechten'),
  (2, 'data.read', 'Gegevens bekijken'),
  (3, 'data.write', 'Gegevens wijzigen'),
  (4, 'users.manage', 'Gebruikers beheren');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (1, 1),(2, 2),(2, 3),(2, 4),(3, 2),(3, 3),(4, 2),(4, 3),(5, 2);

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_number` VARCHAR(40) DEFAULT NULL,
  `type` ENUM('particulier','zakelijk') NOT NULL DEFAULT 'particulier',
  `name` VARCHAR(150) DEFAULT NULL,
  `company_name` VARCHAR(150) DEFAULT NULL,
  `contact_person` VARCHAR(150) DEFAULT NULL,
  `street` VARCHAR(180) DEFAULT NULL,
  `postal_code` VARCHAR(20) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(190) DEFAULT NULL,
  `phone` VARCHAR(60) DEFAULT NULL,
  `kvk` VARCHAR(30) DEFAULT NULL,
  `vat_number` VARCHAR(40) DEFAULT NULL,
  `iban` VARCHAR(40) DEFAULT NULL,
  `payment_term` INT NOT NULL DEFAULT 14,
  `recurring` TINYINT(1) NOT NULL DEFAULT 0,
  `payment_behavior` VARCHAR(50) NOT NULL DEFAULT 'normaal',
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customers_customer_number` (`customer_number`),
  KEY `idx_customers_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sku` VARCHAR(80) DEFAULT NULL,
  `name` VARCHAR(180) NOT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `unit` VARCHAR(30) NOT NULL DEFAULT 'stuk',
  `stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `purchase_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sale_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `supplier` VARCHAR(160) DEFAULT NULL,
  `location` VARCHAR(120) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_sku` (`sku`),
  KEY `idx_inventory_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` ENUM('offerte','factuur','werkbon','creditfactuur') NOT NULL,
  `number` VARCHAR(60) DEFAULT NULL,
  `customer_id` INT DEFAULT NULL,
  `issue_date` DATE DEFAULT NULL,
  `due_date` DATE DEFAULT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'concept',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `vat_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documents_number` (`number`),
  KEY `idx_documents_customer_id` (`customer_id`),
  CONSTRAINT `fk_documents_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `document_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `document_id` INT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(30) NOT NULL DEFAULT 'stuk',
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `vat_rate` DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `inventory_id` INT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_document_items_document_id` (`document_id`),
  KEY `idx_document_items_inventory_id` (`inventory_id`),
  CONSTRAINT `fk_document_items_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_items_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory_movements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `inventory_id` INT NOT NULL,
  `movement_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quantity` DECIMAL(12,2) NOT NULL,
  `reason` VARCHAR(120) DEFAULT NULL,
  `reference` VARCHAR(120) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_movements_inventory_id` (`inventory_id`),
  CONSTRAINT `fk_inventory_movements_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('bedrijfsauto','priveauto') NOT NULL DEFAULT 'bedrijfsauto',
  `license_plate` VARCHAR(30) DEFAULT NULL,
  `odometer` INT NOT NULL DEFAULT 0,
  `apk_date` DATE DEFAULT NULL,
  `insurance_date` DATE DEFAULT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vehicle_costs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vehicle_id` INT NOT NULL,
  `cost_date` DATE DEFAULT NULL,
  `type` VARCHAR(80) DEFAULT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `odometer` INT DEFAULT NULL,
  `description` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_costs_vehicle_id` (`vehicle_id`),
  CONSTRAINT `fk_vehicle_costs_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `time_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT DEFAULT NULL,
  `work_date` DATE DEFAULT NULL,
  `start_time` TIME DEFAULT NULL,
  `end_time` TIME DEFAULT NULL,
  `break_minutes` INT NOT NULL DEFAULT 0,
  `hours` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `description` TEXT,
  `billable` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_time_entries_customer_id` (`customer_id`),
  CONSTRAINT `fk_time_entries_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `expense_date` DATE DEFAULT NULL,
  `category` VARCHAR(80) DEFAULT NULL,
  `supplier` VARCHAR(160) DEFAULT NULL,
  `description` TEXT,
  `amount_ex_vat` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `vat_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amount_inc_vat` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `receipt_path` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_id` INT DEFAULT NULL,
  `title` VARCHAR(180) NOT NULL,
  `start_at` DATETIME DEFAULT NULL,
  `end_at` DATETIME DEFAULT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'gepland',
  `location` VARCHAR(180) DEFAULT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_customer_id` (`customer_id`),
  CONSTRAINT `fk_appointments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES
  ('company_name', 'KlusHulp Noord'),
  ('slogan', 'Betaalbaar • Betrouwbaar • Voor Iedereen'),
  ('default_private_payment_term', '14'),
  ('default_business_payment_term', '30');

SET FOREIGN_KEY_CHECKS = 1;
