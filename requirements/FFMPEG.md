# FFmpeg Installation Guide

FFmpeg is required for downloading and processing video streams in Animepahe DL Desktop.

## Windows

### Option 1: Chocolatey (Recommended)
```bash
choco install ffmpeg
```

### Option 2: Scoop
```bash
scoop install ffmpeg
```

### Option 3: winget
```bash
winget install Gyan.FFmpeg
```

### Option 4: Manual Installation
1. Visit [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Click "Windows" and choose a build (gyan.dev builds are recommended)
3. Download the "release essentials" build
4. Extract the zip file to a folder (e.g., `C:\ffmpeg`)
5. Add the `bin` folder to your PATH:
   - Open System Properties → Advanced → Environment Variables
   - Edit the `Path` variable and add `C:\ffmpeg\bin`
   - Restart your command prompt

## macOS

### Option 1: Homebrew (Recommended)
```bash
brew install ffmpeg
```

### Option 2: MacPorts
```bash
sudo port install ffmpeg +universal
```

### Option 3: Manual Installation
1. Visit [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Click "macOS" and download a static build
3. Extract and move the binary to `/usr/local/bin/`
4. Make it executable: `chmod +x /usr/local/bin/ffmpeg`

## Linux

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

### RHEL/CentOS/Fedora
```bash
# Enable RPM Fusion repository first
sudo dnf install https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm

# Install FFmpeg
sudo dnf install ffmpeg
```

### Arch Linux
```bash
sudo pacman -S ffmpeg
```

### openSUSE
```bash
# Add Packman repository for multimedia packages
sudo zypper addrepo -cfp 90 'https://ftp.gwdg.de/pub/linux/misc/packman/suse/openSUSE_Tumbleweed/' packman
sudo zypper refresh
sudo zypper install ffmpeg
```

### Snap (Universal)
```bash
sudo snap install ffmpeg
```

### Flatpak
```bash
flatpak install flathub org.ffmpeg.FFmpeg
```

### AppImage (Portable)
1. Download FFmpeg AppImage from [github.com/sudo-nautilus/FFmpeg-AppImage](https://github.com/sudo-nautilus/FFmpeg-AppImage)
2. Make it executable: `chmod +x FFmpeg-*.AppImage`
3. Run it: `./FFmpeg-*.AppImage`

### Compile from Source
```bash
# Install dependencies (Ubuntu/Debian example)
sudo apt update
sudo apt install autoconf automake build-essential cmake git-core libass-dev libfreetype6-dev libgnutls28-dev libmp3lame-dev libsdl2-dev libtool libva-dev libvdpau-dev libvorbis-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev meson ninja-build pkg-config texinfo wget yasm zlib1g-dev

# Clone and compile
git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
cd ffmpeg
./configure
make
sudo make install
```

## Verification

After installation, verify FFmpeg is installed correctly:

```bash
ffmpeg -version
```

You should see FFmpeg version information, configuration details, and available libraries.

## Troubleshooting

### Command not found
- **Windows**: Restart your command prompt or check if FFmpeg is in your PATH
- **macOS/Linux**: Restart your terminal or run `which ffmpeg` to check if it's installed

### Missing codecs/libraries
If you encounter codec-related errors:
- **Windows**: Use the "full" build instead of "essentials"
- **Linux**: Install additional codec packages:
  ```bash
  # Ubuntu/Debian
  sudo apt install ubuntu-restricted-extras

  # Fedora
  sudo dnf install gstreamer1-plugins-{bad-\*,good-\*,base} gstreamer1-plugin-openh264 gstreamer1-libav --exclude=gstreamer1-plugins-bad-free-devel
  ```

### Permission issues (macOS/Linux)
If FFmpeg installation fails due to permissions:
```bash
# Use homebrew or package manager instead of manual installation
# Or install to user directory:
./configure --prefix="$HOME/ffmpeg_build"
make install
echo 'export PATH="$HOME/ffmpeg_build/bin:$PATH"' >> ~/.bashrc
```

### GPU acceleration (Optional)
For better performance, you can enable hardware acceleration:
- **NVIDIA**: Install CUDA toolkit and use builds with `--enable-cuda-nvcc`
- **Intel**: Use builds with `--enable-vaapi` (Linux) or `--enable-videotoolbox` (macOS)
- **AMD**: Use builds with `--enable-amf` (Windows) or `--enable-vaapi` (Linux)

## Why FFmpeg is Required

Animepahe DL Desktop uses FFmpeg to:
- Download HLS (HTTP Live Streaming) video streams
- Convert and merge video segments into playable MP4 files
- Handle encrypted video streams with proper decryption
- Provide progress tracking during video downloads
- Ensure cross-platform video compatibility

Without FFmpeg, the application cannot download or process video files and will fail during the download process.