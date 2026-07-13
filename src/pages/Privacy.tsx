import { Seo } from "@/lib/seo";

/**
 * Privacy Policy — expanded for Google OAuth verification & branding review.
 * This page is maintained by the Pitch26 app owner; it describes app-visible
 * controls and app-owner practices, and is not an independent certification.
 */
export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose prose-invert">
      <Seo
        title="Privacy Policy — Pitch26"
        description="How Pitch26 collects, uses, protects, and shares user data, including data received via Google Sign-In."
        path="/privacy"
      />

      <h1 className="display text-4xl">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: July 12, 2026</p>

      <p>
        This Privacy Policy is maintained by the Pitch26 app owner ("Pitch26", "we", "us") to
        explain what data we collect when you use the Pitch26 website and app (the "Service") and
        how we handle it. Pitch26 is an independent FIFA World Cup 2026 fan hub and is not
        affiliated with, endorsed by, or sponsored by FIFA.
      </p>

      <h2 className="mt-8 text-xl font-bold">1. Information we collect</h2>
      <p>When you sign in with Google, we receive:</p>
      <ul className="list-disc pl-6">
        <li>Your Google account email address.</li>
        <li>Your Google account display name (if provided).</li>
        <li>Your Google profile picture URL (if provided).</li>
        <li>A stable Google user identifier used to look up your session.</li>
      </ul>
      <p>
        We do <strong>not</strong> receive or store your Google password. We do not request access
        to Gmail, Drive, Calendar, Contacts, YouTube, or any other Google service beyond basic
        profile identification.
      </p>
      <p>
        In addition, we store the preferences you create inside Pitch26, such as favourite team, and
        notification preferences.
      </p>

      <h2 className="mt-6 text-xl font-bold">2. Google OAuth scopes we request</h2>
      <p>Pitch26 only requests the following non-sensitive Google OAuth scopes:</p>
      <ul className="list-disc pl-6">
        <li>
          <code>openid</code> — to identify your account.
        </li>
        <li>
          <code>https://www.googleapis.com/auth/userinfo.email</code> — to receive your email
          address.
        </li>
        <li>
          <code>https://www.googleapis.com/auth/userinfo.profile</code> — to receive your basic
          profile (name and avatar).
        </li>
      </ul>
      <p>We do not request any sensitive or restricted Google API scopes.</p>

      <h2 className="mt-6 text-xl font-bold">3. How we use your data</h2>
      <ul className="list-disc pl-6">
        <li>To authenticate you and keep you signed in.</li>
        <li>To personalise features such as favourites.</li>
        <li>To provide access to gated features such as the Live TV hub.</li>
        <li>To protect the Service from abuse and to fix bugs.</li>
      </ul>
      <p>
        We do <strong>not</strong> use Google user data for advertising, we do not sell it, and we
        do not transfer it to third parties for use in training generalized artificial-intelligence
        or machine-learning models.
      </p>

      <h2 className="mt-6 text-xl font-bold">
        4. Google API Services User Data Policy — Limited Use
      </h2>
      <p>
        Pitch26's use and transfer to any other app of information received from Google APIs adheres
        to the{" "}
        <a
          className="text-primary underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2 className="mt-6 text-xl font-bold">5. Sharing & subprocessors</h2>
      <p>
        We do not sell your data. We share limited technical data with infrastructure providers that
        are required to run the Service:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong>Supabase</strong> — authentication, database, and edge functions.
        </li>
        <li>
          <strong>Google</strong> — identity provider for Sign-In with Google.
        </li>
        <li>
          <strong>Content delivery network (CDN)</strong> — to serve static assets and images.
        </li>
      </ul>
      <p>
        These providers process data only on our instructions and only to deliver the Service. We
        may disclose data if required by law.
      </p>

      <h2 className="mt-6 text-xl font-bold">6. Data retention</h2>
      <p>
        We keep account data for as long as your account is active. If you delete your account, we
        remove your profile, favourites and Google identifiers from our production database within
        30 days. Backups are rotated on a rolling schedule and are then permanently overwritten.
      </p>

      <h2 className="mt-6 text-xl font-bold">7. Data deletion & your rights</h2>
      <p>
        You may request deletion of your account and associated data at any time by emailing{" "}
        <a className="text-primary underline" href="mailto:saadabdullah07bd@gmail.com">
          saadabdullah07bd@gmail.com
        </a>{" "}
        from the email address linked to your account. Depending on where you live, you may also
        have rights to access, correct, export, or object to certain processing of your personal
        data.
      </p>

      <h2 className="mt-6 text-xl font-bold">8. Security</h2>
      <p>
        Traffic to Pitch26 is served over HTTPS. Passwords are never seen by Pitch26 because
        authentication is delegated to Google. Access to production data is restricted to the app
        owner. No online service can guarantee absolute security, so please use a strong Google
        password and enable 2-Step Verification on your Google account.
      </p>

      <h2 className="mt-6 text-xl font-bold">9. Children</h2>
      <p>
        Pitch26 is not directed to children under 13, and we do not knowingly collect personal data
        from them.
      </p>

      <h2 className="mt-6 text-xl font-bold">10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be reflected by updating
        the "Last updated" date above.
      </p>

      <h2 className="mt-6 text-xl font-bold">11. Contact</h2>
      <p>
        Questions or privacy requests:{" "}
        <a className="text-primary underline" href="mailto:saadabdullah07bd@gmail.com">
          saadabdullah07bd@gmail.com
        </a>
      </p>
    </article>
  );
}
