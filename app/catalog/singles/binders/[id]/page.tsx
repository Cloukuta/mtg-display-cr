import { redirect } from "next/navigation";

export default async function LegacyBinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/catalog/binders/${id}`);
}
