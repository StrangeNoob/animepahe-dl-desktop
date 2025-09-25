use anyhow::{anyhow, Context, Result};
use quick_js::Context as JsContext;
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use serde::Serialize;
use serde_json;
use std::time::Duration;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize)]
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
    eprintln!("Extracting m3u8 from: {}", ep_link);

    let client = client();

    // Add timeout to HTTP request
    let text = timeout(Duration::from_secs(30), async {
        client
            .get(ep_link)
            .header(reqwest::header::REFERER, host)
            .header(reqwest::header::COOKIE, cookie)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await
    })
    .await
    .context("HTTP request timed out after 30 seconds")?
    .context("Failed to fetch page content")?;

    eprintln!("Downloaded page content, length: {} bytes", text.len());

    // Find script with eval(
    let re = Regex::new(r"<script>eval\((?s).*?</script>").unwrap();
    let caps = re
        .find(&text)
        .ok_or_else(|| anyhow!("No eval script found in page content"))?;
    let mut script = &text[caps.start()..caps.end()];

    eprintln!("Found eval script, length: {} bytes", script.len());

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

    eprintln!("Executing JavaScript to extract m3u8...");

    let js_literal = serde_json::to_string(&js).context("escape script for JS evaluation")?;
    let wrapper = format!(
        r#"(function() {{
  let output = "";
  const console = {{
    log: (...args) => {{
      output += args.map(value => String(value)).join(" ") + "\n";
    }}
  }};
  globalThis.console = console;
  globalThis.process = {{}};
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  globalThis.atob = function(input) {{
    const str = String(input).replace(/=+$/, "");
    if (str.length % 4 === 1) {{
      throw new Error("Invalid base64");
    }}
    let bc = 0, bs = 0, buffer, idx = 0, result = "";
    for (; (buffer = str.charAt(idx++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? result += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {{
      buffer = chars.indexOf(buffer);
    }}
    return result;
  }};
  try {{
    eval({js_literal});
  }} catch (err) {{
    output += String(err) + "\n";
  }}
  return output;
}})()"#
    );

    let printed = timeout(Duration::from_secs(10), async move {
        tokio::task::spawn_blocking(move || -> Result<String> {
            let ctx = JsContext::new()
                .map_err(|err| anyhow!("Failed to create JavaScript context: {err}"))?;
            let output: String = ctx
                .eval_as(wrapper.as_str())
                .map_err(|err| anyhow!("JavaScript evaluation failed: {err}"))?;
            Ok(output)
        })
        .await
        .map_err(|err| anyhow!("JavaScript execution task failed: {err}"))?
    })
    .await
    .context("JavaScript execution timed out after 10 seconds")??;

    eprintln!("JavaScript output length: {} bytes", printed.len());

    // Extract m3u8 URL from printed code
    let re2 = Regex::new(r#"source=['\"]([^'\"]+?\.m3u8)"#).unwrap();
    if let Some(c) = re2.captures(&printed) {
        let url = c.get(1).unwrap().as_str().to_string();
        eprintln!("Successfully extracted m3u8 URL: {}", url);
        return Ok(url);
    }

    eprintln!("Failed to find m3u8 URL in output: {}", printed);
    Err(anyhow!("m3u8 source not found in unpacked JavaScript"))
}

fn client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .expect("client")
}
