"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50/50 to-white p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Heart icon with error state */}
            <div className="relative inline-flex">
              <div className="size-20 rounded-full bg-red-50 flex items-center justify-center">
                <svg
                  className="size-10 text-red-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 9v4m0 0v4m0-4h4m-4 0H8" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Something went wrong
              </h1>
              <p className="text-gray-500">
                We encountered an unexpected error. Please try again.
              </p>
            </div>
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Try again
            </button>
            <p className="text-xs text-gray-400">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}