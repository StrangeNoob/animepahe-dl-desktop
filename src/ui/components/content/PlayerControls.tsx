import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize, Minimize, PictureInPicture, Settings } from "lucide-react";
import { usePlayerStore } from "../../../core/store/player-store";
import { useState } from "react";

interface PlayerControlsProps {
  visible: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PlayerControls({
  visible,
  isFullscreen,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const {
    isPlaying,
    isPaused,
    currentTime,
    duration,
    buffered,
    settings,
    isPipSupported,
    isPipMode,
    pause,
    resume,
    seek,
    setVolume,
    setPlaybackSpeed,
    enterPip,
    exitPip,
    playNext,
    playPrevious,
  } = usePlayerStore();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(settings.volume);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    seek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(settings.volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const speedOptions = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Progress bar */}
      <div
        className="relative h-1 bg-white/20 cursor-pointer group hover:h-2 transition-all"
        onClick={handleProgressClick}
      >
        {/* Buffered progress */}
        <div
          className="absolute h-full bg-white/30 transition-all"
          style={{ width: `${bufferedPercent}%` }}
        />
        {/* Current progress */}
        <div
          className="absolute h-full bg-blue-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        {/* Hover indicator */}
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progressPercent}%`, marginLeft: "-6px" }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        {/* Left controls */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={() => (isPaused || !isPlaying ? resume() : pause())}
            className="hover:text-blue-400 transition-colors"
            aria-label={isPaused || !isPlaying ? "Play" : "Pause"}
          >
            {isPaused || !isPlaying ? (
              <Play className="w-6 h-6" fill="currentColor" />
            ) : (
              <Pause className="w-6 h-6" fill="currentColor" />
            )}
          </button>

          {/* Previous */}
          <button
            onClick={playPrevious}
            className="hover:text-blue-400 transition-colors"
            aria-label="Previous episode"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Next */}
          <button
            onClick={playNext}
            className="hover:text-blue-400 transition-colors"
            aria-label="Next episode"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group">
            <button
              onClick={toggleMute}
              className="hover:text-blue-400 transition-colors"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || settings.volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.volume}
              onChange={handleVolumeChange}
              className="w-0 group-hover:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0"
            />
          </div>

          {/* Time */}
          <span className="text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="hover:text-blue-400 transition-colors flex items-center gap-1"
              aria-label="Playback speed"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm">{settings.playbackSpeed}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg p-2 min-w-[100px]">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`block w-full text-left px-3 py-1 rounded hover:bg-white/10 transition-colors ${
                      settings.playbackSpeed === speed ? "text-blue-400" : ""
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Picture-in-Picture */}
          {isPipSupported && (
            <button
              onClick={() => (isPipMode ? exitPip() : enterPip())}
              className="hover:text-blue-400 transition-colors"
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture className="w-5 h-5" />
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={onToggleFullscreen}
            className="hover:text-blue-400 transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
