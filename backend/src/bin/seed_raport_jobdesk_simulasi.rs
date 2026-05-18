use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime};
use dotenvy::dotenv;
use serde::Deserialize;
use sqlx::{mysql::MySqlPoolOptions, MySqlPool, Row};
use std::env;
use uuid::Uuid;

const SIMULATION_MARKER: &str = "SIMULASI_RAPORT_JOBDESK_MEI_2026";

#[derive(Debug, Clone)]
struct Employee {
    id: String,
    name: String,
    divisi: String,
    jabatan: String,
    cabang_id: String,
    cabang_name: String,
}

#[derive(Debug, Clone, Deserialize)]
struct JobdeskDivision {
    id: String,
    posisi: String,
    jobdesks: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct JobdeskDivisionSettings {
    #[serde(default)]
    divisions: Vec<JobdeskDivision>,
}

#[derive(Debug, Clone, Copy)]
enum ComplianceProfile {
    Excellent,
    Good,
    Stable,
    NeedsFollowUp,
    LateOften,
    IncompleteEvidence,
    LowDiscipline,
    RepeatedViolation,
    AttendanceIssue,
    SevereNonCompliant,
}

impl ComplianceProfile {
    fn for_index(index: usize) -> Self {
        match index % 10 {
            0 => Self::Excellent,
            1 => Self::Good,
            2 => Self::Stable,
            3 => Self::NeedsFollowUp,
            4 => Self::LateOften,
            5 => Self::IncompleteEvidence,
            6 => Self::LowDiscipline,
            7 => Self::RepeatedViolation,
            8 => Self::AttendanceIssue,
            _ => Self::SevereNonCompliant,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Excellent => "patuh_sangat_baik",
            Self::Good => "patuh",
            Self::Stable => "stabil",
            Self::NeedsFollowUp => "perlu_follow_up",
            Self::LateOften => "sering_terlambat",
            Self::IncompleteEvidence => "bukti_tidak_lengkap",
            Self::LowDiscipline => "disiplin_rendah",
            Self::RepeatedViolation => "pelanggaran_berulang",
            Self::AttendanceIssue => "masalah_absensi",
            Self::SevereNonCompliant => "tidak_patuh_berat",
        }
    }

    fn base_score(self) -> i32 {
        match self {
            Self::Excellent => 96,
            Self::Good => 91,
            Self::Stable => 86,
            Self::NeedsFollowUp => 79,
            Self::LateOften => 74,
            Self::IncompleteEvidence => 68,
            Self::LowDiscipline => 58,
            Self::RepeatedViolation => 48,
            Self::AttendanceIssue => 42,
            Self::SevereNonCompliant => 35,
        }
    }

    fn is_non_compliant(self) -> bool {
        matches!(
            self,
            Self::LowDiscipline
                | Self::RepeatedViolation
                | Self::AttendanceIssue
                | Self::SevereNonCompliant
        )
    }
}

struct SimulatedRow {
    completed: bool,
    mode: &'static str,
    evidence_url: String,
    employee_note: String,
    review_status: &'static str,
    score: i32,
    reviewer_comment: String,
    submitted_at: NaiveDateTime,
    reviewed_at: NaiveDateTime,
    violation: bool,
}

fn normalize_key(value: &str) -> String {
    value
        .chars()
        .filter(|char| char.is_ascii_alphanumeric())
        .flat_map(|char| char.to_lowercase())
        .collect()
}

fn fallback_jobdesk_divisions() -> Vec<JobdeskDivision> {
    vec![
        JobdeskDivision {
            id: "sales-elektronik".to_string(),
            posisi: "Sales Elektronik".to_string(),
            jobdesks: vec![
                "Komentar di FB minimal 5".to_string(),
                "Broadcast WA pribadi ke 100 orang".to_string(),
                "Update katalog dengan design promo terbaru".to_string(),
                "Laporan buku tamu harian walk in dan prospek".to_string(),
                "Upload video konten di TikTok setiap hari".to_string(),
                "Kirim prospek min 20 per hari".to_string(),
            ],
        },
        JobdeskDivision {
            id: "driver".to_string(),
            posisi: "Driver".to_string(),
            jobdesks: vec![
                "Laporan perawatan mobil pagi hari".to_string(),
                "Serah terima uang ke kasir/admin".to_string(),
                "Video pengantaran dengan musik dan woro-woro".to_string(),
                "Minimal 8 pengiriman per hari".to_string(),
                "Foto dengan konsumen/tetangga bagi brosur min 10".to_string(),
                "Kirim prospek per hari minimal 5".to_string(),
            ],
        },
        JobdeskDivision {
            id: "admin-stok".to_string(),
            posisi: "Admin Stok".to_string(),
            jobdesks: vec![
                "Laporan mutasi barang dan rekap mutasi".to_string(),
                "Stock opname harian dan laporan ke grup".to_string(),
                "Update data indent ke grup".to_string(),
                "Semua barang wajib ada price tag".to_string(),
                "Update stok ke sistem".to_string(),
                "Upload video konten di TikTok setiap hari".to_string(),
            ],
        },
        JobdeskDivision {
            id: "kasir".to_string(),
            posisi: "Kasir".to_string(),
            jobdesks: vec![
                "Penerimaan pembayaran cocok dengan SPK".to_string(),
                "Setor uang ke bank di hari yang sama".to_string(),
                "Pendingan uang muka maksimal 1 hari".to_string(),
                "BC konsumen lama/RO minimal 20 konsumen".to_string(),
                "Cek piutang dan tagih yang belum close".to_string(),
                "Kirim prospek per hari minimal 5".to_string(),
            ],
        },
        JobdeskDivision {
            id: "support-online".to_string(),
            posisi: "Support Online".to_string(),
            jobdesks: vec![
                "Broadcast minimal 200 orang".to_string(),
                "Mendapatkan 5 prospek per cabang per hari".to_string(),
                "Mengurus alur sosmed yang ada".to_string(),
                "Share postingan ke lebih dari 100 grup".to_string(),
                "Upload video konten di TikTok setiap hari".to_string(),
                "Live TikTok minimal sejam sehari".to_string(),
            ],
        },
        JobdeskDivision {
            id: "karyawan-operasional".to_string(),
            posisi: "Karyawan Operasional".to_string(),
            jobdesks: vec![
                "Briefing pagi dan cek area kerja".to_string(),
                "Update laporan kerja harian".to_string(),
                "Tambah kontak baru minimal 5".to_string(),
                "Share promo ke database pelanggan".to_string(),
                "Dokumentasi aktivitas kerja".to_string(),
                "Kirim prospek per hari minimal 5".to_string(),
            ],
        },
    ]
}

fn target_category(jabatan: &str, divisi: &str) -> &'static str {
    let normalized_jabatan = jabatan.trim().to_lowercase().replace([' ', '-'], "_");
    if normalized_jabatan == "sales" {
        return "sales";
    }
    if normalized_jabatan == "non_sales" || normalized_jabatan == "nonsales" {
        return "non_sales";
    }
    if divisi.trim().to_lowercase().contains("sales") {
        "sales"
    } else {
        "non_sales"
    }
}

fn date_from_env(name: &str) -> Option<NaiveDate> {
    env::var(name)
        .ok()
        .and_then(|value| NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d").ok())
}

fn simulation_dates() -> Result<Vec<NaiveDate>, Box<dyn std::error::Error>> {
    let today = Local::now().date_naive();
    let default_start =
        NaiveDate::from_ymd_opt(today.year(), 5, 1).ok_or("Tanggal awal tidak valid")?;
    let default_end = if today.month() == 5 {
        today
    } else {
        NaiveDate::from_ymd_opt(today.year(), 5, 31).ok_or("Tanggal akhir tidak valid")?
    };
    let start = date_from_env("RAPORT_SIMULATION_START").unwrap_or(default_start);
    let end = date_from_env("RAPORT_SIMULATION_END").unwrap_or(default_end);
    if start > end {
        return Err(
            "RAPORT_SIMULATION_START tidak boleh lebih besar dari RAPORT_SIMULATION_END".into(),
        );
    }
    let total_days = (end - start).num_days();
    Ok((0..=total_days)
        .map(|offset| start + Duration::days(offset))
        .collect())
}

fn choose_evidence_url(seed: usize) -> String {
    let images = [
        "/uploads/raport/132c1988-d0c2-4c66-af56-7d03fe169704_raport.png",
        "/uploads/raport/d19742e6-e697-40d8-9d98-5bd8f28bc9ff_raport.png",
        "/uploads/raport/c5a6690c-e857-41f9-9179-6687729ef3c8_raport.webp",
        "/uploads/raport/20f2a00f-1da6-4d34-8199-f0571ff2b8a6_raport.webp",
        "/uploads/raport/20e03f5f-0ea3-4480-ad3b-0c1969e3d012_raport.png",
    ];
    images[seed % images.len()].to_string()
}

fn employee_note(jobdesk: &str, score: i32, late: bool, marker: &str) -> String {
    let base = if score >= 90 {
        "Sudah dikerjakan sesuai instruksi, bukti dikirim setelah selesai aktivitas."
    } else if score >= 80 {
        "Pekerjaan selesai, ada sedikit catatan pada kelengkapan dokumentasi."
    } else if score >= 65 {
        "Pekerjaan dilakukan, tetapi bukti dan keterangan masih kurang rapi."
    } else {
        "Jobdesk belum tuntas sesuai standar harian."
    };
    let late_note = if late {
        " Upload melewati jam tutup raport."
    } else {
        ""
    };
    format!("{base}{late_note} Jobdesk: {jobdesk}. {marker}")
}

fn reviewer_comment(score: i32, violation: Option<&str>, late: bool) -> String {
    if let Some(reason) = violation {
        return format!(
            "Pelanggaran: {reason}. Karyawan tidak patuh pada SOP laporan harian, nilai dibuat 0 dan wajib pembinaan."
        );
    }
    if score >= 94 {
        "Bukti jelas, pekerjaan selesai tepat waktu, dan hasil sesuai standar cabang.".to_string()
    } else if score >= 86 {
        "Hasil pekerjaan baik. Pertahankan konsistensi bukti dan update di grup.".to_string()
    } else if score >= 78 {
        "Pekerjaan selesai, namun detail bukti perlu dibuat lebih lengkap agar mudah diverifikasi."
            .to_string()
    } else if late {
        "Laporan diterima, tetapi upload melewati batas waktu. Nilai dikurangi karena kedisiplinan."
            .to_string()
    } else {
        "Perlu follow up PIC. Beberapa bagian jobdesk belum terlihat jelas dari bukti yang dikirim."
            .to_string()
    }
}

fn simulate_row(
    employee_index: usize,
    day_index: usize,
    jobdesk_index: usize,
    date: NaiveDate,
    jobdesk: &str,
    profile: ComplianceProfile,
    marker: &str,
) -> SimulatedRow {
    let seed = employee_index * 97 + day_index * 31 + jobdesk_index * 17;
    let severe_violation = match profile {
        ComplianceProfile::RepeatedViolation => seed % 13 == 0,
        ComplianceProfile::AttendanceIssue => jobdesk_index == 0 && day_index % 5 == 1,
        ComplianceProfile::SevereNonCompliant => {
            seed % 7 == 0 || (day_index % 4 == 2 && jobdesk_index < 2)
        }
        _ => false,
    };
    let missing_evidence = match profile {
        ComplianceProfile::IncompleteEvidence => seed % 8 == 0,
        ComplianceProfile::LowDiscipline => seed % 6 == 0,
        ComplianceProfile::RepeatedViolation => seed % 5 == 0,
        ComplianceProfile::SevereNonCompliant => seed % 4 == 0,
        _ => false,
    };
    let late = matches!(
        profile,
        ComplianceProfile::LateOften | ComplianceProfile::AttendanceIssue
    ) && seed % 4 == 0;
    let submitted_hour = if late {
        19 + (seed % 2) as u32
    } else {
        9 + (seed % 8) as u32
    };
    let submitted_minute = ((seed * 7) % 60) as u32;
    let submitted_at = NaiveDateTime::new(
        date,
        NaiveTime::from_hms_opt(submitted_hour, submitted_minute, 0).unwrap_or(NaiveTime::MIN),
    );
    let reviewed_at = submitted_at + Duration::minutes(35 + (seed % 90) as i64);

    let violation_reason = if severe_violation {
        if matches!(profile, ComplianceProfile::AttendanceIssue) {
            Some("tidak mengikuti briefing pagi dan laporan pertama kosong")
        } else if jobdesk.to_lowercase().contains("uang")
            || jobdesk.to_lowercase().contains("setor")
        {
            Some("serah terima uang tidak dilaporkan lengkap")
        } else {
            Some("bukti tidak sesuai dengan jobdesk yang diklaim")
        }
    } else if missing_evidence {
        Some("tidak upload bukti yang bisa diverifikasi")
    } else {
        None
    };

    if let Some(reason) = violation_reason {
        return SimulatedRow {
            completed: false,
            mode: "none",
            evidence_url: String::new(),
            employee_note: format!("Tidak ada bukti valid untuk jobdesk: {jobdesk}. {marker}"),
            review_status: "rejected",
            score: 0,
            reviewer_comment: reviewer_comment(0, Some(reason), late),
            submitted_at,
            reviewed_at,
            violation: true,
        };
    }

    let variation = (seed % 13) as i32 - 6;
    let late_penalty = if late { 12 } else { 0 };
    let score = (profile.base_score() + variation - late_penalty).clamp(52, 100);

    SimulatedRow {
        completed: true,
        mode: "image",
        evidence_url: choose_evidence_url(seed),
        employee_note: employee_note(jobdesk, score, late, marker),
        review_status: "approved",
        score,
        reviewer_comment: reviewer_comment(score, None, late),
        submitted_at,
        reviewed_at,
        violation: false,
    }
}

fn find_division<'a>(employee: &Employee, divisions: &'a [JobdeskDivision]) -> &'a JobdeskDivision {
    let employee_divisi = normalize_key(&employee.divisi);
    let employee_jabatan = normalize_key(&employee.jabatan);
    divisions
        .iter()
        .find(|division| {
            let id = normalize_key(&division.id);
            let posisi = normalize_key(&division.posisi);
            (!employee_divisi.is_empty() && (employee_divisi == id || employee_divisi == posisi))
                || (!employee_jabatan.is_empty()
                    && (employee_jabatan == id || employee_jabatan == posisi))
        })
        .or_else(|| {
            divisions.iter().find(|division| {
                let id = normalize_key(&division.id);
                let posisi = normalize_key(&division.posisi);
                (!employee_divisi.is_empty()
                    && (employee_divisi.contains(&id) || posisi.contains(&employee_divisi)))
                    || (!employee_jabatan.is_empty()
                        && (employee_jabatan.contains(&id) || posisi.contains(&employee_jabatan)))
            })
        })
        .unwrap_or_else(|| {
            divisions
                .iter()
                .find(|division| division.id == "karyawan-operasional")
                .unwrap_or(&divisions[0])
        })
}

async fn fetch_employees(pool: &MySqlPool, limit: u32) -> Result<Vec<Employee>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT u.id, u.name, COALESCE(NULLIF(u.divisi, ''), 'Karyawan Operasional') AS divisi, \
         COALESCE(u.jabatan, '') AS jabatan, COALESCE(u.cabang_id, '') AS cabang_id, \
         COALESCE(NULLIF(c.nama, ''), NULLIF(u.cabang_id, ''), 'Cabang belum diatur') AS cabang_name \
         FROM users u \
         LEFT JOIN cabang c ON c.id = u.cabang_id \
         WHERE LOWER(TRIM(u.role)) = 'karyawan' AND u.is_active = 1 AND u.is_verified = 1 \
         ORDER BY u.name ASC \
         LIMIT ?",
    )
    .bind(limit)
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

async fn fetch_jobdesk_divisions(pool: &MySqlPool) -> Result<Vec<JobdeskDivision>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'jobdesk_divisions' LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        let value: serde_json::Value = row.get("setting_value");
        if let Ok(settings) = serde_json::from_value::<JobdeskDivisionSettings>(value) {
            let divisions = settings
                .divisions
                .into_iter()
                .filter(|division| !division.jobdesks.is_empty())
                .collect::<Vec<_>>();
            if !divisions.is_empty() {
                return Ok(divisions);
            }
        }
    }

    Ok(fallback_jobdesk_divisions())
}

async fn reset_previous_simulation(pool: &MySqlPool, marker: &str) -> Result<u64, sqlx::Error> {
    let pattern = format!("%{marker}%");
    let result = sqlx::query(
        "DELETE FROM raport_harian \
         WHERE notes LIKE ? OR catatan LIKE ? OR reviewer_comment LIKE ?",
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL must be set in backend/.env or environment")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    let employee_limit = env::var("RAPORT_SIMULATION_EMPLOYEE_LIMIT")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(10);
    let marker = env::var("RAPORT_SIMULATION_MARKER")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| SIMULATION_MARKER.to_string());

    let dates = simulation_dates()?;
    let divisions = fetch_jobdesk_divisions(&pool).await?;
    let employees = fetch_employees(&pool, employee_limit).await?;

    if employees.len() < employee_limit as usize {
        return Err(format!(
            "Karyawan aktif dan verified hanya {} orang, butuh {} untuk simulasi",
            employees.len(),
            employee_limit
        )
        .into());
    }

    let deleted = reset_previous_simulation(&pool, &marker).await?;
    let mut inserted = 0u64;
    let mut approved = 0u64;
    let mut rejected = 0u64;
    let mut total_score = 0i64;
    let mut scored = 0i64;
    let mut non_compliant_summaries = Vec::new();

    let mut tx = pool.begin().await?;

    for (employee_index, employee) in employees.iter().enumerate() {
        let profile = ComplianceProfile::for_index(employee_index);
        let division = find_division(employee, &divisions);
        let jobdesks = division.jobdesks.iter().take(8).collect::<Vec<_>>();
        let mut employee_rejected = 0u64;
        let mut employee_score_total = 0i64;
        let mut employee_scored = 0i64;
        let target_kategori = target_category(&employee.jabatan, &employee.divisi);
        let cabang = if employee.cabang_name.trim().is_empty() {
            employee.cabang_id.as_str()
        } else {
            employee.cabang_name.as_str()
        };

        for (day_index, date) in dates.iter().enumerate() {
            for (jobdesk_index, jobdesk) in jobdesks.iter().enumerate() {
                let simulated = simulate_row(
                    employee_index,
                    day_index,
                    jobdesk_index,
                    *date,
                    jobdesk,
                    profile,
                    &marker,
                );
                let id = Uuid::new_v4().to_string();
                let completed = simulated.completed;
                let review_status = simulated.review_status;
                let score = simulated.score;
                let employee_note =
                    format!("{} | profile={}", simulated.employee_note, profile.label());

                sqlx::query(
                    "INSERT INTO raport_harian \
                     (id, karyawan_id, karyawan_nama, tanggal, cabang, divisi, target_kategori, \
                      jobdesk_index, jobdesk_label, jobdesk_text, completed, is_done, evidence_mode, \
                      bukti_url, notes, catatan, review_status, score, reviewer_comment, reviewed_at, created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
                     ON DUPLICATE KEY UPDATE \
                      id = VALUES(id), karyawan_nama = VALUES(karyawan_nama), cabang = VALUES(cabang), \
                      target_kategori = VALUES(target_kategori), jobdesk_label = VALUES(jobdesk_label), \
                      jobdesk_text = VALUES(jobdesk_text), completed = VALUES(completed), is_done = VALUES(is_done), \
                      evidence_mode = VALUES(evidence_mode), bukti_url = VALUES(bukti_url), notes = VALUES(notes), \
                      catatan = VALUES(catatan), review_status = VALUES(review_status), score = VALUES(score), \
                      reviewer_comment = VALUES(reviewer_comment), reviewed_at = VALUES(reviewed_at), \
                      created_at = VALUES(created_at), updated_at = VALUES(updated_at)",
                )
                .bind(id)
                .bind(&employee.id)
                .bind(&employee.name)
                .bind(*date)
                .bind(cabang)
                .bind(&division.posisi)
                .bind(target_kategori)
                .bind(jobdesk_index as i32)
                .bind(jobdesk.as_str())
                .bind(jobdesk.as_str())
                .bind(completed)
                .bind(completed)
                .bind(simulated.mode)
                .bind(if simulated.evidence_url.is_empty() {
                    None
                } else {
                    Some(simulated.evidence_url)
                })
                .bind(&employee_note)
                .bind(&employee_note)
                .bind(review_status)
                .bind(score)
                .bind(&simulated.reviewer_comment)
                .bind(simulated.reviewed_at)
                .bind(simulated.submitted_at)
                .bind(simulated.submitted_at)
                .execute(&mut *tx)
                .await?;

                inserted += 1;
                total_score += score as i64;
                scored += 1;
                employee_score_total += score as i64;
                employee_scored += 1;
                if review_status == "approved" {
                    approved += 1;
                } else {
                    rejected += 1;
                    employee_rejected += 1;
                }
                if simulated.violation {
                    employee_rejected = employee_rejected.max(1);
                }
            }
        }

        let average = if employee_scored > 0 {
            employee_score_total / employee_scored
        } else {
            0
        };
        if profile.is_non_compliant() || employee_rejected > 0 || average < 80 {
            non_compliant_summaries.push(format!(
                "{} | {} | {} | rata-rata={} | pelanggaran/ditolak={}",
                employee.name,
                cabang,
                profile.label(),
                average,
                employee_rejected
            ));
        }
    }

    tx.commit().await?;

    let average_score = if scored > 0 { total_score / scored } else { 0 };
    println!(
        "Seeded raport jobdesk simulation: {} rows, {} approved, {} rejected, average score {}",
        inserted, approved, rejected, average_score
    );
    println!(
        "Period: {} to {}. Employees: {}. Previous simulation rows deleted: {}. Marker: {}",
        dates.first().unwrap(),
        dates.last().unwrap(),
        employees.len(),
        deleted,
        marker
    );
    println!("Non-compliant employees:");
    for summary in non_compliant_summaries {
        println!("- {}", summary);
    }

    Ok(())
}
