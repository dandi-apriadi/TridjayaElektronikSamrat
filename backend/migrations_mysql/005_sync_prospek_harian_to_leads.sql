INSERT INTO leads (
    id,
    agent_id,
    customer_name,
    phone_number,
    interested_product,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    p.id,
    p.karyawan_id,
    p.nama_prospek,
    COALESCE(NULLIF(p.no_whatsapp, ''), p.nomor_hp),
    COALESCE(NULLIF(p.minat_barang, ''), p.alamat),
    CASE p.status_prospek
        WHEN 'deal' THEN 'Closed Won'
        WHEN 'not_deal' THEN 'Closed Lost'
        WHEN 'polling' THEN 'Negosiasi'
        ELSE 'Follow Up'
    END,
    CONCAT(
        'Sumber: Prospek Harian Karyawan | Cabang: ', p.cabang,
        ' | Divisi: ', p.divisi,
        CASE
            WHEN COALESCE(p.keterangan_prospek, '') <> '' THEN CONCAT(' | Keterangan: ', p.keterangan_prospek)
            ELSE ''
        END,
        CASE
            WHEN COALESCE(p.keterangan_fincoy, '') <> '' THEN CONCAT(' | Fincoy: ', p.keterangan_fincoy)
            ELSE ''
        END
    ),
    p.created_at,
    p.created_at
FROM prospek_harian p
LEFT JOIN leads l ON l.id = p.id
WHERE l.id IS NULL
  AND COALESCE(NULLIF(p.no_whatsapp, ''), p.nomor_hp, '') <> ''
  AND COALESCE(NULLIF(p.minat_barang, ''), p.alamat, '') <> '';
