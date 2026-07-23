import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cliente")({
  component: ClienteLayout,
});

function ClienteLayout() {
  return <Outlet />;
}