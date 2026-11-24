import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Bluetooth,
  FileArchive,
  ShieldCheck,
  Terminal,
  Cpu,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ximService } from '../services/ximService';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectNativeSpp?: () => void;
}

const DEFAULT_GITHUB_REPO = 'GerhardStrauss/Xim-Web-Manager';
const RELEASE_TAG = 'latest-apk';

interface GitHubReleaseInfo {
  publishedAt: string;
  zipUrl: string;
  apkUrl: string;
  zipSizeMb: string | null;
  apkSizeMb: string | null;
  htmlUrl: string;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  onConnectNativeSpp,
}) => {
  const [githubRepo, setGithubRepo] = useState<string>(() => {
    return localStorage.getItem('xim_github_repo') || DEFAULT_GITHUB_REPO;
  });
  const [editingRepo, setEditingRepo] = useState<boolean>(false);
  const [releaseInfo, setReleaseInfo] = useState<GitHubReleaseInfo | null>(null);
  const [checkingRelease, setCheckingRelease] = useState<boolean>(true);
  const [hasLocalZip, setHasLocalZip] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const isNativeAndroid = ximService.isNativeAndroidApp();

  const fetchLatestGitHubRelease = async (repoSlug: string) => {
    setCheckingRelease(true);
    setReleaseInfo(null);

    const cleanRepo = repoSlug.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    localStorage.setItem('xim_github_repo', cleanRepo);

    try {
      // 1. Check if a local /xim-web-manager-android-apk.zip also exists in /public
      fetch('/xim-web-manager-android-apk.zip', { method: 'HEAD' })
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          setHasLocalZip(res.ok && !contentType.includes('text/html'));
        })
        .catch(() => setHasLocalZip(false));

      // 2. Query GitHub Releases API for the permanent `latest-apk` tag
      const apiUrl = `https://api.github.com/repos/${cleanRepo}/releases/tags/${RELEASE_TAG}`;
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (res.ok) {
        const data = await res.json();
        const assets: any[] = Array.isArray(data.assets) ? data.assets : [];
        const zipAsset = assets.find((a) => a.name === 'xim-web-manager-android-apk.zip');
        const apkAsset = assets.find((a) => a.name === 'XIM4-Web-Manager-SPP.apk');

        const fallbackZipUrl = `https://github.com/${cleanRepo}/releases/download/${RELEASE_TAG}/xim-web-manager-android-apk.zip`;
        const fallbackApkUrl = `https://github.com/${cleanRepo}/releases/download/${RELEASE_TAG}/XIM4-Web-Manager-SPP.apk`;

        setReleaseInfo({
          publishedAt: data.published_at || new Date().toISOString(),
          zipUrl: zipAsset?.browser_download_url || fallbackZipUrl,
          apkUrl: apkAsset?.browser_download_url || fallbackApkUrl,
          zipSizeMb: zipAsset?.size ? (zipAsset.size / (1024 * 1024)).toFixed(2) : null,
          apkSizeMb: apkAsset?.size ? (apkAsset.size / (1024 * 1024)).toFixed(2) : null,
          htmlUrl: data.html_url || `https://github.com/${cleanRepo}/releases/tag/${RELEASE_TAG}`,
        });
      }
    } catch (err) {
      console.warn('GitHub release check warning:', err);
    } finally {
      setCheckingRelease(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchLatestGitHubRelease(githubRepo);
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanRepo = githubRepo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const directZipUrl =
    releaseInfo?.zipUrl ||
    `https://github.com/${cleanRepo}/releases/download/${RELEASE_TAG}/xim-web-manager-android-apk.zip`;
  const directApkUrl =
    releaseInfo?.apkUrl ||
    `https://github.com/${cleanRepo}/releases/download/${RELEASE_TAG}/XIM4-Web-Manager-SPP.apk`;

  const handleCopyBuildCommand = () => {
    navigator.clipboard.writeText(
      'npm run build && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug'
    );
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0c10] border border-cyan-500/40 rounded-lg max-w-2xl w-full max-h-[90dvh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.18)] overflow-hidden">
        {/* Header */}
        <div className="bg-[#12131a] px-4 sm:px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  Native Android APK (Bluetooth Classic SPP)
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                    isNativeAndroid
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : releaseInfo
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                  }`}
                >
                  {isNativeAndroid
                    ? 'Running Native APK'
                    : releaseInfo
                    ? 'Cloud Build Online'
                    : 'GitHub Release Sync'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                Unlocks native Android RFCOMM Socket (0x1101) &amp; interactive Bluetooth Device Picker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded bg-gray-900 border border-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Native Runtime Indicator if already running inside APK */}
          {isNativeAndroid && (
            <div className="bg-cyan-950/30 border border-cyan-500/50 rounded p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Native Android Bluetooth Classic SPP Bridge Detected!</span>
                </div>
                <p className="text-[11px] text-gray-300">
                  You are running inside the compiled Android APK. Tap connect to open the
                  interactive Bluetooth Device Picker and connect to your XIM4.
                </p>
              </div>
              {onConnectNativeSpp && (
                <button
                  onClick={() => {
                    onClose();
                    onConnectNativeSpp();
                  }}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded uppercase tracking-wider shrink-0 flex items-center gap-1.5"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Open Bluetooth Picker</span>
                </button>
              )}
            </div>
          )}

          {/* Direct Cloud Download Card (Synced from GitHub Releases) */}
          <div className="bg-[#12131a] border border-cyan-500/40 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-cyan-400 shrink-0" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Direct Download from GitHub Cloud Build
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLatestGitHubRelease(githubRepo)}
                  disabled={checkingRelease}
                  className="text-[10px] font-mono uppercase text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${checkingRelease ? 'animate-spin' : ''}`} />
                  <span>{checkingRelease ? 'Checking...' : 'Refresh Build Status'}</span>
                </button>
              </div>
            </div>

            {/* Connected Repository Bar */}
            <div className="bg-black/50 border border-gray-800 rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-[11px] font-mono text-gray-400 flex items-center gap-1.5 truncate">
                <span>GitHub Repo:</span>
                {editingRepo ? (
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    className="bg-gray-900 border border-cyan-500/50 rounded px-2 py-0.5 text-xs text-white font-mono outline-none"
                    placeholder="owner/repo"
                  />
                ) : (
                  <strong className="text-cyan-300 truncate">{cleanRepo}</strong>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editingRepo ? (
                  <button
                    onClick={() => {
                      setEditingRepo(false);
                      fetchLatestGitHubRelease(githubRepo);
                    }}
                    className="text-[10px] font-mono uppercase bg-cyan-500 text-black font-bold px-2.5 py-1 rounded"
                  >
                    Save &amp; Check
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingRepo(true)}
                    className="text-[10px] font-mono uppercase text-gray-400 hover:text-white underline"
                  >
                    Change Repo
                  </button>
                )}
              </div>
            </div>

            {/* Live Build Status */}
            {checkingRelease ? (
              <div className="bg-cyan-950/20 border border-cyan-500/30 rounded p-3.5 text-xs text-cyan-300 font-mono flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span>Checking GitHub Releases ({cleanRepo}) for latest compiled APK...</span>
              </div>
            ) : releaseInfo ? (
              <div className="bg-emerald-950/25 border border-emerald-500/40 rounded p-3.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Compiled APK &amp; ZIP Ready on GitHub Releases!</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    Built: {new Date(releaseInfo.publishedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-300">
                  Tap either button below on your Android phone to download directly without needing
                  to open GitHub Actions.
                </p>
              </div>
            ) : (
              <div className="bg-amber-950/25 border border-amber-500/40 rounded p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Waiting for First &quot;latest-apk&quot; Release Run on GitHub</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Push/sync this latest update to <strong className="text-white">{cleanRepo}</strong>.
                  As soon as the GitHub Action finishes (~2 mins), it automatically publishes the
                  compiled APK to the permanent release link below!
                </p>
              </div>
            )}

            {/* Primary 1-Click Direct Download Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <a
                href={hasLocalZip ? '/xim-web-manager-android-apk.zip' : directZipUrl}
                download="xim-web-manager-android-apk.zip"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  setDownloadStatus(
                    'Downloading xim-web-manager-android-apk.zip from GitHub Release...'
                  )
                }
                className="px-4 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex flex-col items-center justify-center gap-1 uppercase tracking-wider text-center no-underline"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Download APK (.ZIP)</span>
                </div>
                <span className="text-[9px] font-mono text-black/80 normal-case">
                  xim-web-manager-android-apk.zip{' '}
                  {releaseInfo?.zipSizeMb ? `(${releaseInfo.zipSizeMb} MB)` : ''}
                </span>
              </a>

              <a
                href={directApkUrl}
                download="XIM4-Web-Manager-SPP.apk"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  setDownloadStatus('Downloading XIM4-Web-Manager-SPP.apk directly...')
                }
                className="px-4 py-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs rounded-lg transition-all flex flex-col items-center justify-center gap-1 uppercase tracking-wider text-center no-underline"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Download Direct (.APK)</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-300/80 normal-case">
                  XIM4-Web-Manager-SPP.apk{' '}
                  {releaseInfo?.apkSizeMb ? `(${releaseInfo.apkSizeMb} MB)` : '(No Unzip Needed)'}
                </span>
              </a>
            </div>

            {downloadStatus && (
              <div className="bg-cyan-950/40 border border-cyan-500/40 rounded p-3 flex items-start space-x-2.5 text-xs text-cyan-200">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{downloadStatus}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-[11px] font-mono text-gray-400 flex-wrap gap-2">
              <span>Permanent Release Tag: `latest-apk`</span>
              <a
                href={`https://github.com/${cleanRepo}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
              >
                <span>View on GitHub Releases</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Why Native Android APK solves the issue */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-4 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>What&apos;s Included in the Latest Android APK Build</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  1. Interactive Device Picker
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Shows a popup list of all Paired &amp; Nearby Bluetooth Classic devices so you can
                  tap your XIM4.
                </p>
              </div>
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  2. No Firebase Login Needed
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Automatically opens in Standalone Hardware Mode and saves your game configs
                  on-device.
                </p>
              </div>
              <div className="bg-[#12131a] border border-gray-800 rounded p-2.5">
                <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  3. Android 12–14+ Permissions
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Automatically prompts for &quot;Nearby Devices&quot; permission on launch and opens
                  RFCOMM 0x1101.
                </p>
              </div>
            </div>
          </div>

          {/* Local CLI command */}
          <div className="bg-[#12131a] border border-gray-800 rounded p-3.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>LOCAL GRADLE BUILD COMMAND (OPTIONAL):</span>
              </span>
              <button
                onClick={handleCopyBuildCommand}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-black/70 border border-gray-800 rounded px-3 py-2 font-mono text-[11px] text-cyan-300 overflow-x-auto">
              npm run build &amp;&amp; npx cap add android &amp;&amp; npx cap sync android &amp;&amp;
              node scripts/patch-android-bluetooth.mjs &amp;&amp; cd android &amp;&amp; ./gradlew
              assembleDebug
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#12131a] px-4 sm:px-6 py-3.5 border-t border-gray-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 uppercase tracking-wider"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
