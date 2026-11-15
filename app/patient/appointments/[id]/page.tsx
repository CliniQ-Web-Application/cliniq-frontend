import AppointmentDetail from "./appointment-detail";

export default async function AppointmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppointmentDetail appointmentId={id} />;
}
