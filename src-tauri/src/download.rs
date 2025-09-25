use anyhow::{anyhow, Context, Result};
use futures::stream::{FuturesUnordered, StreamExt};
use regex::Regex;
use reqwest::Client;
use sanitize_filename::sanitize;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs as tokiofs;
use tokio::time::{timeout, Duration};

fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards");
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    format!("[{}.{:03}]", secs, millis)
}

static FFMPEG_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn set_ffmpeg_path(path: PathBuf) {
    let _ = FFMPEG_PATH.set(path);
}

pub async fn download_episode(
    anime_name: &str,
    ep: u32,
    m3u8: &str,
    threads: usize,
    cookie: &str,
    out_base: Option<&Path>,
    host: &str,
    progress: Option<(Arc<AtomicUsize>, Arc<AtomicUsize>)>, // (total, done)
) -> Result<()> {
    eprintln!("{} download_episode called: episode={}, threads={}", timestamp(), ep, threads);
    eprintln!("{} Anime title received: {}", timestamp(), anime_name);
    let base_folder = out_base
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    eprintln!("{} Resolved base output directory: {}", timestamp(), base_folder.display());
    let sanitized_name = sanitize(anime_name);
    let out_dir = base_folder.join(&sanitized_name);
    eprintln!("{} Episode output directory: {}", timestamp(), out_dir.display());
    fs::create_dir_all(&out_dir)?;
    let out_file = out_dir.join(format!("{}.mp4", ep));
    eprintln!(
        "{} Target file for episode {}: {}",
        timestamp(),
        ep,
        out_file.display()
    );

    if threads <= 1 {
        eprintln!("{} Using single-threaded download with ffmpeg_hls", timestamp());
        return ffmpeg_hls(m3u8, &out_file, cookie, host, progress.clone()).await;
    }

    // Parallel path
    let work = out_dir.join(format!("{}_work", ep));
    if work.exists() {
        fs::remove_dir_all(&work).ok();
    }
    fs::create_dir_all(&work)?;
    let playlist_path = work.join("playlist.m3u8");
    download_to_file(m3u8, &playlist_path, cookie, host).await?;

    // Parse segments and key
    let content = tokiofs::read_to_string(&playlist_path).await?;
    let seg_urls: Vec<String> = content
        .lines()
        .filter(|l| l.starts_with("http"))
        .map(|s| s.to_string())
        .collect();
    if seg_urls.is_empty() {
        return Err(anyhow!("No segments in playlist"));
    }
    if let Some((total, _done)) = &progress {
        total.store(seg_urls.len(), Ordering::Relaxed);
    }
    eprintln!(
        "{} Downloaded playlist with {} segments",
        timestamp(),
        seg_urls.len()
    );

    // Key
    let key_url = extract_key_uri(&content);
    let key_hex = if let Some(url) = key_url {
        let bytes = download_bytes(&url, cookie, host).await?;
        hex::encode(bytes)
    } else {
        String::new()
    };

    // Download segments
    download_segments(
        &seg_urls,
        &work,
        threads,
        cookie,
        host,
        progress.as_ref().map(|p| p.1.clone()),
    )
    .await?;
    eprintln!(
        "{} Finished downloading segments to {}",
        timestamp(),
        work.display()
    );
    // Decrypt if key present
    if !key_hex.is_empty() {
        eprintln!(
            "{} Beginning segment decryption with OpenSSL",
            timestamp()
        );
        decrypt_segments(&work, &key_hex, threads).await?;
        eprintln!("{} Segment decryption complete", timestamp());
    }
    // Generate concat file list
    let list_path = work.join("file.list");
    let mut list_file = File::create(&list_path)?;
    let mut seg_files: Vec<PathBuf> = fs::read_dir(&work)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|s| s.to_str()) == Some("encrypted")
                || p.extension().and_then(|s| s.to_str()) == Some("ts")
        })
        .collect();
    seg_files.sort();
    for p in &seg_files {
        let mut final_path = p.clone();
        if p.extension().and_then(|s| s.to_str()) == Some("encrypted") {
            // decrypted file has same name without .encrypted
            final_path.set_extension("");
        }
        writeln!(list_file, "file '{}'", final_path.display())?;
    }

    // Concat
    eprintln!(
        "{} Starting ffmpeg concat for {} segments",
        timestamp(),
        seg_files.len()
    );
    ffmpeg_concat(&list_path, &out_file)?;
    eprintln!("{} FFmpeg concat finished", timestamp());
    log_output_file(&out_file);

    // Cleanup
    if let Err(e) = fs::remove_dir_all(&work) {
        eprintln!("cleanup failed: {e}");
    }
    Ok(())
}

async fn ffmpeg_hls(
    m3u8: &str,
    out_file: &Path,
    cookie: &str,
    host: &str,
    progress: Option<(Arc<AtomicUsize>, Arc<AtomicUsize>)>,
) -> Result<()> {
    eprintln!("{} ffmpeg_hls called with m3u8: {}", timestamp(), m3u8);
    let ffmpeg = resolve_ffmpeg()?;
    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-headers")
        .arg(format!("Referer: {}\r\nCookie: {}", host, cookie))
        .arg("-allowed_extensions")
        .arg("ALL")
        .arg("-protocol_whitelist")
        .arg("file,http,https,tcp,tls,crypto")
        .arg("-i")
        .arg(m3u8)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(out_file)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    eprintln!("{} Spawning ffmpeg process", timestamp());
    let mut child = cmd.spawn().context("spawn ffmpeg")?;

    if let Some((total, done)) = &progress {
        total.store(1000, Ordering::Relaxed);
        done.store(0, Ordering::Relaxed);
    }

    eprintln!("{} Starting ffmpeg execution with 300-second timeout", timestamp());

    // Wrap ffmpeg execution in timeout to prevent hanging
    let result = timeout(Duration::from_secs(300), async {
        if let Some(stderr) = child.stderr.take() {
            eprintln!("{} Begin reading ffmpeg stderr", timestamp());
            let reader = BufReader::new(stderr);
            let mut duration_ms: Option<usize> = None;
            for raw_line in reader.lines() {
                let line = raw_line.context("read ffmpeg stderr")?;
                eprintln!("{} ffmpeg stderr: {}", timestamp(), line);
                if let Some((total, done)) = &progress {
                    if duration_ms.is_none() {
                        if let Some(idx) = line.find("Duration:") {
                            let rest = line[idx + "Duration:".len()..].trim();
                            if let Some(seg) = rest.split(',').next() {
                                if let Some(ms) = parse_time_to_millis(seg.trim()) {
                                    let ms_usize = ms as usize;
                                    duration_ms = Some(ms_usize);
                                    total.store(ms_usize, Ordering::Relaxed);
                                }
                            }
                        }
                    }

                    if let Some(idx) = line.find("time=") {
                        let rest = &line[idx + "time=".len()..];
                        if let Some(token) = rest.split_whitespace().next() {
                            if let Some(ms) = parse_time_to_millis(token) {
                                let ms_usize = ms as usize;
                                done.store(ms_usize, Ordering::Relaxed);
                                if let Some(total_ms) = duration_ms {
                                    if ms_usize > total_ms {
                                        total.store(ms_usize, Ordering::Relaxed);
                                    }
                                } else {
                                    let current_total = total.load(Ordering::Relaxed);
                                    if ms_usize > current_total {
                                        total.store(ms_usize, Ordering::Relaxed);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let status = child.wait().context("run ffmpeg")?;
        Ok::<_, anyhow::Error>(status)
    }).await;

    let status = match result {
        Ok(Ok(status)) => {
            eprintln!("{} FFmpeg completed successfully", timestamp());
            status
        },
        Ok(Err(e)) => {
            eprintln!("{} FFmpeg failed: {}", timestamp(), e);
            return Err(e);
        },
        Err(_) => {
            eprintln!("{} FFmpeg execution timed out after 300 seconds", timestamp());
            let _ = child.kill();
            return Err(anyhow!("FFmpeg execution timed out after 300 seconds"));
        }
    };
    if let Some((total, done)) = &progress {
        if status.success() {
            let current_total = total.load(Ordering::Relaxed);
            if current_total > 0 {
                done.store(current_total, Ordering::Relaxed);
            }
        }
    }
    if !status.success() {
        return Err(anyhow!("ffmpeg failed"));
    }

    match std::fs::metadata(out_file) {
        Ok(meta) => {
            eprintln!(
                "{} Verified output file exists: {} ({} bytes)",
                timestamp(),
                out_file.display(),
                meta.len()
            );
        }
        Err(err) => {
            eprintln!(
                "{} WARNING: output file missing after ffmpeg: {} ({})",
                timestamp(),
                out_file.display(),
                err
            );
        }
    }

    Ok(())
}

fn parse_time_to_millis(input: &str) -> Option<u64> {
    let parts: Vec<&str> = input.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let hours: f64 = parts[0].trim().parse().ok()?;
    let minutes: f64 = parts[1].trim().parse().ok()?;
    let seconds: f64 = parts[2].trim().parse().ok()?;
    let total_ms = (hours * 3600.0 + minutes * 60.0 + seconds) * 1000.0;
    Some(total_ms as u64)
}

fn ffmpeg_concat(list_path: &Path, out_file: &Path) -> Result<()> {
    let ffmpeg = resolve_ffmpeg()?;
    let status = Command::new(ffmpeg)
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(list_path)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(out_file)
        .status()
        .context("run ffmpeg concat")?;
    if !status.success() {
        return Err(anyhow!("ffmpeg concat failed"));
    }
    Ok(())
}

fn log_output_file(out_file: &Path) {
    match fs::metadata(out_file) {
        Ok(meta) => eprintln!(
            "{} Verified output file exists: {} ({} bytes)",
            timestamp(),
            out_file.display(),
            meta.len()
        ),
        Err(err) => eprintln!(
            "{} WARNING: output file missing after processing: {} ({})",
            timestamp(),
            out_file.display(),
            err
        ),
    }
}

fn resolve_ffmpeg() -> Result<PathBuf> {
    if let Some(path) = FFMPEG_PATH.get() {
        return Ok(path.clone());
    }
    which::which("ffmpeg").map_err(|_| anyhow!("ffmpeg not found"))
}

async fn download_to_file(url: &str, path: &Path, cookie: &str, host: &str) -> Result<()> {
    let client = create_client();
    let resp = client
        .get(url)
        .header(reqwest::header::REFERER, host)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?;
    let content = resp.bytes().await?;
    tokiofs::write(path, content).await?;
    Ok(())
}

async fn download_bytes(url: &str, cookie: &str, host: &str) -> Result<Vec<u8>> {
    let client = create_client();
    let resp = client
        .get(url)
        .header(reqwest::header::REFERER, host)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?;
    Ok(resp.bytes().await?.to_vec())
}

async fn download_segments(
    seg_urls: &[String],
    work_dir: &Path,
    threads: usize,
    cookie: &str,
    host: &str,
    progress_done: Option<Arc<AtomicUsize>>,
) -> Result<()> {
    let semaphore = Arc::new(tokio::sync::Semaphore::new(threads));
    let mut handles = FuturesUnordered::new();

    for (i, url) in seg_urls.iter().enumerate() {
        let sem = semaphore.clone();
        let url = url.clone();
        let cookie = cookie.to_string();
        let host = host.to_string();
        let work_dir = work_dir.to_path_buf();
        let progress_done = progress_done.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await?;
            let seg_path = work_dir.join(format!("seg_{:06}.ts", i));
            download_to_file(&url, &seg_path, &cookie, &host).await?;
            if let Some(done) = progress_done {
                done.fetch_add(1, Ordering::Relaxed);
            }
            Ok::<(), anyhow::Error>(())
        });

        handles.push(handle);
    }

    while let Some(result) = handles.next().await {
        result??;
    }

    Ok(())
}

fn extract_key_uri(content: &str) -> Option<String> {
    let re = Regex::new(r#"#EXT-X-KEY:.*URI="([^"]+)""#).ok()?;
    re.captures(content)?.get(1).map(|m| m.as_str().to_string())
}

async fn decrypt_segments(work_dir: &Path, key_hex: &str, threads: usize) -> Result<()> {
    let key_bytes = hex::decode(key_hex)?;
    let mut paths: Vec<PathBuf> = fs::read_dir(work_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|s| s.to_str()) == Some("ts"))
        .collect();

    paths.sort();
    let total = paths.len();

    eprintln!(
        "{} Decrypting {} segment(s) with OpenSSL ({} parallel tasks)",
        timestamp(),
        total,
        threads
    );

    let semaphore = Arc::new(tokio::sync::Semaphore::new(threads));
    let mut tasks = FuturesUnordered::new();

    for path in paths.into_iter() {
        let permit = semaphore.clone();
        let key_bytes = key_bytes.clone();

        let task = tokio::spawn(async move {
            let _permit = permit.acquire().await.expect("semaphore");
            let content = tokiofs::read(&path).await?;
            let decrypted = decrypt_aes128_cbc(&content, &key_bytes)?;

            let encrypted_path = path.with_extension("encrypted");
            tokiofs::rename(&path, &encrypted_path).await?;

            let decrypted_path = encrypted_path.with_extension("");
            tokiofs::write(&decrypted_path, decrypted).await?;

            Ok::<(), anyhow::Error>(())
        });

        tasks.push(task);
    }

    let mut completed = 0usize;
    while let Some(result) = tasks.next().await {
        match result {
            Ok(Ok(())) => {
                completed += 1;
                if completed % 25 == 0 || completed == total {
                    eprintln!(
                        "{} Decrypted {}/{} segments",
                        timestamp(),
                        completed,
                        total
                    );
                }
            }
            Ok(Err(err)) => return Err(err),
            Err(err) => return Err(anyhow!("Decrypt task panicked: {err}")),
        }
    }

    Ok(())
}

fn decrypt_aes128_cbc(data: &[u8], key: &[u8]) -> Result<Vec<u8>> {
    use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};

    if data.len() < 16 {
        return Err(anyhow!("Data too short for AES decryption"));
    }

    type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

    let iv = &data[..16];
    let encrypted = &data[16..];

    let mut buffer = encrypted.to_vec();
    let decryptor = Aes128CbcDec::new_from_slices(key, iv)
        .map_err(|err| anyhow!("Invalid key/iv length: {err:?}"))?;
    let decrypted = decryptor
        .decrypt_padded_mut::<Pkcs7>(&mut buffer)
        .map_err(|err| anyhow!("AES decryption failed: {err}"))?;

    Ok(decrypted.to_vec())
}

fn create_client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
}
