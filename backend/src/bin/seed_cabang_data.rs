use dotenvy::dotenv;
use sqlx::mysql::MySqlPoolOptions;
use std::env;

fn ensure_destructive_allowed() -> Result<(), Box<dyn std::error::Error>> {
    let flag = env::var("ALLOW_DESTRUCTIVE").unwrap_or_default();
    if flag != "yes-i-mean-it" {
        return Err(
            "Refusing to run destructive tool without ALLOW_DESTRUCTIVE=yes-i-mean-it".into(),
        );
    }
    Ok(())
}

struct CabangSeed<'a> {
    id: &'a str,
    nama: &'a str,
    alamat: &'a str,
    kota: &'a str,
    telepon: &'a str,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    ensure_destructive_allowed()?;

    let database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL must be set in backend/.env or environment")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let rows = [
        CabangSeed {
            id: "samrat-manado",
            nama: "Samrat",
            alamat: "Jl. Sam Ratulangi No. 7, Wenang Utara, Kec. Wenang, Kota Manado, Sulawesi Utara 95111",
            kota: "Manado",
            telepon: "",
        },
        CabangSeed {
            id: "bahu-manado",
            nama: "Bahu",
            alamat: "Jl. Wolter Monginsidi, Bahu, Kec. Malalayang, Kota Manado, Sulawesi Utara",
            kota: "Manado",
            telepon: "",
        },
        CabangSeed {
            id: "pagaden-subang",
            nama: "Pagaden",
            alamat: "Samping SPBU Pertamina, Jl. Subang Pamanukan, Pangsor, Kec. Pagaden, Kabupaten Subang, Jawa Barat 41252",
            kota: "Pagaden",
            telepon: "0813-2231-7994",
        },
        CabangSeed {
            id: "soklat-subang",
            nama: "Soklat",
            alamat: "Jl. Mayjend DI Panjaitan (Samping Pos Tridjaya Motor Soklat), Kel. Soklat, Subang, Jawa Barat",
            kota: "Subang",
            telepon: "",
        },
        CabangSeed {
            id: "haurgeulis-indramayu",
            nama: "Haurgeulis",
            alamat: "Jl. Jenderal Sudirman, Cipancuh, Kec. Haurgeulis, Kabupaten Indramayu, Jawa Barat",
            kota: "Indramayu",
            telepon: "0812-9776-9307",
        },
        CabangSeed {
            id: "cilacap-cilacap",
            nama: "Cilacap",
            alamat: "Jl. Mayjen Sutoyo, Komplek ex GIANT, Cilacap Tengah, Kab. Cilacap, Jawa Tengah",
            kota: "Cilacap",
            telepon: "",
        },
        CabangSeed {
            id: "cikampek-karawang",
            nama: "Cikampek",
            alamat: "Jl. Ahmad Yani, Cikampek Selatan, Kec. Cikampek, Karawang, Jawa Barat 41373",
            kota: "Karawang",
            telepon: "",
        },
        CabangSeed {
            id: "pamanukan-subang",
            nama: "Pamanukan",
            alamat: "Jl. Ion Martasasmita No. 16, Rancasari, Kec. Pamanukan, Kabupaten Subang, Jawa Barat 41254",
            kota: "Subang",
            telepon: "",
        },
        CabangSeed {
            id: "pabuaran-subang",
            nama: "Pabuaran",
            alamat: "Jl. KP Krajan Pabuaran No. 15, Pabuaran, Subang, Jawa Barat",
            kota: "Subang",
            telepon: "",
        },
        CabangSeed {
            id: "purwadadi-subang",
            nama: "Purwadadi",
            alamat: "Jl. Raya Purwadadi, Kabupaten Subang, Jawa Barat",
            kota: "Subang",
            telepon: "",
        },
        CabangSeed {
            id: "patokbeusi-subang",
            nama: "Patokbeusi",
            alamat: "Desa Gempolsari, Kecamatan Patokbeusi, Kabupaten Subang, Jawa Barat",
            kota: "Subang",
            telepon: "",
        },
        CabangSeed {
            id: "cibaduyut-bandung",
            nama: "Cibaduyut",
            alamat: "Jl. Cibaduyut Lama No. 10, Bandung, Jawa Barat",
            kota: "Bandung",
            telepon: "",
        },
        CabangSeed {
            id: "cimalaka-sumedang",
            nama: "Cimalaka",
            alamat: "Jl. Cimalaka, Kab. Sumedang, Jawa Barat",
            kota: "Sumedang",
            telepon: "",
        },
    ];

    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM cabang").execute(&mut *tx).await?;

    for row in rows {
        sqlx::query(
            "INSERT INTO cabang (id, nama, alamat, kota, telepon, is_active)
             VALUES (?, ?, ?, ?, ?, 1)",
        )
        .bind(row.id)
        .bind(row.nama)
        .bind(row.alamat)
        .bind(row.kota)
        .bind(row.telepon)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cabang")
        .fetch_one(&pool)
        .await?;

    println!("Seeded {} cabang rows", count);
    Ok(())
}
