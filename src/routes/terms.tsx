import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { Variants } from "motion/react";

export const Route = createFileRoute("/terms")({ component: TermsPage });

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
};

function TermsPage() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl px-5 py-16 sm:px-8"
    >
      <motion.div variants={stagger} initial="hidden" animate="visible">
        <motion.div variants={fadeUp}>
          <Link
            to="/"
            className="text-[11px] font-light text-muted-foreground underline-offset-3 transition-colors duration-150 hover:text-foreground hover:underline"
          >
            &larr; Back
          </Link>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="mt-8 font-display text-3xl font-semibold text-foreground"
        >
          Terms of Use
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-2 text-xs font-light text-muted-foreground"
        >
          Last updated: February 2026
        </motion.p>

        <motion.div
          variants={stagger}
          className="mt-10 space-y-8 text-sm font-light leading-relaxed text-foreground/80"
        >
          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              What This Tool Does
            </h2>
            <p>
              Font Snatcher inspects publicly served font assets from websites you provide. It reads
              only what your browser already receives when visiting those sites. No protection is
              bypassed, no private files are accessed, and no authentication is circumvented.
            </p>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              Font Licensing
            </h2>
            <p>
              Fonts are intellectual property of their respective creators and foundries. The ability
              to download a font file does not grant you a license to use it. Many fonts require
              paid licenses for commercial or personal use. You are solely responsible for verifying
              and complying with the applicable license terms before using any font obtained through
              this tool.
            </p>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              Your Responsibility
            </h2>
            <ul className="list-inside list-disc space-y-1.5 text-foreground/70">
              <li>Verify the license of every font before use in any project.</li>
              <li>Do not use fonts marked as paid or restricted without proper authorization.</li>
              <li>
                Respect the intellectual property rights of font designers and foundries.
              </li>
              <li>Comply with all applicable laws in your jurisdiction.</li>
            </ul>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              No Warranty
            </h2>
            <p>
              This tool is provided &ldquo;as is&rdquo; without warranty of any kind. We make no
              guarantees about the accuracy of license detection, font identification, or
              alternative suggestions. The tool may incorrectly classify a font&apos;s license
              status.
            </p>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              Limitation of Liability
            </h2>
            <p>
              The creators and operators of Font Snatcher shall not be held liable for any damages,
              legal claims, or disputes arising from the use of fonts obtained through this tool.
              Any use of downloaded fonts is entirely at your own risk.
            </p>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              Free Alternatives
            </h2>
            <p>
              The &ldquo;Find Alternatives&rdquo; feature suggests visually similar fonts from
              Google Fonts, which are free for commercial and personal use under the SIL Open Font
              License or Apache License 2.0. We recommend using these alternatives when you do not
              have a license for the original font.
            </p>
          </motion.section>

          <motion.section variants={fadeUp}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-foreground">
              Contact
            </h2>
            <p>
              Questions about these terms? Reach out at{" "}
              <a
                href="mailto:hey@ajanraj.com"
                className="text-foreground underline underline-offset-3 transition-colors duration-150 hover:text-primary"
              >
                hey@ajanraj.com
              </a>
              .
            </p>
          </motion.section>
        </motion.div>
      </motion.div>
    </motion.main>
  );
}
