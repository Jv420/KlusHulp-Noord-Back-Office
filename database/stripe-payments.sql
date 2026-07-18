-- KlusHulp Noord - Stripe Checkout en Terminal uitbreiding
-- Veilig opnieuw uitvoerbaar voor MariaDB/MySQL waar kolommen nog niet bestaan.

CREATE TABLE IF NOT EXISTS stripe_events (
 id VARCHAR(255) NOT NULL PRIMARY KEY,
 event_type VARCHAR(120) NOT NULL,
 processed_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Voer onderstaande ALTER-regels alleen uit als de kolom nog niet bestaat.
-- De applicatie controleert dit daarnaast automatisch via INFORMATION_SCHEMA.
ALTER TABLE documents ADD COLUMN stripe_checkout_session_id VARCHAR(255) NULL;
ALTER TABLE documents ADD COLUMN stripe_payment_intent_id VARCHAR(255) NULL;
ALTER TABLE documents ADD COLUMN stripe_receipt_url TEXT NULL;
ALTER TABLE documents ADD COLUMN stripe_payment_method VARCHAR(60) NULL;

CREATE INDEX idx_documents_stripe_session ON documents(stripe_checkout_session_id);
CREATE INDEX idx_documents_stripe_intent ON documents(stripe_payment_intent_id);
