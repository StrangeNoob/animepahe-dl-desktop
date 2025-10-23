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
    #[serde(default)]
    pub poster: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
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
    #[serde(default)]
    pub snapshot: Option<String>,
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
        .get(&url)
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

/// Extract status from anime title (e.g., "[Completed]", "[Ongoing]")
/// Returns "completed", "ongoing", or None if status not found
fn extract_anime_status(title: &str) -> Option<String> {
    if title.contains("[Completed]") || title.contains("[Complete]") {
        Some("completed".to_string())
    } else if title.contains("[Ongoing]") {
        Some("ongoing".to_string())
    } else {
        None
    }
}

/// Clean anime title by removing metadata suffixes like "Ep. 1-12 [Completed] :: animepahe"
fn clean_anime_title(title: &str) -> String {
    let mut cleaned = title.to_string();

    // Remove " :: animepahe" or " :: AnimePahe" suffix
    if let Some(pos) = cleaned.find(" :: ") {
        cleaned.truncate(pos);
    }

    // Remove " Ep. X-Y [Status]" pattern
    // This handles patterns like " Ep. 1-12 [Completed]" or " Ep. 1 [Ongoing]"
    if let Some(pos) = cleaned.find(" Ep. ") {
        cleaned.truncate(pos);
    }

    cleaned.trim().to_string()
}

#[allow(dead_code)]
pub async fn resolve_anime_name(
    slug: &str,
    cookie: &str,
    fallback: &str,
    host: &str,
) -> Result<String> {
    let (title, _) = resolve_anime_info(slug, cookie, fallback, host).await?;
    Ok(title)
}

/// Resolve anime info including cleaned title and status
/// Returns (cleaned_title, optional_status)
#[allow(dead_code)]
pub async fn resolve_anime_info(
    slug: &str,
    cookie: &str,
    fallback: &str,
    host: &str,
) -> Result<(String, Option<String>)> {
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
        let status = extract_anime_status(&title);
        let cleaned = clean_anime_title(&title);
        Ok((cleaned, status))
    } else {
        Ok((fallback.to_string(), None))
    }
}

/// Rich anime metadata scraped from detail page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeMetadata {
    pub title: String,
    pub synopsis: Option<String>,
    pub genres: Vec<String>,
    pub season: Option<String>,
    pub year: Option<u32>,
    pub anime_type: Option<String>,
    pub status: Option<String>,
    pub mal_link: Option<String>,
    pub poster_url: Option<String>,
}

/// Scrape full anime metadata from detail page
pub async fn fetch_anime_metadata(
    slug: &str,
    cookie: &str,
    host: &str,
) -> Result<AnimeMetadata> {
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

    // Extract title from <title> tag and clean it
    let title = document
        .select(&scraper::Selector::parse("title").unwrap())
        .next()
        .map(|n| clean_anime_title(&n.inner_html()))
        .unwrap_or_else(|| slug.to_string());

    // Extract status
    let status = document
        .select(&scraper::Selector::parse("title").unwrap())
        .next()
        .and_then(|n| extract_anime_status(&n.inner_html()));

    // Extract synopsis from div.anime-synopsis
    let synopsis = document
        .select(&scraper::Selector::parse("div.anime-synopsis").unwrap())
        .next()
        .map(|n| {
            n.text()
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_string()
        })
        .filter(|s| !s.is_empty());

    // Extract genres from theme, genre, and demographic links
    let mut genres = Vec::new();
    for selector in &[
        "a[href^='/anime/theme/']",
        "a[href^='/anime/genre/']",
        "a[href^='/anime/demographic/']",
    ] {
        if let Ok(sel) = scraper::Selector::parse(selector) {
            for element in document.select(&sel) {
                let genre = element.text().collect::<Vec<_>>().join("").trim().to_string();
                if !genre.is_empty() && !genres.contains(&genre) {
                    genres.push(genre);
                }
            }
        }
    }

    // Extract MAL link
    let mal_link = document
        .select(&scraper::Selector::parse("a[title*='MyAnimeList']").unwrap())
        .next()
        .and_then(|a| a.value().attr("href"))
        .map(|s| s.to_string());

    // Extract type
    let anime_type = document
        .select(&scraper::Selector::parse("a[href^='/anime/type/']").unwrap())
        .next()
        .map(|a| a.text().collect::<Vec<_>>().join("").trim().to_string());

    // Extract season (e.g., "Fall 2024")
    let season = document
        .select(&scraper::Selector::parse("a[href^='/anime/season/']").unwrap())
        .next()
        .map(|a| a.text().collect::<Vec<_>>().join("").trim().to_string());

    // Extract year from season if available
    let year = season.as_ref().and_then(|s| {
        s.split_whitespace()
            .last()
            .and_then(|y| y.parse::<u32>().ok())
    });

    // Extract poster image
    let poster_url = document
        .select(&scraper::Selector::parse("div.anime-poster img, div.anime-poster a img").unwrap())
        .next()
        .and_then(|img| img.value().attr("data-src").or_else(|| img.value().attr("src")))
        .map(|s| s.to_string());

    Ok(AnimeMetadata {
        title,
        synopsis,
        genres,
        season,
        year,
        anime_type,
        status,
        mal_link,
        poster_url,
    })
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FeaturedAnime {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub year: Option<u32>,
    pub rating: Option<f64>,
    pub genres: Vec<String>,
}

pub async fn fetch_featured_anime(
    cookie: &str,
    host: &str,
) -> Result<Vec<FeaturedAnime>> {
    let client = client();
    let base = host.trim_end_matches('/');
    let url = format!("{}/", base);

    let html = client
        .get(&url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;

    let document = scraper::Html::parse_document(&html);
    let mut featured = Vec::new();

    // Try multiple selectors for anime cards on the homepage
    // AnimePahe typically uses cards with class names like "anime-card", "item", or within divs
    let card_selectors = vec![
        "div.anime-poster",
        "div.col-sm-6.col-md-4.col-lg-3",
        "article.item",
        "div.item",
    ];

    for selector_str in card_selectors {
        if let Ok(selector) = scraper::Selector::parse(selector_str) {
            for element in document.select(&selector).take(10) {
                // Extract anime link/slug
                if let Some(link) = element
                    .select(&scraper::Selector::parse("a").unwrap())
                    .next()
                {
                    if let Some(href) = link.value().attr("href") {
                        // Extract slug from URL like "/anime/attack-on-titan"
                        let slug = href.trim_start_matches("/anime/").trim_end_matches('/').to_string();

                        if slug.is_empty() || slug.contains('/') {
                            continue;
                        }

                        // Extract title
                        let title = link.value().attr("title")
                            .or_else(|| link.value().attr("data-original-title"))
                            .unwrap_or(&slug)
                            .to_string();

                        // Extract image URL
                        let image_url = element
                            .select(&scraper::Selector::parse("img").unwrap())
                            .next()
                            .and_then(|img| {
                                img.value().attr("data-src")
                                    .or_else(|| img.value().attr("src"))
                                    .map(|s| s.to_string())
                            });

                        featured.push(FeaturedAnime {
                            slug,
                            title,
                            description: None,
                            image_url,
                            year: None,
                            rating: None,
                            genres: Vec::new(),
                        });
                    }
                }
            }
        }

        // If we found enough anime, stop searching
        if featured.len() >= 6 {
            break;
        }
    }

    // If we couldn't find any featured anime, return empty vec instead of error
    // The frontend will handle displaying a message or fallback
    Ok(featured)
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestRelease {
    pub slug: String,
    pub anime_title: String,
    pub episode_number: u32,
    pub snapshot_url: String,
    pub session_id: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedLatestReleases {
    pub releases: Vec<LatestRelease>,
    pub current_page: u32,
    pub total_items: u32,
    pub per_page: u32,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct LatestReleaseApiResponse {
    #[allow(dead_code)]
    pub total: u32,
    #[allow(dead_code)]
    pub per_page: Option<u32>,
    #[allow(dead_code)]
    pub current_page: Option<u32>,
    #[allow(dead_code)]
    pub last_page: Option<u32>,
    pub data: Vec<LatestReleaseApiData>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct LatestReleaseApiData {
    #[allow(dead_code)]
    pub id: u32,
    #[allow(dead_code)]
    pub anime_id: u32,
    pub anime_title: String,
    pub anime_session: String,
    pub episode: u32,
    pub snapshot: String,
    pub session: String,
    #[allow(dead_code)]
    pub created_at: String,
}

pub async fn fetch_latest_releases(
    cookie: &str,
    host: &str,
    page: u32,
) -> Result<PaginatedLatestReleases> {
    let client = client();
    let base = host.trim_end_matches('/');

    // Try the API endpoint for latest releases
    // Based on existing API patterns, AnimePahe likely uses /api?m=airing or similar
    let api_url = format!("{}/api?m=airing&page={}", base, page);

    let text = client
        .get(&api_url)
        .header(reqwest::header::COOKIE, cookie)
        .send()
        .await?
        .error_for_status()?
        .text()
        .await?;


    let api_response: LatestReleaseApiResponse = serde_json::from_str(&text)
        .context("Failed to parse latest releases API response")?;


    let releases: Vec<LatestRelease> = api_response.data
        .into_iter()
        .map(|item| LatestRelease {
            slug: item.anime_session,
            anime_title: item.anime_title,
            episode_number: item.episode,
            snapshot_url: item.snapshot,
            session_id: item.session,
        })
        .collect();

    // Calculate pagination metadata
    let per_page = api_response.per_page.unwrap_or(30);
    let current_page = api_response.current_page.unwrap_or(page);
    let total_pages = api_response.last_page.unwrap_or_else(|| {
        ((api_response.total as f32) / (per_page as f32)).ceil() as u32
    });

    Ok(PaginatedLatestReleases {
        releases,
        current_page,
        total_items: api_response.total,
        per_page,
        total_pages,
        has_next: current_page < total_pages,
        has_prev: current_page > 1,
    })
}

fn client() -> Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36")
        .build()
        .expect("client")
}

pub async fn fetch_image_with_referer(
    url: &str,
    host: &str,
) -> Result<Vec<u8>> {
    let client = client();
    let base = host.trim_end_matches('/');

    let bytes = client
        .get(url)
        .header(reqwest::header::REFERER, base)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    Ok(bytes.to_vec())
}
