import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-obsidian flex text-chalk">
      <TopNav />
      <Sidebar />
      <main className="flex-1 pl-[240px] pt-[56px] min-h-screen w-full">
        {children}
      </main>
    </div>
  );
}

