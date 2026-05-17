UPDATE users
SET jabatan = 'sales'
WHERE role = 'admin-sales'
  AND (jabatan IS NULL OR jabatan = '' OR jabatan = 'non_sales');

UPDATE users
SET referral_slug = CONCAT('sales-', LEFT(id, 8))
WHERE role = 'admin-sales'
  AND (referral_slug IS NULL OR referral_slug = '');

INSERT INTO referrals (id, slug, owner_user_id, label, target_path, is_active)
SELECT UUID(), u.referral_slug, u.id, u.name, '/produk', u.is_active
FROM users u
WHERE u.role = 'admin-sales'
  AND u.referral_slug <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM referrals r
      WHERE r.owner_user_id = u.id OR r.slug = u.referral_slug
  );

UPDATE referrals r
JOIN users u ON u.id = r.owner_user_id
SET r.is_active = u.is_active,
    r.label = u.name,
    r.target_path = CASE WHEN r.target_path IS NULL OR r.target_path = '' THEN '/produk' ELSE r.target_path END
WHERE u.role = 'admin-sales';
