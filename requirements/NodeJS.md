# Node.js Installation Guide

Node.js is required for JavaScript deobfuscation/unpacking functionality in Animepahe DL Desktop.

## Windows

### Option 1: Official Installer (Recommended)
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the LTS version for Windows
3. Run the installer and follow the setup wizard
4. Restart your command prompt/terminal

### Option 2: Chocolatey
```bash
choco install nodejs
```

### Option 3: Scoop
```bash
scoop install nodejs
```

### Option 4: winget
```bash
winget install OpenJS.NodeJS
```

## macOS

### Option 1: Official Installer (Recommended)
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the LTS version for macOS
3. Run the installer and follow the setup wizard

### Option 2: Homebrew
```bash
brew install node
```

### Option 3: MacPorts
```bash
sudo port install nodejs18 +universal
```

## Linux

### Ubuntu/Debian
```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using default repositories
sudo apt update
sudo apt install nodejs npm
```

### RHEL/CentOS/Fedora
```bash
# Using NodeSource repository (recommended)
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo dnf install nodejs

# Or using default repositories
sudo dnf install nodejs npm
```

### Arch Linux
```bash
sudo pacman -S nodejs npm
```

### openSUSE
```bash
sudo zypper install nodejs18 npm18
```

### Snap (Universal)
```bash
sudo snap install node --classic
```

### AppImage (Portable)
1. Download Node.js AppImage from [nodejs.org](https://nodejs.org/en/download/)
2. Make it executable: `chmod +x node-*.AppImage`
3. Run it: `./node-*.AppImage`

## Verification

After installation, verify Node.js is installed correctly:

```bash
node --version
npm --version
```

You should see version numbers printed for both commands.

## Troubleshooting

### Command not found
- **Windows**: Restart your command prompt or add Node.js to your PATH manually
- **macOS/Linux**: Restart your terminal or run `source ~/.bashrc` (or equivalent for your shell)

### Permission issues (macOS/Linux)
If you encounter permission issues when installing packages globally:
```bash
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Version conflicts
If you need to manage multiple Node.js versions, consider using:
- **nvm** (Node Version Manager): [github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm)
- **fnm** (Fast Node Manager): [github.com/Schniz/fnm](https://github.com/Schniz/fnm)

## Why Node.js is Required

Animepahe DL Desktop uses Node.js to:
- Execute and deobfuscate packed JavaScript code from anime streaming sites
- Extract m3u8 playlist URLs needed for video downloading
- Handle dynamic content that requires JavaScript execution

Without Node.js, the application cannot extract video sources and will fail during the "Extracting Playlist" step.