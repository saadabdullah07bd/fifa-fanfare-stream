import { Seo } from "@/lib/seo";

/**
 * Terms of Service — expanded for Google OAuth verification & branding review.
 * Maintained by the Pitch26 app owner.
 */
export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose prose-invert">
      <Seo
        title="Terms of Service — Pitch26"
        description="Terms of Service governing use of the Pitch26 FIFA World Cup 2026 fan hub."
        path="/terms"
      />

      <h1 className="display text-4xl">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: July 12, 2026</p>

      <p>
        These Terms of Service ("Terms") govern your use of the Pitch26 website and app (the
        "Service"), operated by the Pitch26 app owner ("Pitch26", "we", "us"). Pitch26 is an
        independent FIFA World Cup 2026 fan hub and is not affiliated with, endorsed by, or
        sponsored by FIFA.
      </p>

      <h2 className="mt-8 text-xl font-bold">1. Acceptance of terms</h2>
      <p>
        By accessing or using the Service you agree to be bound by these Terms and by our{" "}
        <a className="text-primary underline" href="/privacy">
          Privacy Policy
        </a>
        . If you do not agree, do not use the Service.
      </p>

      <h2 className="mt-6 text-xl font-bold">2. Eligibility</h2>
      <p>
        You must be at least 13 years old to use the Service. If you are under the age of majority
        in your jurisdiction, you must have permission from a parent or legal guardian.
      </p>

      <h2 className="mt-6 text-xl font-bold">3. Accounts & Sign-in with Google</h2>
      <p>
        Pitch26 uses Sign-In with Google to authenticate you. We request only the{" "}
        <code>openid</code>, <code>email</code>, and <code>profile</code> scopes. We do not post to
        your Google account, do not read your Gmail, Drive, Calendar, Contacts, or YouTube data, and
        do not access any Google Workspace content. You are responsible for maintaining the
        confidentiality of your Google account.
      </p>

      <h2 className="mt-6 text-xl font-bold">4. Acceptable use</h2>
      <ul className="list-disc pl-6">
        <li>Do not attempt to disrupt, reverse-engineer, or overload the Service.</li>
        <li>
          Do not redistribute, rebroadcast, or resell live streams, video, or third-party feeds
          accessed through the Service.
        </li>
        <li>
          Do not use the Service for unlawful activity or to infringe intellectual-property rights.
        </li>
        <li>Do not attempt to access accounts, data, or areas that are not intended for you.</li>
      </ul>

      <h2 className="mt-6 text-xl font-bold">5. Third-party content</h2>
      <p>
        Match data, news headlines, video streams, and images are provided by third parties. Pitch26
        does not guarantee the accuracy, timeliness, legality, or availability of third-party
        content. Trademarks, team names, and competition names belong to their respective owners and
        are used only for identification.
      </p>

      <h2 className="mt-6 text-xl font-bold">6. Intellectual property</h2>
      <p>
        The Pitch26 name, "PITCH26" wordmark, and app design are the property of the app owner. All
        other trademarks (including FIFA and team crests) belong to their respective owners.
      </p>

      <h2 className="mt-6 text-xl font-bold">7. Termination</h2>
      <p>
        You may stop using the Service at any time and request account deletion via the Privacy
        Policy. We may suspend or terminate access to the Service if you violate these Terms or if
        we are required to do so by law.
      </p>

      <h2 className="mt-6 text-xl font-bold">8. Disclaimers</h2>
      <p>
        The Service is provided <strong>"as is"</strong> and <strong>"as available"</strong> without
        warranties of any kind, whether express, implied, statutory, or otherwise, including
        warranties of merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2 className="mt-6 text-xl font-bold">9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Pitch26 and its app owner will not be liable for any
        indirect, incidental, special, consequential, or punitive damages, or any loss of profits or
        revenues, arising from your use of the Service.
      </p>

      <h2 className="mt-6 text-xl font-bold">10. Changes to the Service or Terms</h2>
      <p>
        We may modify the Service or these Terms at any time. Material changes to these Terms will
        be reflected by updating the "Last updated" date above. Continued use of the Service after
        changes take effect constitutes acceptance of the updated Terms.
      </p>

      <h2 className="mt-6 text-xl font-bold">11. Governing law</h2>
      <p>
        These Terms are governed by the laws applicable in the app owner's country of residence,
        without regard to conflict-of-laws principles.
      </p>

      <h2 className="mt-6 text-xl font-bold">12. Contact</h2>
      <p>
        Questions:{" "}
        <a className="text-primary underline" href="mailto:saadabdullah07bd@gmail.com">
          saadabdullah07bd@gmail.com
        </a>
      </p>
    </article>
  );
}
