import { redirect } from "next/navigation"

// Rebuilt as /admin/accounts (SPEC-admin-revamp Phase 1). Kept so an old link lands.
export default function AdminUsersPage() {
  redirect("/admin/accounts")
}
