-- Add marketing fields to products table
ALTER TABLE products ADD COLUMN highlights TEXT; -- JSON array
ALTER TABLE products ADD COLUMN selling_points TEXT; -- JSON array
ALTER TABLE products ADD COLUMN objections TEXT; -- JSON array
