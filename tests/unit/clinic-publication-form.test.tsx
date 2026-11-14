import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicationManager } from "@/features/clinic-showcase/publication-manager";
import { preparePublication } from "@/features/clinic-showcase/actions";
vi.mock("@/features/clinic-showcase/actions", () => ({
  preparePublication: vi.fn(),
  setResultPublished: vi.fn(),
}));
afterEach(cleanup);
it("submits a private draft only after the administrator confirms public permission", async () => {
  const user = userEvent.setup();
  const id = "03c8f330-1038-4209-815e-c650ea3992f4";
  vi.mocked(preparePublication).mockResolvedValue({
    ok: true,
    message: "Draft prepared.",
  });
  render(
    <PublicationManager
      canEdit
      results={[]}
      sources={[
        {
          id,
          title: "Synthetic comparison",
          category: "Demo",
          procedure: "Photography",
          bodyArea: "Face",
        },
      ]}
    />,
  );
  await user.click(screen.getByText("Prepare a public result"));
  await user.selectOptions(
    screen.getByLabelText("Private clinic comparison"),
    id,
  );
  await user.type(
    screen.getByLabelText("Public result title"),
    "Synthetic example",
  );
  await user.type(
    screen.getByLabelText("Public description"),
    "An entirely synthetic demonstration of the photography workflow.",
  );
  await user.type(
    screen.getByLabelText("Public marketing permission reference (private)"),
    "SYNTHETIC-EXAMPLE",
  );
  await user.click(
    screen.getByRole("button", { name: "Prepare private draft" }),
  );
  expect(preparePublication).not.toHaveBeenCalled();
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Prepare private draft" }),
  );
  expect(await screen.findByText("Draft prepared.")).toBeVisible();
  expect(preparePublication).toHaveBeenCalledWith(
    expect.objectContaining({
      comparisonId: id,
      confirmPermission: true,
      category: "Demo",
    }),
  );
});
