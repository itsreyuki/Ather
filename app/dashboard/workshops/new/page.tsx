import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/src/components/ui/page-header";
import { WorkshopTemplateStart } from "@/src/components/workshops/workshop-template-start";
import { WorkshopWizard } from "@/src/components/workshops/workshop-wizard";
import { DeleteWorkshopAction } from "@/src/components/workshops/delete-workshop-action";
import { requireDashboardContext } from "@/src/lib/dashboard-access";
import { db } from "@/src/lib/db";
import { Permission } from "@/src/lib/permissions";

type Query = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function inputDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 16) : "";
}

export default async function NewWorkshopPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const session = await requireDashboardContext({ permission: Permission.WorkshopsCreate });
  const query = searchParams ? await searchParams : {};
  const id = first(query.id);
  const templateId = first(query.templateId);
  const schoolId = session.membership!.schoolId;
  const [staff, draft, templates, selectedTemplate] = await Promise.all([
    db.staffMember.findMany({
      where: { schoolId, active: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        specialization: true,
        importSourceName: true,
        importSourceFileName: true,
        importFormat: true,
        importReviewRequired: true,
      },
    }),
    id
      ? db.workshop.findFirst({
          where: { id, schoolId, finalizedAt: null, deletedAt: null },
          include: {
            participants: { select: { id: true, staffId: true } },
            criteria: { orderBy: { displayOrder: "asc" } },
            assessments: {
              where: { phase: "PRE" },
              select: { participantId: true, criterionId: true, score: true },
            },
          },
        })
      : null,
    id
      ? Promise.resolve([])
      : db.workshopTemplate.findMany({
          where: { schoolId },
          orderBy: { updatedAt: "desc" },
          include: { criteria: { orderBy: { displayOrder: "asc" }, select: { id: true } } },
        }),
    !id && templateId
      ? db.workshopTemplate.findFirst({
          where: { id: templateId, schoolId },
          include: { criteria: { orderBy: { displayOrder: "asc" } } },
        })
      : null,
  ]);
  const initial = draft
    ? {
        id: draft.id,
        info: {
          title: draft.title === "مسودة ورشة" ? "" : draft.title,
          description: draft.description ?? "",
          facilitator: draft.facilitator ?? "",
          facilitatorStaffId: draft.facilitatorStaffId ?? "",
          providerOrganization: draft.providerOrganization ?? "",
          workshopType: draft.workshopType ?? "",
          programType: draft.programType ?? "",
          category: draft.category ?? "",
          deliveryMode: draft.deliveryMode,
          locationOrUrl: draft.locationOrUrl ?? "",
          startsAt: inputDate(draft.startsAt),
          endsAt: inputDate(draft.endsAt),
          objectives: draft.objectives ?? "",
          notes: draft.notes ?? "",
        },
        participantIds: draft.participants.map((item) => item.staffId),
        participantMap: Object.fromEntries(draft.participants.map((item) => [item.staffId, item.id])),
        criteria: draft.criteria.map((item) => ({
          id: item.id,
          clientKey: item.id,
          name: item.name,
          description: item.description ?? "",
          category: item.category ?? "",
          guidance: item.guidance ?? "",
          weight: item.weight,
          targetValue: item.targetValue,
        })),
        scores: Object.fromEntries(
          draft.assessments.map((item) => [`${item.participantId}:${item.criterionId}`, item.score]),
        ),
        draftStep: draft.draftStep,
      }
    : selectedTemplate
      ? {
          info: {
            title: selectedTemplate.name,
            description: selectedTemplate.description ?? "",
            facilitator: "",
            facilitatorStaffId: "",
            providerOrganization: "",
            workshopType: selectedTemplate.workshopType ?? "",
            programType: "",
            category: selectedTemplate.category ?? "",
            deliveryMode: selectedTemplate.deliveryMode,
            locationOrUrl: "",
            startsAt: "",
            endsAt: "",
            objectives: selectedTemplate.objectives ?? "",
            notes: "",
          },
          participantIds: [],
          criteria: selectedTemplate.criteria.map((item) => ({
            clientKey: item.id,
            name: item.name,
            description: item.description ?? "",
            category: item.category ?? "",
            guidance: item.guidance ?? "",
            weight: item.weight,
            targetValue: item.targetValue,
          })),
          scores: {},
          draftStep: 0,
        }
      : undefined;
  return (
    <>
      <PageHeader
        eyebrow="قياس ورشة جديدة"
        title="إعداد ورشة"
        description="أكمل الخطوات، وسيتم حفظ المسودة تلقائيًا حتى وقت الاعتماد."
        action={
          <Link className="button button-secondary" href="/dashboard/workshops">
            <ArrowRight size={15} /> العودة للورش
          </Link>
        }
      />
      {!id && <WorkshopTemplateStart templates={templates} />}
      {draft && (
        <div className="draft-actions">
          <DeleteWorkshopAction workshopId={draft.id} />
        </div>
      )}
      <WorkshopWizard staff={staff} initial={initial} />
    </>
  );
}
