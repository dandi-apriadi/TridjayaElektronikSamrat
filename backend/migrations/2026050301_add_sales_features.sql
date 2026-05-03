-- Add sales support to users and delivery schedules
ALTER TABLE users ADD COLUMN whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN referral_slug TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_referral_slug ON users(referral_slug);
CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp);

CREATE TABLE IF NOT EXISTS sales_delivery_schedules (
    id TEXT PRIMARY KEY,
    sales_user_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    address TEXT NOT NULL,
    sales_name TEXT NOT NULL,
    sender_branch TEXT NOT NULL,
    referral_slug TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sales_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_delivery_schedules_sales_user ON sales_delivery_schedules(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_schedules_created_at ON sales_delivery_schedules(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_schedules_referral_slug ON sales_delivery_schedules(referral_slug);
