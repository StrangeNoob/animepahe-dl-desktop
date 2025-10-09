use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub id: String,
    pub anime_name: String,
    pub episode: i32,
    pub slug: String,
    pub status: DownloadStatus,
    pub file_path: String,
    pub downloaded_bytes: u64,
    pub file_size: Option<u64>,
    pub started_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
    pub error_message: Option<String>,
    pub audio_type: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DownloadTracker {
    state_file: PathBuf,
    records: Arc<Mutex<HashMap<String, DownloadRecord>>>,
}

impl DownloadTracker {
    pub fn new(config_dir: PathBuf) -> Result<Self, String> {
        // Ensure config directory exists
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let state_file = config_dir.join("download_state.json");

        // Load existing state or create new
        let records = if state_file.exists() {
            let content = fs::read_to_string(&state_file)
                .map_err(|e| format!("Failed to read download state: {}", e))?;

            let map: HashMap<String, DownloadRecord> = serde_json::from_str(&content)
                .unwrap_or_else(|_| HashMap::new());

            Arc::new(Mutex::new(map))
        } else {
            Arc::new(Mutex::new(HashMap::new()))
        };

        Ok(DownloadTracker {
            state_file,
            records,
        })
    }

    pub fn add_download(
        &self,
        anime_name: String,
        episode: i32,
        slug: String,
        file_path: String,
        audio_type: Option<String>,
        resolution: Option<String>,
    ) -> Result<String, String> {
        let id = format!("{}-ep{}-{}", slug, episode, Utc::now().timestamp());
        let now = Utc::now().timestamp();

        let record = DownloadRecord {
            id: id.clone(),
            anime_name,
            episode,
            slug,
            status: DownloadStatus::InProgress,
            file_path,
            downloaded_bytes: 0,
            file_size: None,
            started_at: now,
            updated_at: now,
            completed_at: None,
            error_message: None,
            audio_type,
            resolution,
        };

        let mut records = self.records.lock().unwrap();
        records.insert(id.clone(), record);
        drop(records);

        self.save_to_disk()?;
        Ok(id)
    }

    pub fn update_progress(&self, id: &str, downloaded_bytes: u64, file_size: Option<u64>) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();

        if let Some(record) = records.get_mut(id) {
            record.downloaded_bytes = downloaded_bytes;
            if file_size.is_some() {
                record.file_size = file_size;
            }
            record.updated_at = Utc::now().timestamp();
        }
        drop(records);

        self.save_to_disk()
    }

    pub fn mark_completed(&self, id: &str) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();

        if let Some(record) = records.get_mut(id) {
            record.status = DownloadStatus::Completed;
            record.updated_at = Utc::now().timestamp();
            record.completed_at = Some(Utc::now().timestamp());

            // Set downloaded_bytes to file_size if available
            if let Some(size) = record.file_size {
                record.downloaded_bytes = size;
            }
        }
        drop(records);

        self.save_to_disk()
    }

    pub fn mark_failed(&self, id: &str, error: String) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();

        if let Some(record) = records.get_mut(id) {
            record.status = DownloadStatus::Failed;
            record.error_message = Some(error);
            record.updated_at = Utc::now().timestamp();
        }
        drop(records);

        self.save_to_disk()
    }

    pub fn mark_cancelled(&self, id: &str) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();

        if let Some(record) = records.get_mut(id) {
            record.status = DownloadStatus::Cancelled;
            record.updated_at = Utc::now().timestamp();
        }
        drop(records);

        self.save_to_disk()
    }

    pub fn get_incomplete_downloads(&self) -> Vec<DownloadRecord> {
        let records = self.records.lock().unwrap();
        records
            .values()
            .filter(|r| r.status == DownloadStatus::InProgress || r.status == DownloadStatus::Failed)
            .cloned()
            .collect()
    }

    pub fn get_download(&self, id: &str) -> Option<DownloadRecord> {
        let records = self.records.lock().unwrap();
        records.get(id).cloned()
    }

    pub fn remove_download(&self, id: &str) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();
        records.remove(id);
        drop(records);

        self.save_to_disk()
    }

    pub fn clear_completed(&self) -> Result<(), String> {
        let mut records = self.records.lock().unwrap();
        records.retain(|_, r| r.status != DownloadStatus::Completed);
        drop(records);

        self.save_to_disk()
    }

    pub fn validate_file(&self, id: &str) -> Result<bool, String> {
        let record = self.get_download(id)
            .ok_or_else(|| "Download record not found".to_string())?;

        let path = PathBuf::from(&record.file_path);

        // Check if file exists
        if !path.exists() {
            return Ok(false);
        }

        // For incomplete downloads, just verify file exists
        // For completed downloads, verify exact size match
        if record.status == DownloadStatus::Completed {
            if let Some(expected_size) = record.file_size {
                let actual_size = fs::metadata(&path)
                    .map_err(|e| format!("Failed to get file metadata: {}", e))?
                    .len();

                if actual_size != expected_size {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let records = self.records.lock().unwrap();
        let json = serde_json::to_string_pretty(&*records)
            .map_err(|e| format!("Failed to serialize download state: {}", e))?;

        fs::write(&self.state_file, json)
            .map_err(|e| format!("Failed to write download state: {}", e))?;

        Ok(())
    }
}
