import { redirect } from "next/navigation"

// Merged into /admin/content (SPEC-admin-revamp Phase 5). Kept so an old link lands.
export default function AdminMissionsPage() {
  redirect("/admin/content?tab=cases")
}
