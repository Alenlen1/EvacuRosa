import { redirect } from "next/navigation";

/** Keep old bookmarks working; each signed-in account opens its own workspace. */
export default function BarangayPage() {
  redirect("/admin/dashboard");
}
