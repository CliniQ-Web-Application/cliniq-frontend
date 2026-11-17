import type { ReactNode } from "react";

export default function PageHeader({
  title,
  description,
  action,
  align = "left",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <header
      className={`mb-8 mt-8 flex flex-col gap-4 ${
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between"
      }`}
    >
      <div>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-neutral-600">{description}</p>
      </div>
      {action}
    </header>
  );
}
