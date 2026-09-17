import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08080a] text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-6xl font-black text-red-500 mb-2">404</h1>
      <h2 className="text-xl font-bold mb-4">Drop Not Found</h2>
      <p className="text-zinc-400 text-sm mb-6">The cap or page you are looking for has been moved or doesn&apos;t exist.</p>
      <Link
        href="/en"
        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider"
      >
        Return to Store
      </Link>
    </div>
  );
}
