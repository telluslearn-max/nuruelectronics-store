export function FeedbackBanner({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div
      className={`mt-4 rounded-card border px-4 py-3 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      {error ?? success}
    </div>
  );
}
