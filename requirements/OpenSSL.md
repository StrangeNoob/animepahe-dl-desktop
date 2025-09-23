# OpenSSL Installation Guide

OpenSSL is required for decrypting encrypted video segments when using multi-threaded downloads in Animepahe DL Desktop.

## Windows

### Option 1: Chocolatey (Recommended)
```bash
choco install openssl
```

### Option 2: Scoop
```bash
scoop install openssl
```

### Option 3: winget
```bash
winget install ShiningLight.OpenSSL
```

### Option 4: Pre-compiled Binaries
1. Visit [slproweb.com/products/Win32OpenSSL.html](https://slproweb.com/products/Win32OpenSSL.html)
2. Download the appropriate version (64-bit recommended)
3. Run the installer and follow the setup wizard
4. Add OpenSSL to your PATH:
   - Default installation path: `C:\Program Files\OpenSSL-Win64\bin`
   - Add this to your system PATH environment variable
   - Restart your command prompt

### Option 5: Git for Windows (If installed)
Git for Windows includes OpenSSL. If you have Git installed, OpenSSL might already be available:
```bash
# Check if available through Git
"C:\Program Files\Git\usr\bin\openssl.exe" version
```

## macOS

### Option 1: Homebrew (Recommended)
```bash
brew install openssl
```

### Option 2: MacPorts
```bash
sudo port install openssl3 +universal
```

### Option 3: Pre-installed (macOS 10.15+)
macOS comes with LibreSSL by default, but OpenSSL might also be available:
```bash
# Check if already available
openssl version
```

If you need the latest OpenSSL specifically:
```bash
# With Homebrew, link it properly
brew install openssl
echo 'export PATH="/opt/homebrew/opt/openssl@3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Linux

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install openssl
```

### RHEL/CentOS/Fedora
```bash
sudo dnf install openssl
```

### Arch Linux
```bash
sudo pacman -S openssl
```

### openSUSE
```bash
sudo zypper install openssl
```

### Alpine Linux
```bash
apk add openssl
```

### Compile from Source
```bash
# Install dependencies (Ubuntu/Debian example)
sudo apt update
sudo apt install build-essential zlib1g-dev

# Download and compile
wget https://www.openssl.org/source/openssl-3.1.4.tar.gz
tar -xzf openssl-3.1.4.tar.gz
cd openssl-3.1.4
./Configure
make
sudo make install

# Update library path
sudo ldconfig
```

## Verification

After installation, verify OpenSSL is installed correctly:

```bash
openssl version
```

You should see OpenSSL version information.

Test the specific functionality needed by the application:
```bash
# Test AES-128-CBC decryption (used by the application)
echo "test" | openssl enc -aes-128-cbc -k "password" | openssl enc -aes-128-cbc -d -k "password"
```

## Troubleshooting

### Command not found
- **Windows**:
  - Check if OpenSSL is in your PATH
  - Try running from the full path: `"C:\Program Files\OpenSSL-Win64\bin\openssl.exe"`
  - Restart your command prompt after installation
- **macOS**:
  - Run `which openssl` to find the location
  - If using Homebrew, ensure the PATH is updated
- **Linux**:
  - Run `which openssl` to verify installation
  - Try `sudo apt update && sudo apt install openssl` to reinstall

### Version conflicts
Some systems have multiple OpenSSL versions:
```bash
# Check all available versions
ls -la $(which openssl)
openssl version -a

# Use specific version (example)
/usr/local/bin/openssl version
```

### Permission issues (Linux/macOS)
If you encounter permission issues:
```bash
# Check current permissions
ls -la $(which openssl)

# If needed, fix permissions
sudo chmod +x $(which openssl)
```

### Library issues (Linux)
If you get library-related errors:
```bash
# Update library cache
sudo ldconfig

# Check library dependencies
ldd $(which openssl)

# Install development packages if needed
sudo apt install libssl-dev  # Ubuntu/Debian
sudo dnf install openssl-devel  # Fedora/RHEL
```

## Why OpenSSL is Required

Animepahe DL Desktop uses OpenSSL to:
- Decrypt AES-128-CBC encrypted video segments
- Handle secure video streams that require cryptographic operations
- Process encrypted HLS (HTTP Live Streaming) content
- Ensure video segments can be properly decrypted and merged

**Note**: OpenSSL is only required when using multi-threaded downloads (threads > 1). Single-threaded downloads use FFmpeg's built-in decryption capabilities and don't require a separate OpenSSL installation.

Without OpenSSL, multi-threaded downloads of encrypted content will fail during the decryption process.