import { NextResponse } from "next/server";
import { registerSchema } from "@/src/lib/auth-schemas";
import { registerManagerAccount } from "@/src/lib/registration-service";
import { apiErrorResponse } from "@/src/lib/api-errors";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "بيانات التسجيل غير صالحة", details: parsed.error.flatten() }, { status: 400 });
  try {
    await registerManagerAccount(parsed.data);
    return NextResponse.json({ nextPath: "/onboarding" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CONTACT_ALREADY_USED") return NextResponse.json({ error: "بيانات التواصل مستخدمة بالفعل" }, { status: 409 });
    return apiErrorResponse(error, request, "تعذر إنشاء الحساب. حاول مرة أخرى.");
  }
}
