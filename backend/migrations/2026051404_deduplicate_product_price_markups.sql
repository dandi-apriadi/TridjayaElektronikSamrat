UPDATE product_price_markups
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE is_active = 1
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY scope, COALESCE(lower(trim(target_value)), '__all__')
          ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
        ) AS row_number
      FROM product_price_markups
      WHERE is_active = 1
    )
    WHERE row_number = 1
  );
