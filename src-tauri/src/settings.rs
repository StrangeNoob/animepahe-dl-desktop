use std::{fs, path::PathBuf, sync::Mutex};

use anyhow::Context;
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub download_dir: Option<String>,
    pub theme_dark: bool,
    pub host_url: String,
    #[serde(default)]
    pub tour_completed: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_dir: None,
            theme_dark: true,
            host_url: "https://animepahe.si".into(),
            tour_completed: false,
        }
    }
}

pub struct AppState {
    settings_path: PathBuf,
    pub settings: Mutex<AppSettings>,
    cookie: Mutex<String>,
}

impl AppState {
    pub fn init() -> Self {
        let path = settings_file_path();
        let settings = load_settings(&path).unwrap_or_default();
        let cookie = Mutex::new(gen_cookie());
        Self {
            settings_path: path,
            settings: Mutex::new(settings),
            cookie,
        }
    }

    pub fn cookie(&self) -> String {
        self.cookie.lock().unwrap().clone()
    }

    pub fn persist(&self, settings: AppSettings) -> anyhow::Result<()> {
        let mut guard = self.settings.lock().unwrap();
        let mut updated = settings.clone();
        updated.host_url = normalize_host(&updated.host_url);
        *guard = updated.clone();
        save_settings(&self.settings_path, &updated)
    }
}

fn settings_file_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("animepahe-dl")
        .join("settings.json")
}

fn load_settings(path: &PathBuf) -> anyhow::Result<AppSettings> {
    let contents = fs::read_to_string(path)?;
    let mut settings: AppSettings = serde_json::from_str(&contents)?;
    settings.host_url = normalize_host(&settings.host_url);
    Ok(settings)
}

fn save_settings(path: &PathBuf, settings: &AppSettings) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("create config dir")?;
    }
    let json = serde_json::to_string_pretty(settings).context("serialize settings")?;
    fs::write(path, json).context("write settings")
}

fn gen_cookie() -> String {
    let rand: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();
    format!("__ddg2_={}", rand)
}

pub fn normalize_host(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        "https://animepahe.si".into()
    } else {
        trimmed.trim_end_matches('/').to_string()
    }
}
