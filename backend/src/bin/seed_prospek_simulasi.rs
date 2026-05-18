use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime};
use dotenvy::dotenv;
use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlPoolOptions, MySqlPool, Row};
use std::{env, fs, path::PathBuf};
use uuid::Uuid;

const SIMULATION_MARKER: &str = "SIMULASI_EXCEL_PROSPEK_MEI_2026";

#[derive(Debug, Deserialize)]
struct SourceData {
    prospects: Vec<SourceProspect>,
}

#[derive(Debug, Deserialize)]
struct SourceProspect {
    source: String,
    name: String,
    phone: String,
    product: String,
    note: String,
    status: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct SimulationManifest {
    ids: Vec<String>,
}

#[derive(Debug, Clone)]
struct Employee {
    id: String,
    name: String,
    divisi: String,
    jabatan: String,
    cabang_id: String,
    cabang_name: String,
}

#[derive(Debug, Clone, Copy)]
enum SimulationScenario {
    MajorityReached,
    MajorityBelowTarget,
    Balanced,
    SomeEmployeesBelowTarget,
}

impl SimulationScenario {
    fn from_env() -> Self {
        let value = env::var("PROSPEK_SIMULATION_SCENARIO")
            .unwrap_or_else(|_| "majority_reached".to_string())
            .trim()
            .to_lowercase()
            .replace([' ', '-'], "_");

        match value.as_str() {
            "majority_below_target"
            | "majority_below"
            | "below_target"
            | "kurang_target"
            | "mayoritas_kurang"
            | "tidak_tercapai" => Self::MajorityBelowTarget,
            "balanced" | "imbang" | "campuran" | "mixed" => Self::Balanced,
            "some_below_target"
            | "some_below"
            | "beberapa_kurang"
            | "april_some_below"
            | "april_kurang_target" => Self::SomeEmployeesBelowTarget,
            _ => Self::MajorityReached,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::MajorityReached => "majority_reached",
            Self::MajorityBelowTarget => "majority_below_target",
            Self::Balanced => "balanced",
            Self::SomeEmployeesBelowTarget => "some_employees_below_target",
        }
    }

    fn reached_threshold(self) -> usize {
        match self {
            Self::MajorityReached => 72,
            Self::MajorityBelowTarget => 28,
            Self::Balanced => 50,
            Self::SomeEmployeesBelowTarget => 82,
        }
    }
}

fn normalize_target_kategori(jabatan: &str, divisi: &str) -> &'static str {
    let normalized_jabatan = jabatan.trim().to_lowercase().replace([' ', '-'], "_");

    if matches!(normalized_jabatan.as_str(), "non_sales" | "nonsales") {
        return "non_sales";
    }

    if normalized_jabatan == "sales" {
        return "sales";
    }

    let normalized_divisi = divisi.trim().to_lowercase().replace([' ', '-'], "_");
    if normalized_divisi == "sales" || normalized_divisi.starts_with("sales_") {
        "sales"
    } else {
        "non_sales"
    }
}

fn target_for_category(target_kategori: &str) -> usize {
    if target_kategori == "sales" {
        20
    } else {
        5
    }
}

fn simulated_prospect_count(
    employee_index: usize,
    day_index: usize,
    target: usize,
    scenario: SimulationScenario,
) -> usize {
    if target == 0 {
        return 0;
    }

    if matches!(scenario, SimulationScenario::SomeEmployeesBelowTarget) {
        if employee_index % 4 == 0 {
            let shortfall = 1 + ((employee_index + day_index) % target.max(1));
            return target.saturating_sub(shortfall);
        }

        let extra = 1 + ((employee_index * 7 + day_index * 5) % 6);
        return target + extra;
    }

    let seed = (employee_index * 37 + day_index * 19 + target * 11) % 100;
    let reaches_target = seed < scenario.reached_threshold();

    if reaches_target {
        let extra = (employee_index * 7 + day_index * 5) % 6;
        target + extra
    } else {
        let shortfall = 1 + ((employee_index * 5 + day_index * 3) % target.max(1));
        target.saturating_sub(shortfall)
    }
}

fn lead_status(status: &str) -> &'static str {
    match status {
        "deal" => "Closed Won",
        "not_deal" => "Closed Lost",
        "polling" => "Negosiasi",
        _ => "Follow Up",
    }
}

fn simulation_end_date() -> NaiveDate {
    if let Ok(value) = env::var("SIMULATION_END_DATE") {
        if let Ok(date) = NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d") {
            return date;
        }
    }
    Local::now().date_naive()
}

fn simulation_marker() -> String {
    env::var("PROSPEK_SIMULATION_MARKER")
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| SIMULATION_MARKER.to_string())
}

fn source_json_path() -> PathBuf {
    env::var("PROSPEK_SOURCE_JSON")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("../scratch/prospek_source.json"))
}

fn manifest_path() -> PathBuf {
    env::var("PROSPEK_SIMULATION_MANIFEST")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("../scratch/prospek_simulation_manifest.json"))
}

fn contains_financing_hint(text: &str) -> bool {
    let note = text.trim().to_lowercase();
    note.contains("kredit")
        || note.contains("cash tempo")
        || note.contains("cicilan")
        || note.contains("dp")
}

fn choose_variant<'a>(variants: &'a [&'a str], index: usize) -> &'a str {
    variants[index % variants.len()]
}

fn build_field_note(index: usize, prospect: &SourceProspect, employee: &Employee) -> String {
    let product = prospect.product.trim();
    let divisi = employee.divisi.trim();
    let note_hint = prospect.note.trim().to_lowercase();

    let text = match prospect.status.as_str() {
        "deal" => {
            let variants = [
                "sudah cocok, tinggal proses administrasi",
                "siap lanjut, minta kirim invoice hari ini",
                "fix ambil, tinggal atur pengiriman",
                "sudah setuju harga, menunggu pembayaran masuk",
            ];
            choose_variant(&variants, index).to_string()
        }
        "not_deal" => {
            let variants = [
                "sementara batal, masih bandingkan di tempat lain",
                "belum jadi ambil karena budget belum masuk",
                "barang ditunda dulu, minta dihubungi bulan depan",
                "belum lanjut, keluarga masih pertimbangkan",
            ];
            choose_variant(&variants, index).to_string()
        }
        "polling" => {
            let variants = [
                "masih compare cicilan dan spesifikasi, follow up 2 hari lagi",
                "minta dikirim simulasi angsuran dan opsi warna",
                "masih diskusi dengan pasangan, tunggu kabar sore",
                "masih hitung budget, tertarik tapi belum putus",
            ];
            choose_variant(&variants, index).to_string()
        }
        "fu_ulang" => {
            let variants = [
                "sudah sempat chat, minta di-follow up kembali besok",
                "sudah lihat barang, tunggu kabar setelah diskusi keluarga",
                "minta diingatkan lagi akhir pekan",
                "sudah respon, belum sempat datang ke toko",
            ];
            choose_variant(&variants, index).to_string()
        }
        _ => {
            let variants = [
                "baru tanya stok dan harga, minta dikirim foto unit",
                "minta brosur dan simulasi cicilan via WhatsApp",
                "tertarik, rencana datang lihat barang langsung",
                "baru tanya spesifikasi, follow up sore ini",
            ];
            choose_variant(&variants, index).to_string()
        }
    };

    let mut extras = Vec::new();
    if !product.is_empty() {
        let product_variants = [
            format!("minat ke {}", product),
            format!("fokus di {}", product),
            format!("yang ditanya {}", product),
        ];
        extras.push(product_variants[index % product_variants.len()].clone());
    }
    if !divisi.is_empty() && index % 5 == 0 {
        extras.push(format!("ditangani tim {}", divisi));
    }
    if !note_hint.is_empty() {
        if note_hint.contains("cash") {
            extras.push("condong bayar cash".to_string());
        } else if note_hint.contains("kredit") {
            extras.push("lebih cocok opsi kredit".to_string());
        } else if note_hint.contains("fu") {
            extras.push("perlu follow up ulang".to_string());
        }
    }

    if extras.is_empty() {
        text
    } else {
        format!("{}; {}", text, extras.join(", "))
    }
}

fn build_fincoy(index: usize, prospect: &SourceProspect) -> String {
    if prospect.status == "deal"
        || prospect.status == "polling"
        || contains_financing_hint(&prospect.note)
    {
        let variants = ["FIF", "SPEKTRA", "ADIRA", "HOME CREDIT", "BCA FINANCE"];
        choose_variant(&variants, index).to_string()
    } else {
        String::new()
    }
}

async fn fetch_employees(pool: &MySqlPool) -> Result<Vec<Employee>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT u.id, u.name, COALESCE(NULLIF(u.divisi, ''), 'Karyawan') AS divisi, \
         COALESCE(u.jabatan, '') AS jabatan, COALESCE(u.cabang_id, '') AS cabang_id, \
         COALESCE(c.nama, '') AS cabang_name \
         FROM users u \
         LEFT JOIN cabang c ON c.id = u.cabang_id \
         WHERE LOWER(TRIM(u.role)) = 'karyawan' AND u.is_active = 1 AND u.is_verified = 1 \
         ORDER BY u.name ASC",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| Employee {
            id: row.get("id"),
            name: row.get("name"),
            divisi: row.get("divisi"),
            jabatan: row.get("jabatan"),
            cabang_id: row.get("cabang_id"),
            cabang_name: row.get("cabang_name"),
        })
        .collect())
}

async fn reset_previous_simulation(
    pool: &MySqlPool,
    manifest_file: &PathBuf,
    marker: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if manifest_file.exists() {
        let manifest_text = fs::read_to_string(manifest_file)?;
        let manifest: SimulationManifest = serde_json::from_str(&manifest_text)?;
        if !manifest.ids.is_empty() {
            for id in manifest.ids {
                sqlx::query("DELETE FROM leads WHERE id = ?")
                    .bind(&id)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM prospek_harian WHERE id = ?")
                    .bind(&id)
                    .execute(pool)
                    .await?;
            }
            return Ok(());
        }
    }

    let pattern = format!("%{}%", marker);
    sqlx::query("DELETE FROM leads WHERE notes LIKE ?")
        .bind(&pattern)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM prospek_harian WHERE keterangan_prospek LIKE ?")
        .bind(&pattern)
        .execute(pool)
        .await?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let source_path = source_json_path();
    let manifest_file = manifest_path();
    let marker = simulation_marker();
    let source_text = fs::read_to_string(&source_path)?;
    let source: SourceData = serde_json::from_str(&source_text)?;
    let employees = fetch_employees(&pool).await?;

    if employees.is_empty() {
        return Err("Tidak ada karyawan aktif dan verified untuk diisi prospek simulasi".into());
    }
    if source.prospects.is_empty() {
        return Err(format!("Tidak ada data prospek di {}", source_path.display()).into());
    }

    let end_date = simulation_end_date();
    let start_date = NaiveDate::from_ymd_opt(end_date.year(), end_date.month(), 1)
        .ok_or("Tanggal awal bulan tidak valid")?;
    let day_count = (end_date - start_date).num_days() + 1;
    let dates = (0..day_count)
        .map(|offset| start_date + Duration::days(offset))
        .collect::<Vec<_>>();

    reset_previous_simulation(&pool, &manifest_file, &marker).await?;

    let scenario = SimulationScenario::from_env();
    let mut inserted = 0usize;
    let mut reached_cells = 0usize;
    let mut below_target_cells = 0usize;
    let mut inserted_ids = Vec::new();
    let mut employee_monthly_summaries = Vec::new();

    for (employee_index, employee) in employees.iter().enumerate() {
        let target_kategori = normalize_target_kategori(&employee.jabatan, &employee.divisi);
        let daily_target = target_for_category(target_kategori);
        let monthly_target = daily_target * dates.len();
        let mut employee_monthly_total = 0usize;

        for (day_index, date) in dates.iter().enumerate() {
            let daily_count =
                simulated_prospect_count(employee_index, day_index, daily_target, scenario);
            employee_monthly_total += daily_count;
            if daily_count >= daily_target {
                reached_cells += 1;
            } else {
                below_target_cells += 1;
            }

            for item_index in 0..daily_count {
                let index = inserted;
                let prospect = &source.prospects[index % source.prospects.len()];
                let hour = 9 + ((item_index * 2 + employee_index + day_index) % 9) as u32;
                let minute = ((index * 13 + item_index * 7) % 60) as u32;
                let created_at = NaiveDateTime::new(
                    *date,
                    NaiveTime::from_hms_opt(hour, minute, 0).unwrap_or(NaiveTime::MIN),
                );
                let id = Uuid::new_v4().to_string();
                let cabang = if employee.cabang_name.trim().is_empty() {
                    if employee.cabang_id.trim().is_empty() {
                        "Cabang belum diatur"
                    } else {
                        employee.cabang_id.as_str()
                    }
                } else {
                    employee.cabang_name.as_str()
                };
                let note = format!(
                    "{} | {} | target_harian={} | total_hari_ini={}",
                    build_field_note(index, prospect, employee),
                    marker,
                    daily_target,
                    daily_count
                );
                let fincoy = build_fincoy(index, prospect);
                let lead_note = format!(
                    "Sumber: Prospek Harian Karyawan | {} | scenario={} | Cabang: {} | Divisi: {} | Sumber data: {}",
                    marker,
                    scenario.label(),
                    cabang,
                    employee.divisi,
                    prospect.source
        );

                sqlx::query(
                    "INSERT INTO prospek_harian \
             (id, karyawan_id, karyawan_nama, tanggal, cabang, divisi, target_kategori, \
              nama_prospek, no_whatsapp, nomor_hp, minat_barang, alamat, keterangan_prospek, \
              status_prospek, keterangan_fincoy, created_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&id)
                .bind(&employee.id)
                .bind(&employee.name)
                .bind(*date)
                .bind(cabang)
                .bind(&employee.divisi)
                .bind(target_kategori)
                .bind(prospect.name.trim().to_uppercase())
                .bind(&prospect.phone)
                .bind(&prospect.phone)
                .bind(prospect.product.trim().to_uppercase())
                .bind(prospect.product.trim().to_uppercase())
                .bind(&note)
                .bind(&prospect.status)
                .bind(&fincoy)
                .bind(created_at)
                .execute(&pool)
                .await?;

                sqlx::query(
            "INSERT INTO leads \
             (id, agent_id, customer_name, phone_number, interested_product, status, notes, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
             ON DUPLICATE KEY UPDATE agent_id = VALUES(agent_id), customer_name = VALUES(customer_name), \
             phone_number = VALUES(phone_number), interested_product = VALUES(interested_product), \
             status = VALUES(status), notes = VALUES(notes), updated_at = VALUES(updated_at)",
        )
        .bind(&id)
        .bind(&employee.id)
        .bind(prospect.name.trim().to_uppercase())
        .bind(&prospect.phone)
        .bind(prospect.product.trim().to_uppercase())
        .bind(lead_status(&prospect.status))
        .bind(&lead_note)
        .bind(created_at)
        .bind(created_at)
        .execute(&pool)
        .await?;

                inserted += 1;
                inserted_ids.push(id);
            }
        }

        employee_monthly_summaries.push((
            employee.name.clone(),
            target_kategori.to_string(),
            monthly_target,
            employee_monthly_total,
        ));
    }

    if let Some(parent) = manifest_file.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        &manifest_file,
        serde_json::to_string_pretty(&SimulationManifest { ids: inserted_ids })?,
    )?;

    println!(
        "Inserted {} simulated prospects for {} employees from {} to {} using {}",
        inserted,
        employees.len(),
        start_date,
        end_date,
        source_path.display()
    );
    println!(
        "Scenario: {}. Marker: {}. Reached target cells: {}. Below target cells: {}. Manifest: {}",
        scenario.label(),
        marker,
        reached_cells,
        below_target_cells,
        manifest_file.display()
    );
    for (name, target_kategori, monthly_target, monthly_total) in employee_monthly_summaries
        .iter()
        .filter(|(_, _, monthly_target, monthly_total)| monthly_total < monthly_target)
    {
        println!(
            "Below monthly target: {} ({}) = {}/{}",
            name, target_kategori, monthly_total, monthly_target
        );
    }

    Ok(())
}
