mod api;
mod download;
mod scrape;
mod ui;

fn main() {
    let native_options = eframe::NativeOptions::default();
    if let Err(e) = eframe::run_native(
        "Animepahe DL Desktop",
        native_options,
        Box::new(|cc| Box::new(ui::AnimepaheApp::new(cc))),
    ) {
        eprintln!("failed to start app: {e}");
    }
}
