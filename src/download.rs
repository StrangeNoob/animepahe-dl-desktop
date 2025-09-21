use anyhow::{anyhow, Context, Result};
use futures::stream::{FuturesUnordered, StreamExt};
use regex::Regex;
use reqwest::Client;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::fs as tokiofs;
use tokio::io::AsyncWriteExt;

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
    let base_folder = out_base
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let out_dir = base_folder.join(sanitize_filename::sanitize(anime_name));
    fs::create_dir_all(&out_dir)?;
    let out_file = out_dir.join(format!("{}.mp4", ep));

    if threads <= 1 {
        return ffmpeg_hls(m3u8, &out_file, cookie, host, progress.clone());
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
    // Decrypt if key present
    if !key_hex.is_empty() {
        decrypt_segments(&work, &key_hex).await?;
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
    ffmpeg_concat(&list_path, &out_file)?;

    // Cleanup
    if let Err(e) = fs::remove_dir_all(&work) {
        eprintln!("cleanup failed: {e}");
    }
    Ok(())
}

fn ffmpeg_hls(
    m3u8: &str,
    out_file: &Path,
    cookie: &str,
    host: &str,
    progress: Option<(Arc<AtomicUsize>, Arc<AtomicUsize>)>,
) -> Result<()> {
    let ffmpeg = which::which("ffmpeg").map_err(|_| anyhow!("ffmpeg not found"))?;
    let mut cmd = Command::new(ffmpeg);
    cmd.arg("-headers")
        .arg(format!("Referer: {}\r\nCookie: {}", host, cookie))
        .arg("-i")
        .arg(m3u8)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(out_file)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().context("spawn ffmpeg")?;

    if let Some((total, done)) = &progress {
        total.store(1000, Ordering::Relaxed);
        done.store(0, Ordering::Relaxed);
    }

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let mut duration_ms: Option<usize> = None;
        for line in reader.lines() {
            let line = line.context("read ffmpeg stderr")?;
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
    let total_seconds = hours * 3600.0 + minutes * 60.0 + seconds;
    Some((total_seconds * 1000.0) as u64)
}

fn ffmpeg_concat(list_path: &Path, out_file: &Path) -> Result<()> {
    let ffmpeg = which::which("ffmpeg").map_err(|_| anyhow!("ffmpeg not found"))?;
    let status = Command::new(ffmpeg)
        .args(["-f", "concat", "-safe", "0", "-i"])
        .arg(list_path)
        .args(["-c", "copy", "-y"])
        .arg(out_file)
        .status()
        .context("run ffmpeg concat")?;
    if !status.success() {
        return Err(anyhow!("ffmpeg concat failed"));
    }
    Ok(())
}

async fn download_segments(
    urls: &[String],
    out_dir: &Path,
    threads: usize,
    cookie: &str,
    host: &str,
    done_counter: Option<Arc<AtomicUsize>>,
) -> Result<()> {
    let client = client();
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(threads as usize));
    let host = host.to_string();
    let mut futs = FuturesUnordered::new();
    for url in urls {
        let done_counter = done_counter.clone();
        let permit = sem.clone().acquire_owned().await.unwrap();
        let client = client.clone();
        let cookie = cookie.to_string();
        let host = host.clone();
        let out = out_dir.join(format!(
            "{}.encrypted",
            url.split('/').last().unwrap_or("seg")
        ));
        let url = url.clone();
        futs.push(tokio::spawn(async move {
            let _p = permit;
            let res = client
                .get(&url)
                .header(reqwest::header::REFERER, &host)
                .header(reqwest::header::COOKIE, &cookie)
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .map_err(|e| anyhow!(e.to_string()));
            match res {
                Ok(resp) => {
                    let bytes = resp.bytes().await.map_err(|e| anyhow!(e.to_string()))?;
                    let mut f = tokiofs::File::create(&out)
                        .await
                        .map_err(|e| anyhow!(e.to_string()))?;
                    f.write_all(&bytes)
                        .await
                        .map_err(|e| anyhow!(e.to_string()))?;
                    if let Some(dc) = &done_counter {
                        dc.fetch_add(1, Ordering::Relaxed);
                    }
                    Ok::<(), anyhow::Error>(())
                }
                Err(e) => Err(e),
            }
        }));
    }
    while let Some(res) = futs.next().await {
        res??;
    }
    Ok(())
}

async fn decrypt_segments(out_dir: &Path, key_hex: &str) -> Result<()> {
    let openssl = which::which("openssl")
        .map_err(|_| anyhow!("openssl not found; required for parallel decrypt"))?;
    for entry in fs::read_dir(out_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("encrypted") {
            let mut out = path.clone();
            out.set_extension("");
            let status = Command::new(&openssl)
                .args(["aes-128-cbc", "-d", "-K", key_hex, "-iv", "0", "-in"])
                .arg(&path)
                .args(["-out"])
                .arg(&out)
                .status()
                .context("run openssl")?;
            if !status.success() {
                return Err(anyhow!("openssl failed on {:?}", path));
            }
        }
    }
    Ok(())
}

fn extract_key_uri(playlist: &str) -> Option<String> {
    // Example: #EXT-X-KEY:METHOD=AES-128,URI="https://.../key"
    let re = Regex::new(r#"#EXT-X-KEY:METHOD=([^,]+),URI=\"([^\"]+)\""#).unwrap();
    re.captures(playlist)
        .and_then(|c| c.get(2).map(|m| m.as_str().to_string()))
}

async fn download_to_file(url: &str, path: &Path, cookie: &str, host: &str) -> Result<()> {
    let client = client();
    let mut file = tokiofs::File::create(path).await?;
    let mut resp = client
        .get(url)
        .header(reqwest::header::REFERER, host)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?;
    while let Some(chunk) = resp.chunk().await? {
        file.write_all(&chunk).await?;
    }
    Ok(())
}

async fn download_bytes(url: &str, cookie: &str, host: &str) -> Result<Vec<u8>> {
    let client = client();
    let bytes = client
        .get(url)
        .header(reqwest::header::REFERER, host)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?;
    Ok(bytes.bytes().await?.to_vec())
}

fn client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .build()
        .expect("client")
}
