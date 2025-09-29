import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Download, ExternalLink, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import AppleIcon from '../assets/apple.svg?react';
import WindowsIcon from '../assets/windows.svg?react';
import LinuxIcon from '../assets/linux.svg?react';
import PackageIcon from '../assets/package.svg?react';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
  prerelease: boolean;
  draft: boolean;
}

interface UpdateDialogProps {
  currentVersion?: string;
  repoOwner: string;
  repoName: string;
  triggerButton?: React.ReactNode;
}

export default function UpdateDialog({
  currentVersion = "1.0.0",
  repoOwner,
  repoName,
  triggerButton
}: UpdateDialogProps) {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchLatestRelease = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': `${repoName}/1.0`,
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No releases found for this repository');
        }
        if (response.status === 403) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to fetch release: ${response.statusText}`);
      }

      const data = await response.json();
      setRelease(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch latest release');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLatestRelease();
    }
  }, [open, repoOwner, repoName]);

  const isUpdateAvailable = () => {
    if (!release) return false;

    const parseVersion = (version: string): number[] => {
      return version.replace(/^v/, '')
        .split('.')
        .map(part => {
          const num = parseInt(part.split(/[-+]/)[0]);
          return isNaN(num) ? 0 : num;
        });
    };

    const current = parseVersion(currentVersion);
    const latest = parseVersion(release.tag_name);

    const maxLength = Math.max(current.length, latest.length);
    for (let i = 0; i < maxLength; i++) {
      const cur = current[i] || 0;
      const lat = latest[i] || 0;
      if (lat > cur) return true;
      if (lat < cur) return false;
    }
    return false;
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAssetIcon = (filename: string): React.ReactElement => {
    const lower = filename.toLowerCase();
    const iconProps = { className: "w-5 h-5" };

    if (lower.includes('dmg') || lower.includes('pkg')) return <AppleIcon {...iconProps} />;
    if (lower.includes('exe') || lower.includes('msi')) return <WindowsIcon {...iconProps} />;
    if (lower.includes('appimage') || lower.includes('deb') || lower.includes('tar') || lower.includes('rpm')) return <LinuxIcon {...iconProps} />;
    return <PackageIcon {...iconProps} />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Updates
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Software Updates
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Checking for updates...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-medium">Error</div>
                <div className="text-sm">{error}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLatestRelease}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          )}

          {release && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-background/60">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Current Version</div>
                  <div className="font-semibold text-foreground">{currentVersion}</div>
                  <div className="text-sm text-muted-foreground">Latest Version</div>
                  <div className="font-semibold text-foreground">{release.tag_name}</div>
                </div>
                {isUpdateAvailable() ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Update Available
                  </Badge>
                ) : (
                  <Badge className="flex items-center gap-1 bg-green-500 hover:bg-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Up to Date
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">{release.name}</h3>
                <p className="text-sm text-muted-foreground">Released on {formatDate(release.published_at)}</p>

                {release.body && (
                  <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                    <h4 className="font-medium mb-2 text-foreground">What's New:</h4>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {release.body}
                    </div>
                  </div>
                )}

                {release.assets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Downloads:</h4>
                    <div className="grid gap-2">
                      {release.assets.map((asset, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-border/60 bg-background/60 rounded-lg hover:bg-background/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-6 h-6">
                              {getAssetIcon(asset.name)}
                            </div>
                            <div>
                              <div className="font-medium text-sm text-foreground">{asset.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(asset.size)}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(asset.browser_download_url, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-border/60">
                  <Button
                    variant="default"
                    onClick={() => window.open(release.html_url, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on GitHub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={fetchLatestRelease}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}