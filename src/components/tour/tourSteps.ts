import type { TourStep } from "../../types";

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Animepahe DL Desktop! 🌸",
    content:
      "This tour will guide you through the key features of the app. You'll learn how to search for anime, select episodes, and download them with ease. Let's get started!",
    placement: "bottom",
  },
  {
    id: "search",
    title: "Search for Anime",
    content:
      "Start by typing an anime title here. The app will search Animepahe automatically and show matching results as you type. Select a result to load its information.",
    target: "[data-tour='search-input']",
    placement: "bottom",
    allowClicksThruHole: true,
  },
  {
    id: "filters",
    title: "Configure Download Settings",
    content:
      "Set your preferred resolution (1080p, 720p, etc.), audio language (Sub/Dub), and number of download threads. You can also specify which episodes to download using patterns like '1,3-5,*'.",
    target: "[data-tour='filters-section']",
    placement: "right",
  },
  {
    id: "episodes-fetch",
    title: "Fetch Episode List",
    content:
      "Once you've selected an anime, click 'Fetch episodes' to load all available episodes. This will populate the episode grid on the right.",
    target: "[data-tour='fetch-button']",
    placement: "top",
  },
  {
    id: "episodes-grid",
    title: "Select Episodes",
    content:
      "Here you can see all available episodes. Check the boxes to select specific episodes, or use 'Select all' for the entire series. You can also use the 'Use as spec' button to convert your selection into an episode specification.",
    target: "[data-tour='episodes-section']",
    placement: "left",
  },
  {
    id: "preview",
    title: "Preview Sources",
    content:
      "Before downloading, you can preview the available video sources. This shows you the different audio/resolution combinations available for your selected episodes.",
    target: "[data-tour='preview-button']",
    placement: "right",
  },
  {
    id: "output-folder",
    title: "Choose Output Folder",
    content:
      "Select where you want your downloads to be saved. If no folder is selected, files will be saved to the project folder by default.",
    target: "[data-tour='output-folder']",
    placement: "top",
  },
  {
    id: "download",
    title: "Start Download",
    content:
      "When you're ready, click the Download button to start downloading your selected episodes. Progress will be shown in the Download Status panel on the right.",
    target: "[data-tour='download-button']",
    placement: "right",
  },
  {
    id: "download-status",
    title: "Monitor Progress",
    content:
      "Watch your download progress here. You'll see the status of each episode, including download progress bars and completion status. The app supports multi-threaded downloads for faster speeds!",
    target: "[data-tour='download-status']",
    placement: "left",
  },
  {
    id: "settings",
    title: "App Settings",
    content:
      "Switch between light and dark themes, change the base URL if needed, and access other settings from this header area. Your preferences are automatically saved.",
    target: "[data-tour='settings-section']",
    placement: "bottom",
  },
  {
    id: "complete",
    title: "You're All Set! ✨",
    content:
      "That's everything you need to know to get started. The app will automatically check for required dependencies (Node.js, FFmpeg, OpenSSL) and guide you through installation if needed. Happy downloading!",
    placement: "bottom",
  },
];
