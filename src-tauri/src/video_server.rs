use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio_util::io::ReaderStream;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct ServerState {
    pub ffmpeg_path: String,
}

pub async fn start_video_server(ffmpeg_path: String) -> Result<String, String> {
    let state = ServerState { ffmpeg_path };

    let app = Router::new()
        .route("/video/*path", get(stream_video))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(state));

    // Find an available port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind server: {}", e))?;

    let addr = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?;

    let port = addr.port();
    let server_url = format!("http://127.0.0.1:{}", port);

    // Spawn server in background
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("Video server error: {}", e);
        }
    });

    Ok(server_url)
}

async fn stream_video(
    State(state): State<Arc<ServerState>>,
    Path(file_path): Path<String>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    println!("Received file_path from URL: {:?}", file_path);

    // Axum's Path extractor already URL-decodes the path, so use it directly
    let path = PathBuf::from(&file_path);
    println!("PathBuf: {:?}", path);
    println!("Path exists: {}", path.exists());

    if !path.exists() {
        eprintln!("Video file not found: {:?}", path);
        eprintln!("File path as string: {}", path.display());
        return Err(StatusCode::NOT_FOUND);
    }

    println!("✓ Video file found, streaming: {:?}", path);

    // Check if client supports range requests
    let range_header = headers.get(header::RANGE);

    // For now, we'll transcode the entire video with compatible audio
    // In the future, we can add range request support for seeking
    if range_header.is_some() {
        println!("Range requests not yet supported, streaming full video");
    }

    // Start ffmpeg to transcode audio on-the-fly
    // Note: Using matroska (mkv) format instead of MP4 because:
    // - MP4 with fragmentation doesn't work well with Safari without range requests
    // - MKV can be streamed progressively without special flags
    // - MKV is well-supported in modern browsers
    let mut ffmpeg_cmd = Command::new(&state.ffmpeg_path);
    ffmpeg_cmd
        .arg("-loglevel")
        .arg("info") // More verbose logging
        .arg("-i")
        .arg(&path)
        .arg("-c:v")
        .arg("copy") // Copy video stream as-is (no re-encoding)
        .arg("-c:a")
        .arg("aac") // Transcode audio to AAC LC
        .arg("-b:a")
        .arg("192k") // Audio bitrate
        .arg("-profile:a")
        .arg("aac_low") // AAC LC profile
        .arg("-ar")
        .arg("48000") // Sample rate
        .arg("-f")
        .arg("matroska") // Use MKV format for better streaming without range requests
        .arg("pipe:1") // Output to stdout
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .kill_on_drop(true);

    println!("Starting ffmpeg transcoding with command: {:?}", ffmpeg_cmd);

    let mut child = ffmpeg_cmd
        .spawn()
        .map_err(|e| {
            eprintln!("Failed to spawn ffmpeg: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut stdout = child.stdout.take().ok_or_else(|| {
        eprintln!("Failed to get ffmpeg stdout");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    println!("ffmpeg process started, waiting for output...");

    // Log stderr in background - show ALL output for debugging
    if let Some(mut stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut buf = vec![0u8; 4096];
            let mut total_output = String::new();
            while let Ok(n) = stderr.read(&mut buf).await {
                if n == 0 {
                    break;
                }
                let chunk = String::from_utf8_lossy(&buf[..n]);
                print!("[ffmpeg] {}", chunk);
                total_output.push_str(&chunk);
            }
            println!("\n[ffmpeg] Process ended. Total stderr output: {} bytes", total_output.len());
        });
    }

    // Wait for ffmpeg to start producing output
    // Read a small chunk first to ensure ffmpeg has started encoding
    let mut first_chunk = vec![0u8; 8192];
    let bytes_read = match tokio::io::AsyncReadExt::read(&mut stdout, &mut first_chunk).await {
        Ok(0) => {
            eprintln!("ffmpeg produced no output");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
        Ok(n) => {
            println!("✓ Received first {} bytes from ffmpeg", n);
            n
        }
        Err(e) => {
            eprintln!("Failed to read from ffmpeg: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Create a stream that starts with the first chunk, then continues with the rest
    use futures::stream::{self, StreamExt};
    let initial_stream = stream::once(async move {
        Ok::<_, std::io::Error>(bytes::Bytes::copy_from_slice(&first_chunk[..bytes_read]))
    });
    let rest_stream = ReaderStream::new(stdout);
    let combined_stream = initial_stream.chain(rest_stream);

    let body = Body::from_stream(combined_stream);

    // Build response with appropriate headers
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/x-matroska") // MKV MIME type
        .header(header::ACCEPT_RANGES, "none") // We don't support ranges yet
        .header(header::CACHE_CONTROL, "no-cache")
        .body(body)
        .map_err(|e| {
            eprintln!("Failed to build response: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    println!("Response sent with Content-Type: video/x-matroska");
    Ok(response)
}
