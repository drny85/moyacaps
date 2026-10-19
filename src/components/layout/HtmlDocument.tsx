import { Anton, Inter, Space_Grotesk } from "next/font/google";

// Fonts load with display: swap. Only the poster face (hero / page headlines) is
// preloaded; body and UI text paint in the metric-matched fallback first, so the other
// two files never compete with the LCP image for bandwidth.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

// Condensed poster face — homepage headlines only
const anton = Anton({
  subsets: ["latin"],
  variable: "--font-poster",
  weight: "400",
  preload: true,
});

/**
 * The <html> document. Rendered by the [locale] layout (and the root 404) rather than the
 * root layout so `lang` comes from the route param: /es pages declare Spanish while every
 * storefront route still prerenders (ADR 0020; reading the locale from request headers
 * would make them dynamic).
 */
export function HtmlDocument({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className="light scroll-smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('moyacaps-storage');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed.state && parsed.state.theme === 'dark') {
                      document.documentElement.classList.remove('light');
                      document.documentElement.classList.add('dark');
                      document.documentElement.style.colorScheme = 'dark';
                      return;
                    }
                  }
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.colorScheme = 'light';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${anton.variable} font-sans bg-background text-foreground antialiased min-h-screen selection:bg-moya-red selection:text-white transition-colors duration-300`}>
        {children}
      </body>
    </html>
  );
}
