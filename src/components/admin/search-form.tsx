export function SearchForm({ q }: { q?: string }) {
  return (
    <form method="GET" action="/admin/search" className="flex items-end gap-3">
      <div className="flex-1">
        <label className="block text-xs text-neutral-500">Search</label>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Customer, order, invoice, bill…"
          className="w-full rounded-control border border-border-subtle px-3 py-2 text-base outline-none focus:border-foreground sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
      >
        Search
      </button>
    </form>
  );
}
