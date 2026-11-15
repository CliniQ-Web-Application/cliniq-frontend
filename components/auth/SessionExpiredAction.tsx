import Link from "next/link";

export default function SessionExpiredAction({ message, returnTo }: { message: string; returnTo: string }) {
  if (!/session (?:has )?expired/i.test(message)) return null;
  const redirect = encodeURIComponent(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/patient");
  return <Link href={`/auth/signin?redirect=${redirect}&reason=session_expired`} className="ml-2 inline-flex min-h-10 items-center font-semibold underline underline-offset-2">Sign in again</Link>;
}
