import { notFound } from "next/navigation";
import { AdminConsole } from "@/src/components/admin/admin-console";
import { adminPath, isAdminPath } from "@/src/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function InternalAdminPage({ params }: { params: Promise<{ accessKey: string }> }) {
  const { accessKey } = await params;
  if (!adminPath() || !isAdminPath(accessKey)) notFound();
  return <AdminConsole accessKey={accessKey} />;
}
