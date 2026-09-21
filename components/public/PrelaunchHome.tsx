import Image from "next/image";
import Link from "next/link";
import styles from "./PrelaunchHome.module.css";


function LinkedInIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function InstagramIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const expertRoles = [
  "Brand & Graphic Design",
  "Marketing Creative",
  "Architecture",
  "Interior Design",
] as const;

export default function PrelaunchHome() {
  return (
    <main className={styles.page}>
      <div className={styles.videoBackdrop} aria-hidden="true">
        <video
          className={styles.video}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-video-poster.jpg"
        >
          <source src="/hero-video-web.mp4" type="video/mp4" />
        </video>
        <div className={styles.videoOverlay} />
      </div>

      <section className={styles.content} aria-labelledby="prelaunch-heading">
        <Link className={styles.brand} href="/" aria-label="Heyy Studio home">
          <Image src="/logo.svg" alt="Heyy Studio" width={128} height={81} priority />
        </Link>

        <p className={styles.eyebrow}>Something new is coming</p>

        <h1 id="prelaunch-heading" className={styles.title}>
          Creativity is about to feel
          <span>different.</span>
        </h1>

        <p className={styles.intro}>
          Heyy Studio is building a connected creative operating system where ideas become
          brands, experiences and production-ready outcomes.
        </p>

        <p className={styles.tagline}>Create with Heyy. Build with Experts.</p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/expertsnetwork?source=coming-soon">
            Join our expert network
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <aside className={styles.expertPanel} aria-label="Heyy Studio Expert Network">
          <div className={styles.expertCopy}>
            <div className={styles.expertTopline}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>Creative experts wanted</span>
            </div>

            <h2>Help us build what comes next.</h2>
            <p>
              We’re growing the Heyy Studio Experts Network ahead of launch and looking for
              exceptional creatives and design professionals for future client projects.
            </p>
          </div>

          <div className={styles.roles} aria-label="Expert Network categories">
            {expertRoles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
        </aside>
      </section>

      <footer className={styles.footer}>
        <div className={styles.socials} aria-label="Heyy Studio social media">
          <a href="https://www.linkedin.com/company/heyy-studio-ai/" target="_blank" rel="noreferrer" aria-label="Heyy Studio on LinkedIn">
            <LinkedInIcon size={15} />
          </a>
          <a href="https://www.instagram.com/heyy_studio_/" target="_blank" rel="noreferrer" aria-label="Heyy Studio on Instagram">
            <InstagramIcon size={15} />
          </a>
        </div>
        <span>Melbourne, Australia 🇦🇺</span>
        <span aria-hidden="true">·</span>
        <span>© 2026 Heyy Studio. All rights reserved.</span>
      </footer>
    </main>
  );
}
