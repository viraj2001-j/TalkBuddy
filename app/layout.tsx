import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://talkbuddy.app"),
  title: "TalkBuddy - Anonymous Social Chat & VIP Rewards",
  description:
    "Anonymous matching system via Telegram with point earning, VIP perks, priority matching, and admin dashboard",
  icons: {
    icon: "/talkbuddy-dp.jpg",
    apple: "/talkbuddy-dp.jpg",
  },
  openGraph: {
    title: "TalkBuddy - Anonymous Social Chat",
    description: "Connect anonymously, chat freely, earn points, and unlock VIP perks.",
    images: ["/talkbuddy-dp.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
