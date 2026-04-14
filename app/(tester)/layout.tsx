import { MainNavbar } from "@/components/MainNavbar";

export default function TesterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <MainNavbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
