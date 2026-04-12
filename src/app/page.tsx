import { redirect } from "next/navigation";

import { getOptionalViewer } from "@/lib/auth";

export default async function HomePage() {
  const viewer = await getOptionalViewer();
  redirect(viewer ? "/dashboard" : "/login");
}
