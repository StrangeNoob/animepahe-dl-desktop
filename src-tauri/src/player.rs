use anyhow::{Context, Result};
use std::path::PathBuf;
use tauri::AppHandle;

/// Get a URL that can be used to access a local video file
/// Uses Tauri's convertFileSrc for secure asset protocol access
pub fn get_local_video_url(_app: &AppHandle, file_path: &str) -> Result<String> {
    let path = PathBuf::from(file_path);

    // Verify file exists
    if !path.exists() {
        anyhow::bail!("Video file does not exist: {}", file_path);
    }

    // Convert to asset URL using Tauri's secure protocol
    let url = format!("asset://localhost/{}", path.to_string_lossy());

    Ok(url)
}

/// Validate that a video file exists and is accessible
pub fn validate_video_file(file_path: &str) -> Result<()> {
    let path = PathBuf::from(file_path);

    if !path.exists() {
        anyhow::bail!("Video file does not exist: {}", file_path);
    }

    if !path.is_file() {
        anyhow::bail!("Path is not a file: {}", file_path);
    }

    // Check if file has video extension
    let valid_extensions = ["mp4", "mkv", "avi", "mov", "webm", "m4v"];
    if let Some(ext) = path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        if !valid_extensions.contains(&ext_str.as_str()) {
            anyhow::bail!("Invalid video file extension: {}", ext_str);
        }
    } else {
        anyhow::bail!("File has no extension: {}", file_path);
    }

    Ok(())
}

/// Get video metadata (duration, size, etc.)
pub fn get_video_metadata(file_path: &str) -> Result<VideoMetadata> {
    let path = PathBuf::from(file_path);

    if !path.exists() {
        anyhow::bail!("Video file does not exist: {}", file_path);
    }

    let metadata = std::fs::metadata(&path)
        .context("Failed to read file metadata")?;

    Ok(VideoMetadata {
        file_size: metadata.len(),
        file_path: file_path.to_string(),
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct VideoMetadata {
    pub file_size: u64,
    pub file_path: String,
}
