import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Reglas de uso de URBIS sobre publicaciones, responsabilidades, contenidos prohibidos y marco legal aplicable.",
  alternates: {
    canonical: "/terminos-y-condiciones",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
