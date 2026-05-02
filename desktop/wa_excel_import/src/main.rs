use eframe::{egui, NativeOptions};
use std::{path::PathBuf, sync::mpsc};
use wa_excel_import::{manual_recipient, parse_excel_file, upload_recipients, ImportSettings, RecipientDraft};

fn main() -> eframe::Result<()> {
    let options = NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1180.0, 820.0]),
        ..Default::default()
    };

    eframe::run_native(
        "WA Excel Import",
        options,
        Box::new(|_cc| Ok(Box::new(WaImportApp::default()))),
    )
}

#[derive(Default)]
struct WaImportApp {
    backend_url: String,
    bearer_token: String,
    campaign_id: String,
    selected_file: Option<PathBuf>,
    headers: Vec<String>,
    recipients: Vec<RecipientDraft>,
    manual_phone: String,
    manual_variables_json: String,
    status: String,
    error: Option<String>,
    uploading: bool,
    import_result: Option<String>,
}

impl WaImportApp {
    fn load_selected_file(&mut self) {
        let Some(path) = self.selected_file.clone() else {
            return;
        };

        match parse_excel_file(&path) {
            Ok(parsed) => {
                self.headers = parsed.headers;
                self.recipients = parsed.recipients;
                self.status = format!(
                    "Loaded {} recipients from {}",
                    self.recipients.len(),
                    path.display()
                );
                self.error = None;
            }
            Err(error) => {
                self.error = Some(error.to_string());
                self.status.clear();
            }
        }
    }

    fn add_manual_recipient(&mut self) {
        match manual_recipient(&self.manual_phone, &self.manual_variables_json) {
            Ok(recipient) => {
                self.recipients.push(recipient);
                self.manual_phone.clear();
                self.manual_variables_json.clear();
                self.status = format!("Manual recipient added. Total: {}", self.recipients.len());
                self.error = None;
            }
            Err(error) => {
                self.error = Some(error.to_string());
            }
        }
    }

    fn remove_recipient(&mut self, index: usize) {
        if index < self.recipients.len() {
            self.recipients.remove(index);
            self.status = format!("Recipient removed. Total: {}", self.recipients.len());
        }
    }

    fn submit_upload(&mut self) {
        if self.backend_url.trim().is_empty() || self.bearer_token.trim().is_empty() || self.campaign_id.trim().is_empty() {
            self.error = Some("backend URL, token, dan campaign ID wajib diisi".to_string());
            return;
        }

        if self.recipients.is_empty() {
            self.error = Some("Belum ada recipient untuk diupload".to_string());
            return;
        }

        self.uploading = true;
        self.error = None;
        self.import_result = None;

        let settings = ImportSettings {
            backend_url: self.backend_url.clone(),
            bearer_token: self.bearer_token.clone(),
            campaign_id: self.campaign_id.clone(),
            chunk_size: 500,
            timeout: std::time::Duration::from_secs(45),
        };
        let recipients = self.recipients.clone();
        let (tx, rx) = mpsc::channel();

        std::thread::spawn(move || {
            let result = upload_recipients(&settings, &recipients).map(|value| value.message).map_err(|error| error.to_string());
            let _ = tx.send(result);
        });

        if let Ok(result) = rx.recv() {
            self.uploading = false;
            match result {
                Ok(message) => {
                    self.import_result = Some(message.clone());
                    self.status = message;
                }
                Err(error) => {
                    self.error = Some(error);
                }
            }
        } else {
            self.uploading = false;
            self.error = Some("Upload gagal dijalankan".to_string());
        }
    }
}

impl eframe::App for WaImportApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::TopBottomPanel::top("top_bar").show(ctx, |ui| {
            ui.vertical(|ui| {
                ui.heading("WA Excel Import");
                ui.label("Load Excel, preview recipients, add manual entries, lalu upload ke campaign WA.");
            });
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.label("Backend URL");
                ui.text_edit_singleline(&mut self.backend_url);
                ui.label("Token");
                ui.text_edit_singleline(&mut self.bearer_token);
                ui.label("Campaign ID");
                ui.text_edit_singleline(&mut self.campaign_id);
            });

            ui.separator();

            ui.horizontal(|ui| {
                if ui.button("Pilih Excel").clicked() {
                    if let Some(path) = rfd::FileDialog::new().add_filter("Excel", &["xlsx", "xlsm", "xls"]).pick_file() {
                        self.selected_file = Some(path);
                        self.load_selected_file();
                    }
                }
                if let Some(path) = &self.selected_file {
                    ui.label(path.display().to_string());
                }
                if ui.button("Reload").clicked() {
                    self.load_selected_file();
                }
            });

            ui.add_space(8.0);

            ui.group(|ui| {
                ui.label("Tambah recipient manual");
                ui.horizontal(|ui| {
                    ui.text_edit_singleline(&mut self.manual_phone);
                    ui.text_edit_singleline(&mut self.manual_variables_json);
                    if ui.button("Tambah").clicked() {
                        self.add_manual_recipient();
                    }
                });
            });

            ui.add_space(12.0);
            ui.horizontal(|ui| {
                ui.label(format!("Recipients: {}", self.recipients.len()));
                if self.uploading {
                    ui.spinner();
                    ui.label("Uploading...");
                } else if ui.button("Upload ke backend").clicked() {
                    self.submit_upload();
                }
            });

            if let Some(error) = &self.error {
                ui.colored_label(egui::Color32::RED, error);
            }
            if let Some(message) = &self.import_result {
                ui.colored_label(egui::Color32::from_rgb(0, 140, 80), message);
            }
            if !self.status.is_empty() {
                ui.label(&self.status);
            }

            ui.separator();
            ui.label("Preview recipients");

            let mut remove_index: Option<usize> = None;
            egui::ScrollArea::vertical().max_height(520.0).show(ui, |ui| {
                egui::Grid::new("preview_grid").striped(true).show(ui, |ui| {
                    ui.strong("#");
                    ui.strong("Phone");
                    ui.strong("Variables");
                    ui.strong("Action");
                    ui.end_row();

                    for (index, recipient) in self.recipients.iter().enumerate().take(250) {
                        ui.label((index + 1).to_string());
                        ui.label(&recipient.phone);
                        ui.label(recipient.variables.to_string());
                        if ui.button("Hapus").clicked() {
                            remove_index = Some(index);
                        }
                        ui.end_row();
                    }
                });
            });
            if let Some(index) = remove_index {
                self.remove_recipient(index);
            }
        });
    }
}
