import { Seo } from "@/lib/seo";

/**
 * Terms of Service page.
 */

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose prose-invert">
      <Seo title="Terms of Service — Pitch26" description="Terms of Service for Pitch26." path="/terms" />
      <h1 className="display text-4xl">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: July 7, 2026</p>

      <h2 className="mt-8 text-xl font-bold">1. Acceptance</h2>
      <p>By using Pitch26 you agree to these Terms. If you do not agree, do not use the service.</p>

      <h2 className="mt-6 text-xl font-bold">2. Account & Sign-in</h2>
      <p>We use Google Sign-In only to authenticate you. We do not post to your Google account or read your emails.</p>

      <h2 className="mt-6 text-xl font-bold">3. Acceptable use</h2>
      <p>Do not attempt to abuse the service, redistribute streams, or use the platform for unlawful activity.</p>

      <h2 className="mt-6 text-xl font-bold">4. Content</h2>
      <p>Match data, news, and streams are provided by third parties. We do not guarantee accuracy or availability.</p>

      <h2 className="mt-6 text-xl font-bold">5. Liability</h2>
      <p>Pitch26 is provided "as is" without warranty of any kind.</p>

      <h2 className="mt-6 text-xl font-bold">6. Contact</h2>
      <p>Questions: <a href="mailto:saadabdullah07bd@gmail.com" className="text-primary">saadabdullah07bd@gmail.com</a></p>
    </article>
  );
}
