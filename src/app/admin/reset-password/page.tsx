import { redirect } from "next/navigation";

export default function RetiredPasswordPage() {
  return redirect("/admin/login");
}
