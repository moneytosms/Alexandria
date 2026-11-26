export type DetectedPlatform = 'linux' | 'windows' | 'macos' | 'android' | 'unknown'

export interface ReleaseAssetInfo {
  name: string
  downloadUrl: string
  sizeBytes: number
  sizeLabel: string
  platform: 'linux' | 'windows' | 'macos' | 'android' | 'checksum'
  formatLabel: string
  formatDetail: string
  recommended?: boolean
}

export interface ReleasePayload {
  repoSlug: string
  repoUrl: string
  releasesUrl: string
  tagName: string
  versionLabel: string
  publishedAt: string | null
  live: boolean
  assets: ReleaseAssetInfo[]
  checksumAsset: ReleaseAssetInfo | null
}

const CACHE_TTL_MS = 10 * 60 * 1000

export function detectClientPlatform(): {
  os: DetectedPlatform
  arch: 'arm64' | 'x64'
  label: string
  shortCta: string
} {
  if (typeof navigator === 'undefined') {
    return { os: 'unknown', arch: 'x64', label: 'Desktop', shortCta: 'Download' }
  }

  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string; architecture?: string }
  }
  const ua = navigator.userAgent.toLowerCase()
  const platform = (nav.userAgentData?.platform || navigator.platform || '').toLowerCase()
  const archHint = (nav.userAgentData?.architecture || '').toLowerCase()
  const isArm =
    archHint.includes('arm') || ua.includes('arm64') || ua.includes('aarch64') || ua.includes('apple')

  if (ua.includes('android') || platform.includes('android')) {
    return {
      os: 'android',
      arch: 'arm64',
      label: 'Android (APK)',
      shortCta: 'Download for Android'
    }
  }
  if (platform.includes('mac') || ua.includes('mac os') || ua.includes('macintosh')) {
    return {
      os: 'macos',
      arch: isArm ? 'arm64' : 'x64',
      label: 'macOS (Apple Silicon)',
      shortCta: 'Download for macOS'
    }
  }
  if (platform.includes('win') || ua.includes('windows')) {
    return {
      os: 'windows',
      arch: 'x64',
      label: 'Windows (64-bit)',
      shortCta: 'Download for Windows'
    }
  }
  if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) {
    return {
      os: 'linux',
      arch: 'x64',
      label: 'Linux (x64)',
      shortCta: 'Download for Linux'
    }
  }

  return { os: 'unknown', arch: 'x64', label: 'Desktop & Android', shortCta: 'Download Alexandria' }
}

/**
 * Resolves `<owner>/<repo>` dynamically without hardcoding any username:
 * 1. Build-time `VITE_GITHUB_REPO` injected by GitHub Actions (`${{ github.repository }}`)
 * 2. Runtime inference from `<owner>.github.io/<repo>`
 * 3. Fallback placeholder that still links cleanly when previewed locally
 */
export function resolveRepositorySlug(): string {
  const envRepo = (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim()
  if (envRepo && envRepo.includes('/')) {
    return envRepo
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host.endsWith('.github.io')) {
      const owner = host.slice(0, -'.github.io'.length)
      const segments = window.location.pathname.split('/').filter(Boolean)
      const repo = segments[0] || 'Alexandria'
      if (owner) return `${owner}/${repo}`
    }
  }

  return 'Srimoneyshankar/Alexandria'
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  return `${Math.round(kb)} KB`
}

function classifyAsset(name: string, downloadUrl: string, sizeBytes: number): ReleaseAssetInfo | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.appimage')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'linux',
      formatLabel: 'AppImage',
      formatDetail: 'Portable universal Linux binary (x64)',
      recommended: true
    }
  }
  if (lower.endsWith('.deb')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'linux',
      formatLabel: 'Debian / Ubuntu (.deb)',
      formatDetail: 'System package for APT distributions (x64)'
    }
  }
  if (lower.endsWith('-setup.exe') || (lower.endsWith('.exe') && !lower.includes('portable'))) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'windows',
      formatLabel: 'Windows Installer (.exe)',
      formatDetail: 'NSIS guided desktop installer (x64)',
      recommended: true
    }
  }
  if (lower.endsWith('-portable.exe')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'windows',
      formatLabel: 'Windows Portable (.exe)',
      formatDetail: 'Zero-install single executable (x64)'
    }
  }
  if (lower.endsWith('.dmg')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'macos',
      formatLabel: 'macOS Disk Image (.dmg)',
      formatDetail: 'Apple Silicon (arm64) drag-to-Applications',
      recommended: true
    }
  }
  if (lower.endsWith('.zip') && (lower.includes('mac') || lower.includes('arm64') || lower.includes('darwin'))) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'macos',
      formatLabel: 'macOS Archive (.zip)',
      formatDetail: 'Apple Silicon (arm64) compressed bundle'
    }
  }
  if (lower.endsWith('.apk')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'android',
      formatLabel: 'Android Package (.apk)',
      formatDetail: 'Universal signed Android installer (Android 8.0+)',
      recommended: true
    }
  }
  if (lower === 'sha256sums.txt' || lower.includes('sha256')) {
    return {
      name,
      downloadUrl,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      platform: 'checksum',
      formatLabel: 'SHA256SUMS.txt',
      formatDetail: 'Cryptographic integrity manifest'
    }
  }
  return null
}

export function buildFallbackRelease(repoSlug: string): ReleasePayload {
  const repoUrl = `https://github.com/${repoSlug}`
  const releasesUrl = `${repoUrl}/releases/latest`
  return {
    repoSlug,
    repoUrl,
    releasesUrl,
    tagName: 'v1.0.0',
    versionLabel: 'v1.0.0',
    publishedAt: null,
    live: false,
    checksumAsset: {
      name: 'SHA256SUMS.txt',
      downloadUrl: releasesUrl,
      sizeBytes: 0,
      sizeLabel: 'On Release',
      platform: 'checksum',
      formatLabel: 'SHA256SUMS.txt',
      formatDetail: 'Published with every automated build'
    },
    assets: [
      {
        name: 'Alexandria-1.0.0-linux-x64.AppImage',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'linux',
        formatLabel: 'AppImage',
        formatDetail: 'Portable universal Linux binary (x64)',
        recommended: true
      },
      {
        name: 'Alexandria-1.0.0-linux-x64.deb',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'linux',
        formatLabel: 'Debian / Ubuntu (.deb)',
        formatDetail: 'System package for APT distributions (x64)'
      },
      {
        name: 'Alexandria-1.0.0-win-x64-setup.exe',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'windows',
        formatLabel: 'Windows Installer (.exe)',
        formatDetail: 'NSIS guided desktop installer (x64)',
        recommended: true
      },
      {
        name: 'Alexandria-1.0.0-win-x64-portable.exe',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'windows',
        formatLabel: 'Windows Portable (.exe)',
        formatDetail: 'Zero-install single executable (x64)'
      },
      {
        name: 'Alexandria-1.0.0-mac-arm64.dmg',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'macos',
        formatLabel: 'macOS Disk Image (.dmg)',
        formatDetail: 'Apple Silicon (arm64) drag-to-Applications',
        recommended: true
      },
      {
        name: 'Alexandria-1.0.0-mac-arm64.zip',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'macos',
        formatLabel: 'macOS Archive (.zip)',
        formatDetail: 'Apple Silicon (arm64) compressed bundle'
      },
      {
        name: 'Alexandria-1.0.0-android-universal.apk',
        downloadUrl: releasesUrl,
        sizeBytes: 0,
        sizeLabel: 'GitHub Release',
        platform: 'android',
        formatLabel: 'Android Package (.apk)',
        formatDetail: 'Universal signed Android installer (Android 8.0+)',
        recommended: true
      }
    ]
  }
}

export async function fetchLatestRelease(repoSlug: string): Promise<ReleasePayload> {
  const fallback = buildFallbackRelease(repoSlug)
  const cacheKey = `alexandria-gh-release:${repoSlug}`

  try {
    const cachedRaw = window.sessionStorage.getItem(cacheKey)
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as { ts: number; data: ReleasePayload }
      if (Date.now() - parsed.ts < CACHE_TTL_MS && parsed.data) {
        return parsed.data
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repoSlug}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return fallback

    const json = (await response.json()) as {
      tag_name?: string
      name?: string
      html_url?: string
      published_at?: string
      assets?: Array<{ name: string; browser_download_url: string; size: number }>
    }

    const classified: ReleaseAssetInfo[] = []
    let checksumAsset: ReleaseAssetInfo | null = null

    for (const raw of json.assets ?? []) {
      const info = classifyAsset(raw.name, raw.browser_download_url, raw.size)
      if (!info) continue
      if (info.platform === 'checksum') {
        checksumAsset = info
      } else {
        classified.push(info)
      }
    }

    if (classified.length === 0) return fallback

    const tagName = json.tag_name || 'latest'
    const versionMatch = (json.name || tagName).match(/v?\d+\.\d+\.\d+/)
    const payload: ReleasePayload = {
      repoSlug,
      repoUrl: `https://github.com/${repoSlug}`,
      releasesUrl: json.html_url || fallback.releasesUrl,
      tagName,
      versionLabel: versionMatch ? `v${versionMatch[0].replace(/^v/, '')}` : tagName,
      publishedAt: json.published_at ?? null,
      live: true,
      assets: classified,
      checksumAsset
    }

    try {
      window.sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: payload }))
    } catch {
      // Ignore quota
    }
    return payload
  } catch {
    return fallback
  }
}

export function pickPrimaryAsset(
  release: ReleasePayload,
  os: DetectedPlatform
): ReleaseAssetInfo | null {
  if (os === 'unknown') return null
  const matching = release.assets.filter((a) => a.platform === os)
  return matching.find((a) => a.recommended) ?? matching[0] ?? null
}
