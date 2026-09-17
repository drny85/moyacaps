import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Moya Caps | 0880 Good Luck Signature Streetwear Caps",
  description: "Official store for Moya Caps. Heavyweight 3D puff embroidery, iconic horseshoe-clover emblem, and devil pitchfork flanks in 16 exclusive colorways.",
  icons: {
    icon: "/caps/negro-rojo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans bg-[#06060a] text-zinc-100 antialiased min-h-screen selection:bg-moya-red selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
