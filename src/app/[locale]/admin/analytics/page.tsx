import { redirect } from "next/navigation";

/** Analytics became Home (plan 0009 D7); old links still land somewhere useful. */
export default async function AdminAnalyticsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin`);
}
