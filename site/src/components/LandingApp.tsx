import { useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  ShieldCheck
} from 'lucide-react'
import { ArmillaryFolioStage, type HallMoodPreview } from '../scene/ArmillaryFolioStage'
import {
  buildFallbackRelease,
  detectClientPlatform,
  fetchLatestRelease,
  pickPrimaryAsset,
  resolveRepositorySlug,
  type ReleasePayload
} from '../lib/releases'

type PlatformTab = 'linux' | 'windows' | 'macos' | 'android'

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
  { id: 'macos', label: 'macOS', arch: 'Apple Silicon · .dmg & .zip' },
  { id: 'android', label: 'Android', arch: 'APK · Android 8.0+ Universal' }
]

const HALL_MOODS: Array<{ id: HallMoodPreview; label: string; note: string }> = [
  { id: 'dark-academia', label: 'Dark Academia', note: 'Candlelit oak and gilded brass' },
  { id: 'sunlit-marble', label: 'Sunlit Marble', note: 'Daylight limestone colonnade' },
  { id: 'observatory', label: 'Observatory', note: 'Midnight indigo celestial dome' }
]

const HIGHLIGHT_TONES = [
  { name: 'Amber', color: '#d4a64a' },
  { name: 'Sage', color: '#78a882' },
  { name: 'Rose', color: '#c47b78' },
  { name: 'Cobalt', color: '#6b94c4' },
  { name: 'Slate', color: '#9a9286' }
]

export function LandingApp() {
  const scrollProgressRef = useRef<number>(0)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const lenisRef = useRef<Lenis | null>(null)

  const [activeChapter, setActiveChapter] = useState<number>(0)
  const [scrolledPastHero, setScrolledPastHero] = useState<boolean>(false)
  const [hallMood, setHallMood] = useState<HallMoodPreview>('dark-academia')
  const [visibleChapters, setVisibleChapters] = useState<Record<string, boolean>>({
    proposition: true
  })
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

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let active = true
    void fetchLatestRelease(repoSlug).then((data) => {
      if (active) setRelease(data)
    })
    return () => {
      active = false
    }
  }, [repoSlug])

  // Graceful editorial reveal per chapter via IntersectionObserver
  useEffect(() => {
    if (reducedMotion) {
      const all: Record<string, boolean> = {}
      CHAPTERS.forEach((c) => {
        all[c.id] = true
      })
      setVisibleChapters(all)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleChapters((prev) => {
          let changed = false
          const next = { ...prev }
          for (const entry of entries) {
            if (entry.isIntersecting && !next[entry.target.id]) {
              next[entry.target.id] = true
              changed = true
            }
          }
          return changed ? next : prev
        })
      },
      { threshold: 0.22 }
    )

    CHAPTERS.forEach((chapter) => {
      const el = document.getElementById(chapter.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [reducedMotion])

  // Smooth inertial scrolling via Lenis + normalized choreography progress
  useEffect(() => {
    const syncScroll = (): void => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const y = window.scrollY
      const progress = Math.max(0, Math.min(1, y / maxScroll))
      scrollProgressRef.current = progress
      setScrolledPastHero(y > 40)

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress})`
      }

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
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    })
    lenisRef.current = lenis

    let rafId = 0
    const onRaf = (time: number): void => {
      if (document.hidden) {
        rafId = 0
        return
      }
      lenis.raf(time)
      syncScroll()
      rafId = window.requestAnimationFrame(onRaf)
    }
    const onVisibilityChange = (): void => {
      if (document.hidden) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      } else if (rafId === 0) {
        rafId = window.requestAnimationFrame(onRaf)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (!document.hidden) {
      rafId = window.requestAnimationFrame(onRaf)
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
      lenisRef.current.scrollTo(el, { offset: -20 })
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
        : selectedTab === 'android'
          ? 'sha256sum -c SHA256SUMS.txt # then open Alexandria-*.apk on Android'
          : 'sha256sum -c SHA256SUMS.txt && chmod +x Alexandria-*.AppImage'

  const copyVerifyCommand = (): void => {
    if (!navigator.clipboard) return
    void navigator.clipboard.writeText(verifyCommand).then(() => {
      setCopiedSha(true)
      window.setTimeout(() => setCopiedSha(false), 2000)
    })
  }

  const primaryDownloadHref = primaryAsset ? primaryAsset.downloadUrl : '#downloads'
  const activeMoodInfo = HALL_MOODS.find((m) => m.id === hallMood) ?? HALL_MOODS[0]

  return (
    <div className="relative min-h-screen bg-[#0c0a09] text-[#e9dfc9]">
      {/* Persistent Single Centerpiece: Scroll-Choreographed 3D Brass Armillary & Hinged Folio */}
      <ArmillaryFolioStage
        scrollProgressRef={scrollProgressRef}
        reducedMotion={reducedMotion}
        mood={hallMood}
      />

      {/* Strict 3-Zone Top Bar */}
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${
          scrolledPastHero
            ? 'border-b border-[#b08d57]/18 bg-[#0c0a09]/94'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-8 px-6 md:px-10">
          {/* Zone 1: Clean single-element brand wordmark in Almendra */}
          <a
            href="#proposition"
            onClick={(e) => {
              e.preventDefault()
              scrollToSection('proposition')
            }}
            className="focus-brass font-display text-[25px] font-bold tracking-[0.04em] text-[#e9dfc9] transition-colors hover:text-[#d2ae76]"
          >
            Alexandria
          </a>

          {/* Zone 2: Concise single-line navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-8 text-[13px] font-medium tracking-[0.015em] text-[#998b76] md:flex"
          >
            <button
              type="button"
              onClick={() => scrollToSection('grand-hall')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#e9dfc9]"
            >
              Grand Hall
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reader')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#e9dfc9]"
            >
              Reader
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('architecture')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#e9dfc9]"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('downloads')}
              className="focus-brass cursor-pointer whitespace-nowrap transition-colors hover:text-[#e9dfc9]"
            >
              Downloads
            </button>
            <a
              href={release.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-brass inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-[#e9dfc9]"
            >
              GitHub
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </a>
          </nav>

          {/* Zone 3: Single primary OS-aware CTA */}
          <button
            type="button"
            onClick={() => scrollToSection('downloads')}
            className="focus-brass inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border border-[#b08d57]/80 bg-[#b08d57] px-4 py-2 text-[13px] font-medium text-[#0c0a09] transition-colors hover:border-[#d2ae76] hover:bg-[#d2ae76]"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>

        {/* Continuous Scroll Progress Hairline */}
        <div className="h-[1px] w-full bg-transparent">
          <div
            ref={progressBarRef}
            className="h-full w-full origin-left bg-[#d2ae76]/70"
            style={{ transform: 'scaleX(0)' }}
          />
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
                className={`text-[10.5px] font-medium tracking-[0.16em] uppercase transition-opacity duration-300 ${
                  isActive
                    ? 'text-[#d2ae76] opacity-100'
                    : 'text-[#877a66] opacity-0 group-hover:opacity-100'
                }`}
              >
                {chapter.label}
              </span>
              <span
                className={`font-display text-[14px] tracking-[0.08em] transition-colors ${
                  isActive ? 'text-[#d2ae76]' : 'text-[#665b4c] group-hover:text-[#b08d57]'
                }`}
              >
                {chapter.roman}
              </span>
              <span
                className={`block h-[1px] transition-all duration-300 ${
                  isActive ? 'w-7 bg-[#d2ae76]' : 'w-3 bg-[#b08d57]/30 group-hover:w-5'
                }`}
              />
            </button>
          )
        })}
      </aside>

      {/* Editorial Narrative Flow */}
      <main className="relative z-10">
        {/* ================================================================= */}
        {/* CHAPTER I: PROPOSITION (HERO)                                     */}
        {/* ================================================================= */}
        <section
          id="proposition"
          className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 pb-14 pt-28 md:px-10"
        >
          <div
            className="chapter-reveal editorial-plate max-w-[540px] p-8 md:p-10"
            data-visible={visibleChapters['proposition'] ? 'true' : 'false'}
          >
            <p className="font-code text-[11px] tracking-[0.2em] text-[#b08d57] uppercase">
              Chapter I · Local-First 3D Library
            </p>

            <h1 className="font-display mt-4 text-[clamp(2.85rem,5.4vw,4.6rem)] leading-[1.02] font-normal tracking-[0.01em] text-[#f2e9d8]">
              Your PDFs deserve a{' '}
              <span className="italic text-[#d2ae76]">room of their own.</span>
            </h1>

            <p className="mt-5 text-[15px] leading-[1.75] text-[#c4b8a4]">
              Alexandria turns your local PDF collection into a walkable dark-academia Grand Hall
              paired with a flicker-free, exact-click reader. Everything lives in one plain folder
              on your machine with SQLite FTS5 search and zero telemetry.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              {primaryAsset && release.live ? (
                <a
                  href={primaryDownloadHref}
                  className="focus-brass inline-flex items-center gap-2.5 border border-[#b08d57] bg-[#b08d57] px-5 py-3 text-[13.5px] font-medium text-[#0c0a09] transition-colors hover:border-[#d2ae76] hover:bg-[#d2ae76]"
                >
                  <Download className="h-4 w-4" />
                  {clientPlatform.shortCta}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollToSection('downloads')}
                  className="focus-brass inline-flex cursor-pointer items-center gap-2.5 border border-[#b08d57] bg-[#b08d57] px-5 py-3 text-[13.5px] font-medium text-[#0c0a09] transition-colors hover:border-[#d2ae76] hover:bg-[#d2ae76]"
                >
                  <Download className="h-4 w-4" />
                  {clientPlatform.shortCta}
                </button>
              )}

              <a
                href={demoHref}
                className="focus-brass inline-flex items-center gap-2 border border-[#b08d57]/38 bg-[#181410] px-5 py-3 text-[13.5px] font-medium text-[#e9dfc9] transition-colors hover:border-[#d2ae76] hover:text-[#d2ae76]"
              >
                Try Web Demo
                <ArrowUpRight className="h-4 w-4 text-[#b08d57]" />
              </a>
            </div>

            <div className="brass-rule mt-7 mb-5 h-[1px] w-full" />

            <p className="font-code text-[11.5px] tracking-[0.02em] text-[#998b76]">
              {release.versionLabel} · Linux, Windows &amp; macOS · MIT Open Source · Offline First
            </p>
          </div>

          <button
            type="button"
            onClick={() => scrollToSection('grand-hall')}
            className="focus-brass mt-10 inline-flex w-fit cursor-pointer items-center gap-2.5 text-[11.5px] tracking-[0.16em] text-[#998b76] uppercase transition-colors hover:text-[#d2ae76]"
          >
            <ArrowDown className="h-3.5 w-3.5 text-[#b08d57]" />
            Scroll to explore the hall
          </button>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER II: THE 3D GRAND HALL                                     */}
        {/* ================================================================= */}
        <section
          id="grand-hall"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-end px-6 py-24 md:px-10"
        >
          <div
            className="chapter-reveal editorial-plate w-full max-w-[540px] p-8 md:p-10"
            data-visible={visibleChapters['grand-hall'] ? 'true' : 'false'}
          >
            <p className="font-code text-[11px] tracking-[0.2em] text-[#b08d57] uppercase">
              Chapter II · Spatial Memory
            </p>

            <h2 className="font-display mt-3.5 text-[clamp(2.2rem,4.1vw,3.3rem)] leading-[1.06] font-normal text-[#f2e9d8]">
              Walk your shelves from floor to mezzanine.
            </h2>

            <p className="mt-4 text-[14.5px] leading-[1.75] text-[#c0b4a0]">
              Every volume you import becomes a real leather-bound spine arranged along oak bays,
              rolling ladders, and a walkable upper balcony beneath a rotating celestial armillary.
              Drag books directly between shelves, build new wings, and remember ideas by where
              they stand.
            </p>

            {/* Interactive Hall Atmosphere Switcher driving the 3D Armillary studio lighting live */}
            <div className="mt-6 border border-[#b08d57]/20 bg-[#14110e] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-code text-[10.5px] tracking-[0.16em] text-[#b08d57] uppercase">
                  Preview Hall Atmosphere
                </span>
                <span className="text-[11.5px] text-[#998b76]">{activeMoodInfo.note}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {HALL_MOODS.map((item) => {
                  const active = hallMood === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHallMood(item.id)}
                      className={`focus-brass cursor-pointer border px-2.5 py-2 text-[12px] font-medium transition-colors ${
                        active
                          ? 'border-[#d2ae76] bg-[#b08d57]/20 text-[#f2e9d8]'
                          : 'border-[#b08d57]/18 bg-[#0e0c0a] text-[#998b76] hover:border-[#b08d57]/45 hover:text-[#e9dfc9]'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="brass-rule my-6 h-[1px] w-full" />

            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <dt className="font-display text-[20px] font-normal text-[#e9dfc9]">
                  Walkable Mezzanine
                </dt>
                <dd className="mt-1 text-[13px] leading-[1.65] text-[#9f927e]">
                  Fluid WASD movement, smooth staircase ascent, live corner mini-map, and quick
                  preview cards with reading progress.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[20px] font-normal text-[#e9dfc9]">
                  Procedural Soundscape
                </dt>
                <dd className="mt-1 text-[13px] leading-[1.65] text-[#9f927e]">
                  Layer soft rain, crackling hearth fire, and subtle chimes, or play your local
                  albums from the persistent music dock.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[20px] font-normal text-[#e9dfc9]">
                  Direct 3D Shelving
                </dt>
                <dd className="mt-1 text-[13px] leading-[1.65] text-[#9f927e]">
                  Drag spines across bays in real time, create custom wings, and track progress
                  right on each leather spine.
                </dd>
              </div>
              <div>
                <dt className="font-display text-[20px] font-normal text-[#e9dfc9]">
                  Reading Desk
                </dt>
                <dd className="mt-1 text-[13px] leading-[1.65] text-[#9f927e]">
                  Pin active treatises to your desk so your current work stays one click away the
                  moment you enter the hall.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER III: PRECISION PDF READER (FOLIO OPENS IN 3D)             */}
        {/* ================================================================= */}
        <section
          id="reader"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-start px-6 py-24 md:px-10"
        >
          <div
            className="chapter-reveal editorial-plate w-full max-w-[540px] p-8 md:p-10"
            data-visible={visibleChapters['reader'] ? 'true' : 'false'}
          >
            <p className="font-code text-[11px] tracking-[0.2em] text-[#b08d57] uppercase">
              Chapter III · Precision Reading
            </p>

            <h2 className="font-display mt-3.5 text-[clamp(2.2rem,4.1vw,3.3rem)] leading-[1.06] font-normal text-[#f2e9d8]">
              Every highlight lands exactly where you mark.
            </h2>

            <p className="mt-4 text-[14.5px] leading-[1.75] text-[#c0b4a0]">
              Open any volume into a calm, Retina-sharp reader engineered with double-buffered
              offscreen rendering so pages never flash or shift. Mark passages in five archival
              highlight tones, draw freehand ink, attach notes, and erase cleanly without ever
              mutating the original PDF file.
            </p>

            {/* Archival Highlight Swatches Strip */}
            <div className="mt-6 flex items-center justify-between border border-[#b08d57]/18 bg-[#14110e] px-4 py-3">
              <span className="font-code text-[10.5px] tracking-[0.14em] text-[#998b76] uppercase">
                Five Archival Highlight Tones
              </span>
              <div className="flex items-center gap-2.5" aria-label="Five archival highlight tones">
                {HIGHLIGHT_TONES.map((tone) => (
                  <span
                    key={tone.name}
                    title={tone.name}
                    className="h-3.5 w-3.5 rounded-full border border-[#0c0a09]/70"
                    style={{ backgroundColor: tone.color }}
                  />
                ))}
              </div>
            </div>

            <div className="brass-rule my-6 h-[1px] w-full" />

            <ul className="space-y-3.5 text-[13.5px] leading-[1.6] text-[#bcb09c]">
              <li className="flex items-center justify-between gap-4 border-b border-[#b08d57]/14 pb-3">
                <span className="font-medium text-[#e9dfc9]">Exact-Click Annotator</span>
                <span className="font-code text-[11.5px] text-[#d2ae76]">
                  Highlight · Ink · Erase · Notes
                </span>
              </li>
              <li className="flex items-center justify-between gap-4 border-b border-[#b08d57]/14 pb-3">
                <span className="font-medium text-[#e9dfc9]">Distraction-Free Study Mode</span>
                <span className="font-code text-[11.5px] text-[#d2ae76]">
                  Session Timer · Paper · Sepia · Charcoal
                </span>
              </li>
              <li className="flex items-center justify-between gap-4 border-b border-[#b08d57]/14 pb-3">
                <span className="font-medium text-[#e9dfc9]">Per-Book Reading Memory</span>
                <span className="font-code text-[11.5px] text-[#d2ae76]">
                  Zoom · Spread · Rotation · Exact Page
                </span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="font-medium text-[#e9dfc9]">Keyboard-Native Flow</span>
                <span className="flex items-center gap-1.5">
                  <kbd className="brass-key">H</kbd>
                  <kbd className="brass-key">I</kbd>
                  <kbd className="brass-key">B</kbd>
                  <kbd className="brass-key">F</kbd>
                  <kbd className="brass-key">Esc</kbd>
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER IV: LOCAL-FIRST ARCHITECTURE                              */}
        {/* ================================================================= */}
        <section
          id="architecture"
          className="mx-auto flex min-h-screen max-w-6xl items-center justify-end px-6 py-24 md:px-10"
        >
          <div
            className="chapter-reveal editorial-plate w-full max-w-[540px] p-8 md:p-10"
            data-visible={visibleChapters['architecture'] ? 'true' : 'false'}
          >
            <p className="font-code text-[11px] tracking-[0.2em] text-[#b08d57] uppercase">
              Chapter IV · Sovereignty by Design
            </p>

            <h2 className="font-display mt-3.5 text-[clamp(2.2rem,4.1vw,3.3rem)] leading-[1.06] font-normal text-[#f2e9d8]">
              One plain folder. Zero cloud lock-in.
            </h2>

            <p className="mt-4 text-[14.5px] leading-[1.75] text-[#c0b4a0]">
              Your entire library lives in an ordinary directory you own. Sync it with Syncthing,
              back it up with rsync or Time Machine, or move it onto a portable drive. Alexandria
              makes zero background network calls.
            </p>

            {/* Museum Index Plate: Plain Folder Layout */}
            <div className="mt-6 border border-[#b08d57]/22 bg-[#120f0c] p-4 font-code text-[12px] leading-[1.75] text-[#c4b8a4]">
              <div className="mb-1.5 flex items-center gap-2 text-[#d2ae76]">
                <FolderOpen className="h-3.5 w-3.5" />
                <span>~/Alexandria/</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-y-0.5 pl-5 text-[11.5px]">
                <span className="text-[#e9dfc9]">library.db</span>
                <span className="text-[#8e806b]">SQLite FTS5 index, shelves &amp; annotations</span>
                <span className="text-[#e9dfc9]">books/</span>
                <span className="text-[#8e806b]">Original untouched PDF volumes</span>
                <span className="text-[#e9dfc9]">covers/</span>
                <span className="text-[#8e806b]">High-resolution cover thumbnails</span>
                <span className="text-[#e9dfc9]">config.json</span>
                <span className="text-[#8e806b]">Human-readable local preferences</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-7 gap-y-5 border-y border-[#b08d57]/18 py-5">
              <div>
                <p className="font-display text-[30px] leading-none text-[#d2ae76]">FTS5</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#9f927e]">
                  Millisecond search across titles, full text, and margin notes with{' '}
                  <span className="font-code text-[#e9dfc9]">Ctrl/Cmd+K</span>.
                </p>
              </div>
              <div>
                <p className="font-display text-[30px] leading-none text-[#d2ae76]">SHA-256</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#9f927e]">
                  Automatic content hashing prevents duplicate shelves and relinks moved PDFs.
                </p>
              </div>
              <div>
                <p className="font-display text-[30px] leading-none text-[#d2ae76]">7 Formats</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#9f927e]">
                  Native PDF plus optional LibreOffice conversion for DOCX, PPTX, ODT, and ODP.
                </p>
              </div>
              <div>
                <p className="font-display text-[30px] leading-none text-[#d2ae76]">0 Bytes</p>
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#9f927e]">
                  Telemetry sent. No accounts, no tracking pixels, and no cloud paywalls.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-6 text-[13px] font-medium">
              <a
                href={`${release.repoUrl}/blob/main/docs/ARCHITECTURE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass inline-flex items-center gap-1.5 text-[#d2ae76] transition-colors hover:text-[#f2e9d8]"
              >
                Architecture Guide
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href={`${release.repoUrl}/blob/main/docs/CONTROLS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass inline-flex items-center gap-1.5 text-[#a99b86] transition-colors hover:text-[#e9dfc9]"
              >
                Controls Reference
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CHAPTER V: CROSS-PLATFORM DOWNLOADS & LIVE RELEASE MATRIX         */}
        {/* ================================================================= */}
        <section
          id="downloads"
          className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-24 md:px-10"
        >
          <div
            className="chapter-reveal editorial-plate p-7 md:p-11"
            data-visible={visibleChapters['downloads'] ? 'true' : 'false'}
          >
            <div className="flex flex-col justify-between gap-6 border-b border-[#b08d57]/18 pb-7 md:flex-row md:items-end">
              <div>
                <p className="font-code text-[11px] tracking-[0.2em] text-[#b08d57] uppercase">
                  Chapter V · Acquire Alexandria
                </p>
                <h2 className="font-display mt-3 text-[clamp(2.1rem,3.9vw,3.15rem)] leading-[1.06] font-normal text-[#f2e9d8]">
                  Install native desktop or explore in browser.
                </h2>
                <p className="font-code mt-2.5 text-[11.5px] text-[#998b76]">
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
                className="focus-brass inline-flex shrink-0 items-center justify-center gap-2 border border-[#b08d57]/45 bg-[#191511] px-5 py-3 text-[13px] font-medium text-[#e9dfc9] transition-colors hover:border-[#d2ae76] hover:text-[#d2ae76]"
              >
                Launch Interactive Web Demo
                <ArrowUpRight className="h-4 w-4 text-[#b08d57]" />
              </a>
            </div>

            {/* Platform selector bar */}
            <div
              role="tablist"
              aria-label="Desktop operating system"
              className="mt-6 flex flex-wrap gap-7 border-b border-[#b08d57]/16"
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
                    className={`focus-brass -mb-[1px] cursor-pointer border-b-2 pb-3 text-left transition-colors ${
                      active
                        ? 'border-[#d2ae76] text-[#f2e9d8]'
                        : 'border-transparent text-[#8c7e6a] hover:text-[#d6cab4]'
                    }`}
                  >
                    <span className="text-[13.5px] font-medium">
                      {tab.label}
                      {isDetected ? ' · Detected' : ''}
                    </span>
                    <span className="font-code mt-0.5 block text-[11px] text-[#847763]">
                      {tab.arch}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Release asset rows */}
            <div className="mt-5 divide-y divide-[#b08d57]/14">
              {visibleAssets.map((asset) => (
                <div
                  key={asset.name}
                  className="flex flex-col justify-between gap-4 py-4.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-display text-[22px] font-normal text-[#f2e9d8]">
                        {asset.formatLabel}
                      </span>
                      {asset.recommended ? (
                        <span className="font-code text-[10.5px] tracking-[0.12em] text-[#d2ae76] uppercase">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#9f927e]">{asset.formatDetail}</p>
                    <p className="font-code mt-1 text-[11.5px] text-[#7c705e]">
                      {asset.name} · {asset.sizeLabel}
                    </p>
                  </div>

                  <a
                    href={asset.downloadUrl}
                    target={release.live ? undefined : '_blank'}
                    rel={release.live ? undefined : 'noopener noreferrer'}
                    className={`focus-brass inline-flex shrink-0 items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-medium transition-colors ${
                      asset.recommended
                        ? 'border border-[#b08d57] bg-[#b08d57] text-[#0c0a09] hover:border-[#d2ae76] hover:bg-[#d2ae76]'
                        : 'border border-[#b08d57]/35 bg-transparent text-[#d2ae76] hover:border-[#d2ae76] hover:bg-[#b08d57]/12'
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {release.live ? 'Download' : 'View Release'}
                  </a>
                </div>
              ))}
            </div>

            {/* Cryptographic SHA-256 verification bar */}
            <div className="mt-6 flex flex-col justify-between gap-4 border-t border-[#b08d57]/18 pt-6 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b08d57]" />
                <div>
                  <p className="text-[13px] font-medium text-[#e9dfc9]">
                    Verify installer integrity with{' '}
                    <a
                      href={release.checksumAsset?.downloadUrl ?? release.releasesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-[#b08d57]/55 underline-offset-4 hover:text-[#d2ae76]"
                    >
                      SHA256SUMS.txt
                    </a>
                  </p>
                  <code className="font-code mt-1 block text-[11.5px] text-[#998b76]">
                    {verifyCommand}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={copyVerifyCommand}
                  className="focus-brass inline-flex cursor-pointer items-center gap-1.5 border border-[#b08d57]/32 px-3.5 py-2 font-code text-[11.5px] text-[#d6cab4] transition-colors hover:border-[#d2ae76] hover:text-[#f2e9d8]"
                >
                  {copiedSha ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#d2ae76]" />
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
                  className="focus-brass inline-flex items-center gap-1.5 border border-[#b08d57]/20 px-3.5 py-2 text-[12px] text-[#998b76] transition-colors hover:border-[#b08d57]/55 hover:text-[#e9dfc9]"
                >
                  All Releases
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Editorial Footer */}
          <footer className="mt-12 flex flex-col justify-between gap-5 border-t border-[#b08d57]/16 pt-7 text-[12.5px] text-[#8d7f6c] md:flex-row md:items-center">
            <div>
              <span className="font-display text-[18px] tracking-[0.04em] text-[#e9dfc9]">
                Alexandria
              </span>
              <span className="mx-2.5 text-[#b08d57]/45">·</span>
              <span>Local-first 3D PDF library · MIT License</span>
            </div>

            <nav aria-label="Documentation links" className="flex flex-wrap items-center gap-6">
              <a
                href={`${release.repoUrl}/blob/main/docs/USER_GUIDE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#d2ae76]"
              >
                User Guide
              </a>
              <a
                href={`${release.repoUrl}/blob/main/docs/CONTROLS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#d2ae76]"
              >
                Controls
              </a>
              <a
                href={`${release.repoUrl}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#d2ae76]"
              >
                Contributing
              </a>
              <a
                href={`${release.repoUrl}/blob/main/SECURITY.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#d2ae76]"
              >
                Security
              </a>
              <a
                href={release.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-brass transition-colors hover:text-[#d2ae76]"
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
