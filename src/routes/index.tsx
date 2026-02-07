import { createFileRoute } from "@tanstack/react-router";
import { FontSnatcherPage } from "@/features/font-snatcher/font-snatcher-page";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return <FontSnatcherPage />;
}
