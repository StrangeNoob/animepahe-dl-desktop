use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub id: i64,
    pub anime_name: String,
    pub slug: String,
    pub episode: i32,
    pub resolution: Option<String>,
    pub audio: Option<String>,
    pub file_path: String,
    pub file_size: i64,
    pub thumbnail_url: Option<String>,
    pub downloaded_at: i64,
    pub last_watched: Option<i64>,
    pub watch_count: i64,
    pub duration_seconds: Option<i64>,
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimeStats {
    pub slug: String,
    pub anime_name: String,
    pub episode_count: i64,
    pub total_size: i64,
    pub thumbnail_url: Option<String>,
    pub last_downloaded: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryStats {
    pub total_anime: i64,
    pub total_episodes: i64,
    pub total_size: i64,
    pub total_watch_time: i64,
}

#[derive(Debug, Clone)]
pub struct Library {
    conn: Arc<Mutex<Connection>>,
}

impl Library {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(&db_path)
            .context("Failed to open library database")?;

        // Create table with UNIQUE constraint on (slug, episode)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anime_name TEXT NOT NULL,
                slug TEXT NOT NULL,
                episode INTEGER NOT NULL,
                resolution TEXT,
                audio TEXT,
                file_path TEXT NOT NULL UNIQUE,
                file_size INTEGER NOT NULL,
                thumbnail_url TEXT,
                downloaded_at INTEGER NOT NULL,
                last_watched INTEGER,
                watch_count INTEGER DEFAULT 0,
                duration_seconds INTEGER,
                host TEXT NOT NULL,
                UNIQUE(slug, episode)
            )",
            [],
        ).context("Failed to create library table")?;

        Ok(Library {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn add_download(
        &self,
        anime_name: &str,
        slug: &str,
        episode: i32,
        resolution: Option<&str>,
        audio: Option<&str>,
        file_path: &str,
        file_size: i64,
        thumbnail_url: Option<&str>,
        host: &str,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();

        conn.execute(
            "INSERT OR REPLACE INTO library
            (anime_name, slug, episode, resolution, audio, file_path, file_size, thumbnail_url, downloaded_at, host)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![anime_name, slug, episode, resolution, audio, file_path, file_size, thumbnail_url, now, host],
        ).context("Failed to insert library entry")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_library_entries(&self) -> Result<Vec<LibraryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, anime_name, slug, episode, resolution, audio, file_path, file_size,
             thumbnail_url, downloaded_at, last_watched, watch_count, duration_seconds, host
             FROM library ORDER BY downloaded_at DESC"
        )?;

        let entries = stmt.query_map([], |row| {
            Ok(LibraryEntry {
                id: row.get(0)?,
                anime_name: row.get(1)?,
                slug: row.get(2)?,
                episode: row.get(3)?,
                resolution: row.get(4)?,
                audio: row.get(5)?,
                file_path: row.get(6)?,
                file_size: row.get(7)?,
                thumbnail_url: row.get(8)?,
                downloaded_at: row.get(9)?,
                last_watched: row.get(10)?,
                watch_count: row.get(11)?,
                duration_seconds: row.get(12)?,
                host: row.get(13)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(entries)
    }

    pub fn get_anime_library(&self) -> Result<Vec<AnimeStats>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT slug, anime_name, COUNT(*) as episode_count, SUM(file_size) as total_size,
             MAX(thumbnail_url) as thumbnail_url, MAX(downloaded_at) as last_downloaded
             FROM library
             GROUP BY slug, anime_name
             ORDER BY last_downloaded DESC"
        )?;

        let stats = stmt.query_map([], |row| {
            Ok(AnimeStats {
                slug: row.get(0)?,
                anime_name: row.get(1)?,
                episode_count: row.get(2)?,
                total_size: row.get(3)?,
                thumbnail_url: row.get(4)?,
                last_downloaded: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(stats)
    }

    pub fn get_anime_episodes(&self, slug: &str) -> Result<Vec<LibraryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, anime_name, slug, episode, resolution, audio, file_path, file_size,
             thumbnail_url, downloaded_at, last_watched, watch_count, duration_seconds, host
             FROM library WHERE slug = ?1 ORDER BY episode ASC"
        )?;

        let entries = stmt.query_map(params![slug], |row| {
            Ok(LibraryEntry {
                id: row.get(0)?,
                anime_name: row.get(1)?,
                slug: row.get(2)?,
                episode: row.get(3)?,
                resolution: row.get(4)?,
                audio: row.get(5)?,
                file_path: row.get(6)?,
                file_size: row.get(7)?,
                thumbnail_url: row.get(8)?,
                downloaded_at: row.get(9)?,
                last_watched: row.get(10)?,
                watch_count: row.get(11)?,
                duration_seconds: row.get(12)?,
                host: row.get(13)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(entries)
    }

    pub fn check_episode_downloaded(&self, slug: &str, episode: i32) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM library WHERE slug = ?1 AND episode = ?2",
            params![slug, episode],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    pub fn get_library_entry(&self, slug: &str, episode: i32) -> Result<Option<LibraryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, anime_name, slug, episode, resolution, audio, file_path, file_size,
             thumbnail_url, downloaded_at, last_watched, watch_count, duration_seconds, host
             FROM library WHERE slug = ?1 AND episode = ?2"
        )?;

        let result = stmt.query_row(params![slug, episode], |row| {
            Ok(LibraryEntry {
                id: row.get(0)?,
                anime_name: row.get(1)?,
                slug: row.get(2)?,
                episode: row.get(3)?,
                resolution: row.get(4)?,
                audio: row.get(5)?,
                file_path: row.get(6)?,
                file_size: row.get(7)?,
                thumbnail_url: row.get(8)?,
                downloaded_at: row.get(9)?,
                last_watched: row.get(10)?,
                watch_count: row.get(11)?,
                duration_seconds: row.get(12)?,
                host: row.get(13)?,
            })
        });

        match result {
            Ok(entry) => Ok(Some(entry)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn mark_episode_watched(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();

        conn.execute(
            "UPDATE library SET last_watched = ?1, watch_count = watch_count + 1 WHERE id = ?2",
            params![now, id],
        )?;

        Ok(())
    }

    pub fn delete_library_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM library WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_anime(&self, slug: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM library WHERE slug = ?1", params![slug])?;
        Ok(())
    }

    pub fn get_library_stats(&self) -> Result<LibraryStats> {
        let conn = self.conn.lock().unwrap();

        let (total_anime, total_episodes, total_size, total_watch_time): (i64, i64, i64, i64) = conn.query_row(
            "SELECT
                COUNT(DISTINCT slug),
                COUNT(*),
                COALESCE(SUM(file_size), 0),
                COALESCE(SUM(duration_seconds * watch_count), 0)
             FROM library",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;

        Ok(LibraryStats {
            total_anime,
            total_episodes,
            total_size,
            total_watch_time,
        })
    }

    pub fn search_library(&self, query: &str) -> Result<Vec<AnimeStats>> {
        let conn = self.conn.lock().unwrap();
        let search_pattern = format!("%{}%", query);

        let mut stmt = conn.prepare(
            "SELECT slug, anime_name, COUNT(*) as episode_count, SUM(file_size) as total_size,
             thumbnail_url, MAX(downloaded_at) as last_downloaded
             FROM library
             WHERE anime_name LIKE ?1
             GROUP BY slug, anime_name
             ORDER BY last_downloaded DESC"
        )?;

        let stats = stmt.query_map(params![search_pattern], |row| {
            Ok(AnimeStats {
                slug: row.get(0)?,
                anime_name: row.get(1)?,
                episode_count: row.get(2)?,
                total_size: row.get(3)?,
                thumbnail_url: row.get(4)?,
                last_downloaded: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(stats)
    }

    pub fn export_library(&self) -> Result<String> {
        let entries = self.get_library_entries()?;
        serde_json::to_string_pretty(&entries).context("Failed to serialize library")
    }

    pub fn import_library(&self, json: &str) -> Result<usize> {
        let entries: Vec<LibraryEntry> = serde_json::from_str(json)
            .context("Failed to parse library JSON")?;

        let conn = self.conn.lock().unwrap();
        let mut imported = 0;

        for entry in entries {
            let result = conn.execute(
                "INSERT OR REPLACE INTO library
                (anime_name, slug, episode, resolution, audio, file_path, file_size, thumbnail_url, downloaded_at, last_watched, watch_count, duration_seconds, host)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    entry.anime_name, entry.slug, entry.episode, entry.resolution, entry.audio,
                    entry.file_path, entry.file_size, entry.thumbnail_url, entry.downloaded_at,
                    entry.last_watched, entry.watch_count, entry.duration_seconds, entry.host
                ],
            );

            if result.is_ok() {
                imported += 1;
            }
        }

        Ok(imported)
    }

    pub fn update_poster_path(&self, slug: &str, poster_path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE library SET thumbnail_url = ?1 WHERE slug = ?2",
            params![poster_path, slug],
        )?;
        Ok(())
    }
}
