import { useEffect, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { usePlayerStore } from "../../../core/store/player-store";
import { Maximize, Minimize } from "lucide-react";
import { getCurrentWindow } from '@tauri-apps/api/window';
// import ReactPlayer from "react-player"; // Using react-player for HLS support with fullscreen

interface VideoPlayerProps {
  className?: string;
}

export function VideoPlayer({ className = "" }: VideoPlayerProps) {
  // Using native HTML5 video element for built-in fullscreen support
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    currentEpisode,
    settings,
    setDuration,
    updateCurrentTime,
    saveProgress,
    recordWatchHistory,
    setError,
  } = usePlayerStore();

  // Initialize video source
  useEffect(() => {
    if (!currentEpisode) return;

    const loadVideoUrl = async () => {
      try {
        if (currentEpisode.source === "local" && currentEpisode.filePath) {
          // Local video playback with audio codec compatibility check
          // If video has HE-AAC audio, it will be converted to AAC LC and cached
          console.log("Loading local video:", currentEpisode.filePath);
          const compatiblePath = await invoke<string>("get_compatible_video_path", {
            filePath: currentEpisode.filePath,
          });
          console.log("Compatible path:", compatiblePath);
          const url = convertFileSrc(compatiblePath);
          console.log("Asset URL:", url);
          setVideoUrl(url);
        } else if (currentEpisode.source === "remote" && currentEpisode.remoteUrl) {
          // Remote video URL
          console.log("Loading remote video:", currentEpisode.remoteUrl);
          setVideoUrl(currentEpisode.remoteUrl);
        }
      } catch (error) {
        console.error("Failed to get video URL:", error);
        setError(error instanceof Error ? error.message : "Failed to load video");
      }
    };

    loadVideoUrl();
  }, [currentEpisode, setError]);


  // Auto-save progress periodically
  useEffect(() => {
    progressIntervalRef.current = setInterval(() => {
      saveProgress();
    }, 10000); // Save every 10 seconds

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [saveProgress]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Native HTML5 video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      updateCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      console.log("Video metadata loaded. Duration:", videoRef.current.duration);
    }
  };

  const handleCanPlay = () => {
    console.log("Video can play - ready state:", videoRef.current?.readyState);
  };

  const handleEnded = async () => {
    await recordWatchHistory();
    await saveProgress();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    console.error("Video error event:", {
      error: video.error,
      code: video.error?.code,
      message: video.error?.message,
      networkState: video.networkState,
      readyState: video.readyState,
    });
    setError(video.error?.message || "Failed to load video");
  };

  // Toggle fullscreen mode
  const toggleFullscreen = async () => {
    // if (!containerRef.current) return;

    // try {
    //   if (!isFullscreen) {
    //     // Enter fullscreen
    //     if (containerRef.current.requestFullscreen) {
    //       await containerRef.current.requestFullscreen();
    //     } else if ((containerRef.current as any).webkitRequestFullscreen) {
    //       // Safari/WebKit
    //       await (containerRef.current as any).webkitRequestFullscreen();
    //     }
    //   } else {
    //     // Exit fullscreen
    //     if (document.exitFullscreen) {
    //       await document.exitFullscreen();
    //     } else if ((document as any).webkitExitFullscreen) {
    //       // Safari/WebKit
    //       await (document as any).webkitExitFullscreen();
    //     }
    //   }
    // } catch (error) {
    //   console.error("Fullscreen toggle error:", error);
    // }
    const appWindow = getCurrentWindow();
    const isFullscreen = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFullscreen);
    console.log("Fullscreen set to:", isFullscreen);
    console.log("Window:", appWindow);

  };

  // ReactPlayer event handlers (commented out - not working, reverted to native HTML5)
  // const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
  //   const video = event.currentTarget;
  //   updateCurrentTime(video.currentTime);
  // };

  // const handleDurationChange = (event: React.SyntheticEvent<HTMLVideoElement>) => {
  //   const video = event.currentTarget;
  //   setDuration(video.duration);
  //   console.log("Video metadata loaded. Duration:", video.duration);
  // };

  // const handleEnded = async () => {
  //   await recordWatchHistory();
  //   await saveProgress();
  // };

  // const handleCanPlay = () => {
  //   console.log("Video ready to play");
  // };

  // const handleError = (event: React.SyntheticEvent<HTMLVideoElement>) => {
  //   const video = event.currentTarget;
  //   console.error("Video error event:", video.error);
  //   setError(video.error?.message || "Failed to load video");
  // };

  if (!currentEpisode) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <p>No episode selected</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative bg-black ${className}`}>
      {/* Native HTML5 video element with built-in fullscreen support */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={videoUrl}
        controls
        autoPlay={false}
        playsInline
        preload="metadata"
        controlsList="nodownload"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onError={handleError}
        webkit-playsinline="true"
        x-webkit-airplay="allow"
      >
        Your browser does not support the video tag.
      </video>

      {/* Custom Fullscreen Button - positioned in top-right corner */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors backdrop-blur-sm z-10 group"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5" />
        ) : (
          <Maximize className="w-5 h-5" />
        )}
      </button>

      {/* ReactPlayer (commented out - was causing errors, video not playing) */}
      {/* <ReactPlayer
        ref={videoRef}
        src={videoUrl}
        controls
        width="100%"
        height="100%"
        playing={false}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
        onError={handleError}
        controlsList="nodownload"
        playsInline
        config={{
          hls: {
            // HLS.js configuration for .m3u8 streams
            debug: false,
          }
        }}
      /> */}
    </div>
  );
}
