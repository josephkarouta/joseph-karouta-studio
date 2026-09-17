import Image from "next/image";
import Link from "next/link";
import styles from "./PrelaunchHome.module.css";

const expertRoles = [
  "Brand & Graphic Design",
  "Marketing Creative",
  "Architecture",
  "Interior Design",
] as const;

export default function PrelaunchHome() {
  return (
    <main className={styles.page}>
      <div className={`${styles.orb} ${styles.orbOne}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbTwo}`} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

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
          Heyy Studio is building an AI-powered creative operating system where ideas become
          brands, experiences and production-ready outcomes.
        </p>

        <p className={styles.tagline}>Create with AI. Build with Experts.</p>

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
        <span>Melbourne, Australia 🇦🇺</span>
        <span aria-hidden="true">·</span>
        <span>© 2026 Heyy Studio. All rights reserved.</span>
      </footer>
    </main>
  );
}
