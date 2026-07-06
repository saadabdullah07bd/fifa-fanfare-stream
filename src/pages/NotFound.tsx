import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="display text-7xl text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">Off the pitch. This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Back to the tournament
        </Link>
      </div>
    </div>
  );
}
