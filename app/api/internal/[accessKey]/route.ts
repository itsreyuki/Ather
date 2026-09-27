import { NextResponse } from "next/server";
import { createAdminSession, hasAdminSession, isAdminPath, isAdminSecret, requireAdminSession, revokeAdminSession } from "@/src/lib/admin-access";
import { createLicenseCodes, getAdminOverview, revokeLicenseCode } from "@/src/lib/admin-service";

async function checkPath(params: Promise<{ accessKey: string }>) {
  const { accessKey } = await params;
  return isAdminPath(accessKey) ? accessKey : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ accessKey: string }> }) {
  if (!(await checkPath(params))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await hasAdminSession())) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, ...(await getAdminOverview()) });
}

export async function POST(request: Request, { params }: { params: Promise<{ accessKey: string }> }) {
  if (!(await checkPath(params))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { action?: string; secret?: string; quantity?: number; label?: string } | null;
  if (body?.action === "login") {
    if (!body.secret || !isAdminSecret(body.secret)) return NextResponse.json({ error: "الرمز السري غير صحيح" }, { status: 401 });
    await createAdminSession();
    return NextResponse.json({ authenticated: true });
  }
  try {
    await requireAdminSession();
    if (body?.action !== "create-license") return NextResponse.json({ error: "الإجراء غير معروف" }, { status: 400 });
    const items = await createLicenseCodes(body.quantity ?? 1, body.label);
    return NextResponse.json({ items }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHENTICATED") return NextResponse.json({ error: "انتهت جلسة لوحة الإدارة" }, { status: 401 });
    if (error instanceof Error && error.message === "LICENSE_CAPACITY_REACHED") return NextResponse.json({ error: "لا توجد مقاعد إطلاق متبقية لإنشاء أكواد جديدة" }, { status: 409 });
    return NextResponse.json({ error: "تعذر تنفيذ الإجراء" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ accessKey: string }> }) {
  if (!(await checkPath(params))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await requireAdminSession();
    const body = await request.json().catch(() => null) as { id?: string } | null;
    if (!body?.id) return NextResponse.json({ error: "الكود غير محدد" }, { status: 400 });
    await revokeLicenseCode(body.id);
    return NextResponse.json(await getAdminOverview());
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_UNAUTHENTICATED") return NextResponse.json({ error: "انتهت جلسة لوحة الإدارة" }, { status: 401 });
    return NextResponse.json({ error: "تعذر إلغاء الكود" }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ accessKey: string }> }) {
  if (!(await checkPath(params))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await revokeAdminSession();
  return NextResponse.json({ authenticated: false });
}
