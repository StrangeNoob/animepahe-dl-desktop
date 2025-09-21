use anyhow::{anyhow, Context, Result};
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use std::process::Command;

#[derive(Debug, Clone)]
pub struct Candidate {
    pub src: String,
    pub audio: Option<String>,
    pub resolution: Option<String>,
    pub av1: Option<String>,
}

pub async fn extract_candidates(play_url: &str, cookie: &str) -> Result<Vec<Candidate>> {
    let client = client();
    let html = client
        .get(play_url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let doc = Html::parse_document(&html);
    let button_sel = Selector::parse("button").unwrap();
    let mut out = vec![];
    for el in doc.select(&button_sel) {
        if let Some(src) = el.value().attr("data-src") {
            // Only consider non-AV1 by default, align with script
            let av1 = el.value().attr("data-av1").map(|s| s.to_string());
            let audio = el.value().attr("data-audio").map(|s| s.to_string());
            let resolution = el.value().attr("data-resolution").map(|s| s.to_string());
            out.push(Candidate {
                src: src.to_string(),
                audio,
                resolution,
                av1,
            });
        }
    }
    Ok(out)
}

pub fn select_candidate<'a>(
    candidates: &'a [Candidate],
    audio: Option<&str>,
    resolution: Option<&str>,
) -> Option<&'a Candidate> {
    let mut filtered: Vec<&Candidate> = candidates
        .iter()
        .filter(|c| c.av1.as_deref() != Some("1"))
        .collect();
    if let Some(a) = audio {
        let tmp: Vec<&Candidate> = filtered
            .iter()
            .copied()
            .filter(|c| c.audio.as_deref() == Some(a))
            .collect();
        if !tmp.is_empty() {
            filtered = tmp;
        }
    }
    if let Some(r) = resolution {
        let tmp: Vec<&Candidate> = filtered
            .iter()
            .copied()
            .filter(|c| c.resolution.as_deref() == Some(r))
            .collect();
        if !tmp.is_empty() {
            filtered = tmp;
        }
    }
    // prefer kwik host
    if let Some(c) = filtered.iter().rfind(|c| c.src.contains("kwik")) {
        return Some(*c);
    }
    filtered.last().copied()
}

pub async fn extract_m3u8_from_link(ep_link: &str, cookie: &str, host: &str) -> Result<String> {
    let client = client();
    let text = client
        .get(ep_link)
        .header(reqwest::header::REFERER, host)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    // Find script with eval(
    let re = Regex::new(r"<script>eval\((?s).*?</script>").unwrap();
    let caps = re
        .find(&text)
        .ok_or_else(|| anyhow!("No eval script found"))?;
    let mut script = &text[caps.start()..caps.end()];
    // Trim <script> and </script>
    if let Some(pos) = script.find("<script>") {
        script = &script[pos + 8..];
    }
    if let Some(pos) = script.rfind("</script>") {
        script = &script[..pos];
    }

    // Transform to print unpacked code
    let mut js = script.replace("document", "process");
    js = js.replace("querySelector", "exit");
    js = js.replace("eval(", "console.log(");

    // Execute via Node to unpack
    let node =
        which::which("node").map_err(|_| anyhow!("node not found; required for unpacking"))?;
    let output = Command::new(node)
        .arg("-e")
        .arg(js)
        .output()
        .context("running node")?;
    if !output.status.success() {
        return Err(anyhow!(
            "node failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let printed = String::from_utf8_lossy(&output.stdout);

    // Extract m3u8 URL from printed code
    let re2 = Regex::new(r#"source=['\"]([^'\"]+?\.m3u8)"#).unwrap();
    if let Some(c) = re2.captures(&printed) {
        let url = c.get(1).unwrap().as_str().to_string();
        return Ok(url);
    }
    Err(anyhow!("m3u8 source not found"))
}

fn client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .build()
        .expect("client")
}
