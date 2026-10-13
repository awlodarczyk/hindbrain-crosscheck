/** Data settings page body: history actions plus the deleted sessions list. */
import { DataSection } from "./general-view";
import { DeletedList } from "./deleted-list";

export function DataView() {
  return (
    <>
      <DataSection />
      <DeletedList />
    </>
  );
}
