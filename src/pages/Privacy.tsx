import { Seo } from "@/lib/seo";

/**
 * Privacy Policy page detailing data collection and usage.
 */

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose prose-invert">
      <Seo title="Privacy Policy — Pitch26" description="Privacy Policy for Pitch26." path="/privacy" />
      <h1 className="display text-4xl">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: July 7, 2026</p>

      <h2 className="mt-8 text-xl font-bold">Information we collect</h2>
      <p>
        When you sign in with Google, we receive your email address and a unique user ID
        from Google. We store this to identify your session and personalise your favourites
        and predictions. We do not receive or store your Google password.
      </p>

      <h2 className="mt-6 text-xl font-bold">How we use it</h2>
      <ul className="list-disc pl-6">
        <li>Authenticate your account.</li>
        <li>Save your preferences (favourites, predictions).</li>
        <li>Provide access to the Live TV feature.</li>
      </ul>

      <h2 className="mt-6 text-xl font-bold">Sharing</h2>
      <p>
        We do not sell your data. We only share limited technical data with our infrastructure
        provider (Supabase) required to run the service.
      </p>

      <h2 className="mt-6 text-xl font-bold">Google user data</h2>
      <p>
        Pitch26's use of information received from Google APIs adheres to the
        <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary"> Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2 className="mt-6 text-xl font-bold">Your rights</h2>
      <p>
        You may request deletion of your account and data at any time by emailing
        <a href="mailto:saadabdullah07bd@gmail.com" className="text-primary"> saadabdullah07bd@gmail.com</a>.
      </p>

      <h2 className="mt-6 text-xl font-bold">Contact</h2>
      <p>saadabdullah07bd@gmail.com</p>
    </article>
  );
}
