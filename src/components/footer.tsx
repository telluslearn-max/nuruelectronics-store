import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Store. All rights reserved.</p>
        <nav className="flex gap-6">
          <Link href="/" className="hover:text-foreground">
            Shop
          </Link>
          <a href="mailto:hello@example.com" className="hover:text-foreground">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
