import { notFound } from "next/navigation";
import { ScreenPreviewClient } from "@/components/design/screen-preview-client";

export const metadata = { title: "Screen preview" };

export default async function DesignScreenPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await params;
  const query = await searchParams;
  const theme = query.theme === "dark" ? "dark" : "light";

  return <ScreenPreviewClient screen={screen} theme={theme} />;
}
