import { metadataPublica } from "@/lib/seo";

export const metadata = metadataPublica(
  "Directorio · TardeosClub",
  "Locales, promotores y DJs de los tardeos de la costa catalana.",
  "/directorio"
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
