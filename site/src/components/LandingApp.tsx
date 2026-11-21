import { useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  ShieldCheck
} from 'lucide-react'
import { ArmillaryFolioStage } from '../scene/ArmillaryFolioStage'
import {
  buildFallbackRelease,
  detectClientPlatform,
  fetchLatestRelease,
  pickPrimaryAsset,
  resolveRepositorySlug,
  type ReleasePayload
} from '../lib/releases'

type PlatformTab = 'linux' | 'windows' | 'macos'

interface ChapterDef {
  id: string
  roman: string
  label: string
}

const CHAPTERS: ChapterDef[] = [
  { id: 'proposition', roman: 'I', label: 'Alexandria' },
  { id: 'grand-hall', roman: 'II', label: 'Grand Hall' },
  { id: 'reader', roman: 'III', label: 'Reader' },
  { id: 'architecture', roman: 'IV', label: 'Architecture' },
  { id: 'downloads', roman: 'V', label: 'Downloads' }
]

const PLATFORM_TABS: Array<{ id: PlatformTab; label: string; arch: string }> = [
  { id: 'linux', label: 'Linux', arch: 'x64 · AppImage & .deb' },
  { id: 'windows', label: 'Windows', arch: 'x64 · Installer & Portable' },
  { id: 'macos', label: 'macOS', arch: 'Apple Silicon · .dmg & .zip' }
]

export function LandingApp() {
  const scrollProgressRef = useRef<number>(0)
  const lenisRef = useRef<Lenis | null>(null)
  const [activeChapter, setActiveChapter] = useState<number>(0)
  const [scrolledPastHero, setScrolledPastHero] = useState<boolean>(false)
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  const clientPlatform = useMemo(() => detectClientPlatform(), [])
  const repoSlug = useMemo(() => resolveRepositorySlug(), [])
  const [release, setRelease] = useState<ReleasePayload>(() => buildFallbackRelease(repoSlug))
  const [selectedTab, setSelectedTab] = useState<PlatformTab>(() =>
    clientPlatform.os === 'unknown' ? 'linux' : clientPlatform.os
  )
  const [copiedSha, setCopiedSha] = useState<boolean>(false)

  // Observe prefers-reduced-motion dynamically
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Fetch live GitHub Release assets
  useEffect(() => {
    let active = true
    void fetchLatestRelease(repoSlug).then((data) => {
      if (active) setRelease(data)
    })
    return () => {
      active = false
    }
  }, [repoSlug])

  // Smooth inertial scrolling via Lenis + normalized scroll choreography progress
  useEffect(() => {
    const syncScroll = (): void => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const y = window.scrollY
      const progress = Math.max(0, Math.min(1, y / maxScroll))
      scrollProgressRef.current = progress
      setScrolledPastHero(y > 48)

      const chapterIdx = Math.min(
        CHAPTERS.length - 1,
        Math.max(0, Math.floor(progress * CHAPTERS.length + 0.18))
      )
      setActiveChapter(chapterIdx)
    }

    syncScroll()
    window.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll, { passive: true })

    if (reducedMotion) {
      return () => {
        window.removeEventListener('scroll', syncScroll)
        window.removeEventListener('resize', syncScroll)
      }
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    })
    lenisRef.current = lenis

    let rafId = 0
    const onRaf = (time: number): void => {
      lenis.raf(time)
      syncScroll()
      rafId = window.requestAnimationFrame(onRaf)
    }
    rafId = window.requestAnimationFrame(onRaf)

    return () => {
      window.cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
      window.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
    }
  }, [reducedMotion])

  const scrollToSection = (id: string): void => {
    const el = document.getElementById(id)
    if (!el) return
    if (lenisRef.current && !reducedMotion) {
      lenisRef.current.scrollTo(el, { offset: -24 })
    } else {
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }

  const primaryAsset = pickPrimaryAsset(release, clientPlatform.os)
  const visibleAssets = release.assets.filter((a) => a.platform === selectedTab)
  const demoHref = './demo/'

  const verifyCommand =
    selectedTab === 'windows'
      ? 'certutil -hashfile Alexandria-*.exe SHA256'
      : selectedTab === 'macos'
        ? 'shasum -a 256 -c SHA256SUMS.txt'
        : 'sha256sum -c SHA256SUMS.txt && chmod +x Alexandria-*.AppImage'

  const copyVerifyCommand = (): void => {
    if (!navigator.clipboard) return
    void navigator.clipboard.writeText(verifyCommand).then(() => {
      setCopiedSha(true)
      window.setTimeout(() => setCopiedSha(false), 2000)
    })
  }

  const primaryDownloadHref = primaryAsset ? primaryAsset.downloadUrl : '#downloads'

  return (
    <div className="relative min-h-screen bg-[#090807] text-[#F2ECE1]">
      {/* Persistent Single Centerpiece: Scroll-Choreographed 3D Brass Armillary & Hinged Folio */}
      <ArmillaryFolioStage
        scrollProgressRef={scrollProgressRef}
        reducedMotion={reducedMotion}
      />

      {/* Strict 3-Zone Top Bar — no backdrop-filter over WebGL, no pills, single-line links */}
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${
          scrolledPastHero
            ? 'border-b border-[#C8A25B]/16 bg-[#090807]/92'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-8 px-6 md:px-10">
          {/* Zone 1: Clean single-element brand wordmark */}
          <a
            href="#proposition"
            onClick={(e) => {
              e.preventDefault()
              scrollToSection('proposition')
            }}
            className="focus-brass font-display text-[23px] font-semibold tracking-[0.06em] text-[#F2ECE1] transition-colors hover:text-[#E3C27F]"
          >
            Alexandria
          </a>

          {/* Zone 2: Concise single-line navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-8 text-[13px] font-medium tracking-[0.02em] text-[#A89E8E] md:flex"
          >
            <button
              type="button"
              onClick={() => scrollToSection('grand-hall')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#F2ECE1]"
            >
              Grand Hall
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reader')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#F2ECE1]"
            >
              Reader
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('architecture')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#F2ECE1]"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('downloads')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#F2ECE1]"
            >
              Downloads
            </button>
            <a
              href={release.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-brass inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-[#F2ECE1]"
            >
              GitHub
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </a>
          </nav>

          {/* Zone 3: Single primary OS-aware CTA */}
          <button
            type="button"
            onClick={() => scrollToSection('downloads')}
            className="focus-brass inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border border-[#C8A25B]/60 bg-[#C8A25B] px-4 py-2 text-[13px] font-semibold tracking-[0.01em] text-[#090807] transition-colors hover:border-[#E3C27F] hover:bg-[#E3C27F]"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </header>

      {/* Right-Edge Minimal Roman Numeral Scroll Choreography Rail */}
      <aside
        aria-label="Reading chapters"
        className="fixed right-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-4 xl:flex"
      >
        {CHAPTERS.map((chapter, index) => {
          const isActive = activeChapter === index
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => scrollToSection(chapter.id)}
              aria-current={isActive ? 'step' : undefined}
              className="focus-brass group flex cursor-pointer items-center gap-3 py-0.5 text-right"
            >
              <span
                className={`text-[11px] font-medium tracking-[0.14em] uppercase transition-opacity duration-300 ${
                  isActive
                    ? 'text-[#E3C27F] opacity-100'
                    : 'text-[#8E8474] opacity-0 group-hover:opacity-100'
                }`}
              >
                {chapter.label}
              </span>
              <span
                className={`font-display text-[13px] tracking-[0.1em] transition-colors ${
                  isActive ? 'text-[#E3C27F]' : 'text-[#6A6256] group-hover:text-[#C8A25B]'
                }`}
              >
                {chapter.roman}
              </span>
              <span
                className={`block h-[1px] transition-all duration-300 ${
                  isActive ? 'w-7 bg-[#E3C27F]' : 'w-3 bg-[#C8A25B]/30 group-hover:w-5'
                }`}
              />
            </button>
          )
        })}
      </aside>

      {/* Editorial Narrative Flow over the Persistent 3D Stage */}
      <main className="relative z-10">
        {/* ================================================================= */}
        {/* CHAPTER I — PROPOSITION (HERO)                                    */}
        {/* ================================================================= */}
        <section
          id="proposition"
          className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 pb-16 pt-28 md:px-10"
        >
          <div className="max-w-xl">
            <p className="font-code text-[11px] tracking-[0.22em] text-[#C8A25B] uppercase">
              Chapter I · Local-First 3D Library
            </p>

            <h1 className="font-display mt-5 text-[clamp(3rem,6.4vw,5.4rem)] leading-[0.98] font-medium tracking-[-0.015em] text-[#F5EFE4]">
              Your PDFs deserve a room of their own.
            </h1>

            <p className="mt-6 max-w-lg text-[16px] leading-[1.7] text-[#C5BCAE]">
              Alexandria turns your local PDF archive into a walkable dark-academia Grand Hall
              paired with a flicker-free, exact-click reader—stored in one plain folder on your
              machine with SQLite FTS5 search and zero telemetry.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              {primaryAsset && release.live ? (
                <a
                  href={primaryDownloadHref}
                  className="focus-brass inline-flex items-center gap-2.5 border border-[#C8A25B] bg-[#C8A25B] px-6 py-3.5 text-[14px] font-semibold tracking-[0.01em] text-[#090807] transition-colors hover:border-[#E3C27F] hover:bg-[#E3C27F]"
                >
                  <Download className="h-4 w-4" />
                  {clientPlatform.shortCta}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollToSection('downloads')}
                  className="focus-brass inline-flex cursor-pointer items-center gap-2.5 border border-[#C8A25B] bg-[#C8A25B] px-6 py-3.5 text-[14px] font-semibold tracking-[0.01em] text-[#090807] transition-colors hover:border-[#E3C27F] hover:bg-[#E3C27F]"
                >
                  <Download className="h-4 w-4" />
                  {clientPlatform.shortCta}
                </button>
              )}

              <a
                href={demoHref}
                className="focus-brass inline-flex items-center gap-2 border border-[#C8A25B]/35 bg-[#14110E]/85 px-6 py-3.5 text-[14px] font-medium text-[#F2ECE1] transition-colors hover:border-[#C8A25B] hover:text-[#E3C27F]"
              >
                Try Web Demo
                <ArrowUpRight className="h-4 w-4 text-[#C8A25B]" />
              </a>
            </div>

            {/* Clean unboxed metadata strip — strictly zero pills */}
            <p className="font-code mt-7 text-[12px] tracking-[0.03em] text-[#968C7D]">
              {release.versionLabel} · Linux, Windows &amp; macOS · MIT Open Source · Offline First
            </p>
          </div>

          <button
            type="button"
            onClick={() => scrollToSection('grand-hall')}
            className="focus-brass mt-16 inline-flex w-fit cursor-pointer items-center gap-2.5 text-[12px] tracking-[0.16em] text-[#9D9384] uppercase transition-colors hover:text-[#E3C27F] md:mt-24"
          >
            <ArrowDown className="h-3.5 w-3.5 text-[#C8A25B]" />
            Scroll to explore the hall
          </button>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER II — THE 3D GRAND HALL                                    */}
        {/* ================================================================= */}
        <section
          id="grand-hall"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-end px-6 py-28 md:px-10"
        >
          <div className="w-full max-w-lg border-t border-[#C8A25B]/25 pt-8">
            <p className="font-code text-[11px] tracking-[0.22em] text-[#C8A25B] uppercase">
              Chapter II · Spatial Memory
            </p>

            <h2 className="font-display mt-4 text-[clamp(2.35rem,4.6vw,3.65rem)] leading-[1.04] font-medium text-[#F5EFE4]">
              Walk your shelves from floor to mezzanine.
            </h2>

            <p className="mt-5 text-[15.5px] leading-[1.75] text-[#C2B8AA]">
              Every volume you import becomes a real leather-bound spine arranged along oak bays,
              rolling ladders, and a walkable upper balcony beneath a rotating celestial armillary.
              Drag books directly between shelves, build new wings, and remember ideas by where
              they stand.
            </p>

            <div className="brass-rule my-7 h-[1px] w-full" />

            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="font-display text-[21px] font-medium text-[#F2ECE1]">
                  Switchable Atmospheres
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[#A29889]">
                  Shift instantly between Dark Academia, Sunlit Marble, and Observatory lighting
                  with dynamic weather moods.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[21px] font-medium text-[#F2ECE1]">
                  Procedural Soundscape
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[#A29889]">
                  Layer soft rain on glass, crackling hearth fire, and subtle chimes—or spin local
                  albums from the persistent music dock.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[21px] font-medium text-[#F2ECE1]">
                  Walkable Mezzanine
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[#A29889]">
                  Fluid WASD movement, crisp staircase ascent, live corner mini-map, and one-click
                  quick-inspect cards with reading progress.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[21px] font-medium text-[#F2ECE1]">
                  Direct Shelving
                </dt>
                <dd className="mt-1.5 text-[13.5px] leading-[1.65] text-[#A29889]">
                  Drag spines across bays in 3D, pin active reads to your Reading Desk, and view
                  progress markers right on the spines.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER III — PRECISION PDF READER (FOLIO OPENS IN 3D)            */}
        {/* ================================================================= */}
        <section
          id="reader"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-start px-6 py-28 md:px-10"
        >
          <div className="w-full max-w-lg border-t border-[#C8A25B]/25 pt-8">
            <p className="font-code text-[11px] tracking-[0.22em] text-[#C8A25B] uppercase">
              Chapter III · Precision Reading
            </p>

            <h2 className="font-display mt-4 text-[clamp(2.35rem,4.6vw,3.65rem)] leading-[1.04] font-medium text-[#F5EFE4]">
              Every highlight lands exactly where you mark.
            </h2>

            <p className="mt-5 text-[15.5px] leading-[1.75] text-[#C2B8AA]">
              Open any volume into a calm, Retina-sharp reader engineered with double-buffered
              offscreen rendering so pages never flash or jump. Highlight passages in five archival
              tones, sketch freehand ink, attach margin notes, and erase cleanly—without ever
              mutating the original PDF file.
            </p>

            <div className="brass-rule my-7 h-[1px] w-full" />

            <ul className="space-y-4 text-[14px] leading-[1.65] text-[#BEB4A6]">
              <li className="flex items-baseline justify-between gap-4 border-b border-[#C8A25B]/12 pb-3">
                <span className="font-medium text-[#F2ECE1]">Exact-Click Annotator</span>
                <span className="font-code text-[12px] text-[#C8A25B]">
                  Highlight · Ink · Erase · Notes
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-4 border-b border-[#C8A25B]/12 pb-3">
                <span className="font-medium text-[#F2ECE1]">Distraction-Free Study Mode</span>
                <span className="font-code text-[12px] text-[#C8A25B]">
                  Session Timer · Paper / Sepia / Charcoal
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-4 border-b border-[#C8A25B]/12 pb-3">
                <span className="font-medium text-[#F2ECE1]">Per-Book Memory</span>
                <span className="font-code text-[12px] text-[#C8A25B]">
                  Zoom · Spread · Rotation · Exact Page
                </span>
              </li>
              <li className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-[#F2ECE1]">Keyboard-Native Navigation</span>
                <span className="font-code text-[12px] text-[#C8A25B]">
                  H · I · B · F · Esc
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER IV — LOCAL-FIRST ARCHITECTURE                             */}
        {/* ================================================================= */}
        <section
          id="architecture"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-end px-6 py-28 md:px-10"
        >
          <div className="w-full max-w-lg border-t border-[#C8A25B]/25 pt-8">
            <p className="font-code text-[11px] tracking-[0.22em] text-[#C8A25B] uppercase">
              Chapter IV · Sovereignty by Design
            </p>

            <h2 className="font-display mt-4 text-[clamp(2.35rem,4.6vw,3.65rem)] leading-[1.04] font-medium text-[#F5EFE4]">
              One plain folder. Zero cloud lock-in.
            </h2>

            <p className="mt-5 text-[15.5px] leading-[1.75] text-[#C2B8AA]">
              Your entire library lives in an ordinary directory you own—containing{' '}
              <span className="font-code text-[13px] text-[#E3C27F]">library.db</span>,{' '}
              <span className="font-code text-[13px] text-[#E3C27F]">books/</span>, and{' '}
              <span className="font-code text-[13px] text-[#E3C27F]">covers/</span>. Sync it with
              Syncthing, back it up with rsync, or copy it to a thumb drive. Alexandria makes zero
              background network calls.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[#C8A25B]/16 py-6">
              <div>
                <p className="font-display text-[32px] leading-none font-medium text-[#E3C27F]">
                  FTS5
                </p>
                <p className="mt-1.5 text-[13px] text-[#A29889]">
                  Millisecond search across titles, page text, and margin notes via{' '}
                  <span className="font-code text-[#D8CFC0]">Ctrl/Cmd+K</span>.
                </p>
              </div>
              <div>
                <p className="font-display text-[32px] leading-none font-medium text-[#E3C27F]">
                  SHA-256
                </p>
                <p className="mt-1.5 text-[13px] text-[#A29889]">
                  Automatic content hashing prevents duplicate shelves and relinks moved PDFs.
                </p>
              </div>
              <div>
                <p className="font-display text-[32px] leading-none font-medium text-[#E3C27F]">
                  7 Formats
                </p>
                <p className="mt-1.5 text-[13px] text-[#A29889]">
                  Native PDF plus optional LibreOffice conversion for DOCX, PPTX, ODT, and ODP.
                </p>
              </div>
              <div>
                <p className="font-display text-[32px] leading-none font-medium text-[#E3C27F]">
                  0 Bytes
                </p>
                <p className="mt-1.5 text-[13px] text-[#A29889]">
                  Telemetry sent. No accounts, no tracking pixels, no subscription wall.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-6 text-[13px] font-medium">
              <a
                href={`${release.repoUrl}/blob/main/docs/ARCHITECTURE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass inline-flex items-center gap-1.5 text-[#E3C27F] transition-colors hover:text-[#F5EFE4]"
              >
                Read Architecture Guide
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href={`${release.repoUrl}/blob/main/docs/CONTROLS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass inline-flex items-center gap-1.5 text-[#B5AB9C] transition-colors hover:text-[#F2ECE1]"
              >
                Controls Reference
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER V — CROSS-PLATFORM DOWNLOADS & LIVE RELEASE MATRIX        */}
        {/* ================================================================= */}
        <section
          id="downloads"
          className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-28 md:px-10"
        >
          <div className="border border-[#C8A25B]/22 bg-[#100D0B]/92 p-7 md:p-12">
            <div className="flex flex-col justify-between gap-6 border-b border-[#C8A25B]/16 pb-8 md:flex-row md:items-end">
              <div>
                <p className="font-code text-[11px] tracking-[0.22em] text-[#C8A25B] uppercase">
                  Chapter V · Acquire Alexandria
                </p>
                <h2 className="font-display mt-3 text-[clamp(2.2rem,4.2vw,3.4rem)] leading-[1.04] font-medium text-[#F5EFE4]">
                  Install native desktop or explore in browser.
                </h2>
                <p className="font-code mt-3 text-[12px] text-[#9A9082]">
                  Release {release.versionLabel} ·{' '}
                  {release.publishedAt
                    ? `Published ${new Date(release.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}`
                    : 'Automated GitHub Release Builds'}{' '}
                  · Detected: {clientPlatform.label}
                </p>
              </div>

              <a
                href={demoHref}
                className="focus-brass inline-flex shrink-0 items-center justify-center gap-2 border border-[#C8A25B]/45 bg-[#1B1612] px-5 py-3 text-[13.5px] font-medium text-[#F2ECE1] transition-colors hover:border-[#E3C27F] hover:text-[#E3C27F]"
              >
                Launch Interactive Web Demo
                <ArrowUpRight className="h-4 w-4 text-[#C8A25B]" />
              </a>
            </div>

            {/* Platform selector bar */}
            <div
              role="tablist"
              aria-label="Desktop operating system"
              className="mt-7 flex flex-wrap gap-6 border-b border-[#C8A25B]/14"
            >
              {PLATFORM_TABS.map((tab) => {
                const active = selectedTab === tab.id
                const isDetected = clientPlatform.os === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`focus-brass -mb-[1px] cursor-pointer border-b-2 pb-3.5 text-left transition-colors ${
                      active
                        ? 'border-[#C8A25B] text-[#F5EFE4]'
                        : 'border-transparent text-[#8F8577] hover:text-[#D8CFC0]'
                    }`}
                  >
                    <span className="text-[14px] font-semibold">
                      {tab.label}
                      {isDetected ? ' · Detected' : ''}
                    </span>
                    <span className="font-code mt-0.5 block text-[11px] text-[#8E8474]">
                      {tab.arch}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Release asset rows */}
            <div className="mt-6 divide-y divide-[#C8A25B]/12">
              {visibleAssets.map((asset) => (
                <div
                  key={asset.name}
                  className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display text-[22px] font-medium text-[#F5EFE4]">
                        {asset.formatLabel}
                      </span>
                      {asset.recommended ? (
                        <span className="font-code text-[11px] tracking-[0.1em] text-[#C8A25B] uppercase">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13.5px] text-[#A29889]">{asset.formatDetail}</p>
                    <p className="font-code mt-1 text-[11.5px] text-[#7D7467]">
                      {asset.name} · {asset.sizeLabel}
                    </p>
                  </div>

                  <a
                    href={asset.downloadUrl}
                    target={release.live ? undefined : '_blank'}
                    rel={release.live ? undefined : 'noopener noreferrer'}
                    className={`focus-brass inline-flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                      asset.recommended
                        ? 'border border-[#C8A25B] bg-[#C8A25B] text-[#090807] hover:border-[#E3C27F] hover:bg-[#E3C27F]'
                        : 'border border-[#C8A25B]/35 bg-transparent text-[#E3C27F] hover:border-[#E3C27F] hover:bg-[#C8A25B]/10'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {release.live ? 'Download' : 'View Release'}
                  </a>
                </div>
              ))}
            </div>

            {/* Cryptographic SHA-256 verification bar */}
            <div className="mt-7 flex flex-col justify-between gap-4 border-t border-[#C8A25B]/16 pt-6 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A25B]" />
                <div>
                  <p className="text-[13px] font-medium text-[#E5DDD0]">
                    Verify installer integrity with{' '}
                    <a
                      href={release.checksumAsset?.downloadUrl ?? release.releasesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-[#C8A25B]/50 underline-offset-4 hover:text-[#E3C27F]"
                    >
                      SHA256SUMS.txt
                    </a>
                  </p>
                  <code className="font-code mt-1 block text-[12px] text-[#9E9484]">
                    {verifyCommand}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={copyVerifyCommand}
                  className="focus-brass inline-flex cursor-pointer items-center gap-1.5 border border-[#C8A25B]/30 px-3.5 py-2 font-code text-[11.5px] text-[#D8CFC0] transition-colors hover:border-[#C8A25B] hover:text-[#E3C27F]"
                >
                  {copiedSha ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#C8A25B]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy command
                    </>
                  )}
                </button>
                <a
                  href={release.releasesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-brass inline-flex items-center gap-1.5 border border-[#C8A25B]/20 px-3.5 py-2 text-[12px] text-[#A29889] transition-colors hover:border-[#C8A25B]/50 hover:text-[#F2ECE1]"
                >
                  All Releases
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Editorial Footer */}
          <footer className="mt-14 flex flex-col justify-between gap-6 border-t border-[#C8A25B]/16 pt-8 text-[12.5px] text-[#8E8474] md:flex-row md:items-center">
            <div>
              <span className="font-display text-[17px] font-medium tracking-[0.04em] text-[#E5DDD0]">
                Alexandria
              </span>
              <span className="mx-2.5 text-[#C8A25B]/40">·</span>
              <span>Local-first 3D PDF library · MIT License</span>
            </div>

            <nav aria-label="Documentation links" className="flex flex-wrap items-center gap-6">
              <a
                href={`${release.repoUrl}/blob/main/docs/USER_GUIDE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#E3C27F]"
              >
                User Guide
              </a>
              <a
                href={`${release.repoUrl}/blob/main/docs/CONTROLS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#E3C27F]"
              >
                Controls
              </a>
              <a
                href={`${release.repoUrl}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#E3C27F]"
              >
                Contributing
              </a>
              <a
                href={`${release.repoUrl}/blob/main/SECURITY.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#E3C27F]"
              >
                Security
              </a>
              <a
                href={release.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#E3C27F]"
              >
                Repository
              </a>
            </nav>
          </footer>
        </section>
      </main>
    </div>
  )
}
