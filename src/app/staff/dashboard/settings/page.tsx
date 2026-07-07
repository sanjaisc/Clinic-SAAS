import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/staff/dashboard/settings/profile");
}