-- KlusHulp Noord Back Office v10
-- Complete basisdatabase voor een eenmanszaak
-- Importeren in MySQL/MariaDB via phpMyAdmin, HeidiSQL of mysql CLI.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS customers (
 id INT AUTO_INCREMENT PRIMARY KEY,
 customer_number VARCHAR(40) NULL UNIQUE,
 name VARCHAR(190) NOT NULL,
 company_name VARCHAR(190) NULL,
 contact_person VARCHAR(190) NULL,
 email VARCHAR(190) NULL,
 phone VARCHAR(50) NULL,
 street VARCHAR(190) NULL,
 house_number VARCHAR(30) NULL,
 postal_code VARCHAR(20) NULL,
 city VARCHAR(120) NULL,
 country VARCHAR(80) NOT NULL DEFAULT 'Nederland',
 vat_number VARCHAR(50) NULL,
 kvk VARCHAR(40) NULL,
 iban VARCHAR(60) NULL,
 payment_term INT NOT NULL DEFAULT 14,
 vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
 notes TEXT NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_settings (
 id TINYINT PRIMARY KEY DEFAULT 1,
 legal_name VARCHAR(190) NOT NULL DEFAULT 'KlusHulp Noord',
 trade_name VARCHAR(190) NOT NULL DEFAULT 'KlusHulp Noord',
 owner_name VARCHAR(190) NULL,
 street VARCHAR(190) NULL,
 house_number VARCHAR(30) NULL,
 postal_code VARCHAR(20) NULL,
 city VARCHAR(120) NULL,
 country VARCHAR(80) NOT NULL DEFAULT 'Nederland',
 email VARCHAR(190) NULL,
 phone VARCHAR(50) NULL,
 website VARCHAR(190) NULL,
 kvk_number VARCHAR(30) NULL,
 vat_id VARCHAR(40) NULL,
 iban VARCHAR(60) NULL,
 bic VARCHAR(20) NULL,
 payment_term_days INT NOT NULL DEFAULT 14,
 quote_valid_days INT NOT NULL DEFAULT 30,
 invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'FAC',
 quote_prefix VARCHAR(20) NOT NULL DEFAULT 'OFF',
 default_vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21.00,
 footer_text TEXT NULL,
 terms_text TEXT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO company_settings(id,legal_name,trade_name,country) VALUES(1,'KlusHulp Noord','KlusHulp Noord','Nederland');

CREATE TABLE IF NOT EXISTS documents (
 id INT AUTO_INCREMENT PRIMARY KEY,
 type ENUM('offerte','factuur','creditfactuur') NOT NULL,
 number VARCHAR(50) NOT NULL UNIQUE,
 customer_id INT NOT NULL,
 issue_date DATE NOT NULL,
 delivery_date DATE NULL,
 due_date DATE NULL,
 valid_until DATE NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'concept',
 subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_total DECIMAL(12,2) NOT NULL DEFAULT 0,
 total DECIMAL(12,2) NOT NULL DEFAULT 0,
 notes TEXT NULL,
 original_document_id INT NULL,
 paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 payment_status VARCHAR(30) NOT NULL DEFAULT 'open',
 sent_at DATETIME NULL,
 paid_at DATETIME NULL,
 external_payment_url TEXT NULL,
 external_payment_provider VARCHAR(40) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_documents_customer(customer_id), INDEX idx_documents_type(type), INDEX idx_documents_date(issue_date),
 CONSTRAINT fk_documents_customer FOREIGN KEY(customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_items (
 id INT AUTO_INCREMENT PRIMARY KEY,
 document_id INT NOT NULL,
 description TEXT NOT NULL,
 quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
 unit VARCHAR(30) NULL DEFAULT 'stuk',
 unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
 line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
 INDEX idx_document_items_document(document_id),
 CONSTRAINT fk_document_items_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_sequences (
 document_type VARCHAR(30) NOT NULL,
 sequence_year INT NOT NULL,
 last_number INT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(document_type,sequence_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
 id INT AUTO_INCREMENT PRIMARY KEY,
 document_id INT NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 payment_date DATE NOT NULL,
 payment_method VARCHAR(40) NOT NULL DEFAULT 'bank',
 reference VARCHAR(190) NULL,
 notes TEXT NULL,
 created_by VARCHAR(190) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_payments_document(document_id),
 CONSTRAINT fk_payments_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_reminders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 document_id INT NOT NULL,
 reminder_type VARCHAR(30) NOT NULL DEFAULT 'herinnering',
 reminder_date DATE NOT NULL,
 due_date DATE NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'concept',
 subject VARCHAR(190) NULL,
 message TEXT NULL,
 sent_at DATETIME NULL,
 created_by VARCHAR(190) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_reminders_document(document_id),
 CONSTRAINT fk_reminders_document FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring_invoices (
 id INT AUTO_INCREMENT PRIMARY KEY,
 customer_id INT NOT NULL,
 name VARCHAR(190) NOT NULL,
 description TEXT NULL,
 amount_ex_vat DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
 interval_type VARCHAR(30) NOT NULL DEFAULT 'maandelijks',
 next_invoice_date DATE NOT NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 last_document_id INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_recurring_customer(customer_id),
 CONSTRAINT fk_recurring_customer FOREIGN KEY(customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_orders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 work_order_number VARCHAR(50) NULL UNIQUE,
 customer_id INT NOT NULL,
 title VARCHAR(190) NOT NULL,
 description TEXT NULL,
 work_address VARCHAR(255) NULL,
 planned_start DATETIME NULL,
 planned_end DATETIME NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'concept',
 notes TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_work_customer(customer_id), INDEX idx_work_status(status),
 CONSTRAINT fk_work_customer FOREIGN KEY(customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS time_entries (
 id INT AUTO_INCREMENT PRIMARY KEY,
 work_date DATE NOT NULL,
 customer_id INT NULL,
 work_order_id INT NULL,
 activity VARCHAR(190) NOT NULL,
 hours DECIMAL(6,2) NOT NULL DEFAULT 0,
 hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
 billable TINYINT(1) NOT NULL DEFAULT 1,
 notes TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_time_date(work_date), INDEX idx_time_customer(customer_id), INDEX idx_time_workorder(work_order_id),
 CONSTRAINT fk_time_customer FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
 CONSTRAINT fk_time_workorder FOREIGN KEY(work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicles (
 id INT AUTO_INCREMENT PRIMARY KEY,
 registration VARCHAR(30) NOT NULL UNIQUE,
 brand VARCHAR(100) NULL,
 model VARCHAR(100) NULL,
 vehicle_type VARCHAR(40) NOT NULL DEFAULT 'bestelbus',
 year INT NULL,
 fuel_type VARCHAR(40) NULL,
 current_mileage INT NOT NULL DEFAULT 0,
 assigned_to VARCHAR(190) NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'actief',
 apk_expiry DATE NULL,
 insurance_expiry DATE NULL,
 lease_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicle_mileage (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_id INT NOT NULL,
 trip_date DATE NOT NULL,
 driver VARCHAR(190) NULL,
 start_mileage INT NOT NULL,
 end_mileage INT NOT NULL,
 business_km INT NOT NULL DEFAULT 0,
 private_km INT NOT NULL DEFAULT 0,
 from_location VARCHAR(190) NULL,
 to_location VARCHAR(190) NULL,
 purpose VARCHAR(255) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_mileage_vehicle(vehicle_id), INDEX idx_mileage_date(trip_date),
 CONSTRAINT fk_mileage_vehicle FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicle_costs (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_id INT NOT NULL,
 cost_date DATE NOT NULL,
 cost_type VARCHAR(50) NOT NULL,
 description VARCHAR(255) NULL,
 amount_ex_vat DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 supplier VARCHAR(190) NULL,
 receipt_url TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_vehicle_cost_vehicle(vehicle_id),
 CONSTRAINT fk_vehicle_cost_vehicle FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_id INT NOT NULL,
 maintenance_type VARCHAR(190) NOT NULL,
 description TEXT NULL,
 planned_date DATE NULL,
 completed_date DATE NULL,
 planned_mileage INT NULL,
 supplier VARCHAR(190) NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'gepland',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_maintenance_vehicle(vehicle_id),
 CONSTRAINT fk_maintenance_vehicle FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
 id INT AUTO_INCREMENT PRIMARY KEY,
 expense_date DATE NOT NULL,
 supplier VARCHAR(190) NULL,
 category VARCHAR(80) NOT NULL DEFAULT 'overig',
 description VARCHAR(255) NOT NULL,
 amount_ex_vat DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 payment_method VARCHAR(40) NULL,
 receipt_url TEXT NULL,
 deductible_percent DECIMAL(5,2) NOT NULL DEFAULT 100,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_expense_date(expense_date), INDEX idx_expense_category(category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_items (
 id INT AUTO_INCREMENT PRIMARY KEY,
 sku VARCHAR(80) NULL UNIQUE,
 name VARCHAR(190) NOT NULL,
 description TEXT NULL,
 unit VARCHAR(30) NOT NULL DEFAULT 'stuk',
 purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
 sales_price DECIMAL(12,2) NOT NULL DEFAULT 0,
 vat_rate DECIMAL(5,2) NOT NULL DEFAULT 21,
 stock DECIMAL(12,2) NOT NULL DEFAULT 0,
 minimum_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;
