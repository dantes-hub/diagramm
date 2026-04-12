export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-8 py-10 text-center shadow-sm">
        <p className="text-sm font-medium text-[var(--muted)]">404</p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--ink)]">Page not found</h1>
      </div>
    </main>
  );
}
