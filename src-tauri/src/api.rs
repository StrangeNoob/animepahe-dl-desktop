use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SearchResponse {
    pub data: Vec<SearchItem>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SearchItem {
    pub session: String,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReleaseResponse {
    pub last_page: u32,
    pub data: Vec<Episode>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Episode {
    pub episode: serde_json::Value,
    pub session: String,
}

pub async fn search_anime(name: &str, cookie: &str, host: &str) -> Result<Vec<SearchItem>> {
    let client = client();
    let base = host.trim_end_matches('/');
    let url = format!("{}/api?m=search&q={}", base, urlencoding::encode(name));
    let text = client
        .get(url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    let resp: SearchResponse = serde_json::from_str(&text).context("parse search response")?;
    Ok(resp.data)
}

pub async fn fetch_release_page(
    slug: &str,
    page: u32,
    cookie: &str,
    host: &str,
) -> Result<ReleaseResponse> {
    let client = client();
    let base = host.trim_end_matches('/');
    let url = format!(
        "{}/api?m=release&id={}&sort=episode_asc&page={}",
        base, slug, page
    );
    let text = client
        .get(url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;
    let resp: ReleaseResponse = serde_json::from_str(&text).context("parse release page")?;
    Ok(resp)
}

pub async fn fetch_all_episodes(slug: &str, cookie: &str, host: &str) -> Result<Vec<Episode>> {
    let first = fetch_release_page(slug, 1, cookie, host).await?;
    let mut out = first.data.clone();
    for p in 2..=first.last_page {
        let page = fetch_release_page(slug, p, cookie, host).await?;
        out.extend(page.data);
    }
    Ok(out)
}

pub async fn resolve_anime_name(
    slug: &str,
    cookie: &str,
    fallback: &str,
    host: &str,
) -> Result<String> {
    // Best-effort: fetch anime page and read <title>
    let client = client();
    let base = host.trim_end_matches('/');
    let url = format!("{}/anime/{}", base, slug);
    let html = client
        .get(url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .text()
        .await?;
    if let Some(title) = scraper::Html::parse_document(&html)
        .select(&scraper::Selector::parse("title").unwrap())
        .next()
        .map(|n| n.inner_html())
    {
        Ok(title)
    } else {
        Ok(fallback.to_string())
    }
}

pub async fn fetch_anime_poster(
    slug: &str,
    cookie: &str,
    host: &str,
) -> Result<Option<String>> {
    let client = client();
    let base = host.trim_end_matches('/');
    let url = format!("{}/anime/{}", base, slug);
    let html = client
        .get(url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .text()
        .await?;

    let document = scraper::Html::parse_document(&html);

    // Try to find poster image - Animepahe uses div.anime-poster > a > img
    if let Some(img) = document
        .select(&scraper::Selector::parse("div.anime-poster img, div.anime-poster a img").unwrap())
        .next()
    {
        if let Some(src) = img.value().attr("data-src").or_else(|| img.value().attr("src")) {
            return Ok(Some(src.to_string()));
        }
    }

    Ok(None)
}


pub async fn find_session_for_episode(
    slug: &str,
    episode: u32,
    cookie: &str,
    host: &str,
) -> Result<String> {
    let eps = fetch_all_episodes(slug, cookie, host).await?;
    for e in eps {
        if e.episode.as_u64() == Some(episode as u64) {
            return Ok(e.session);
        }
    }
    Err(anyhow!("Episode {} not found", episode))
}

fn client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .build()
        .expect("client")
}
