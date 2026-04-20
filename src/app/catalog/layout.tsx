import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/productos",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
