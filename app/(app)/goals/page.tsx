import { redirect } from "next/navigation";

// Goals moved onto the dashboard (D-088): setting a target and marking it done
// now happen on the same surface as the assignment the target is chased
// through, and the completed-goal record lives under Progress > Milestones.
// This route survives only so old links, bookmarks and muscle memory land
// somewhere true instead of on a 404. The server actions stay in ./actions.ts,
// which the dashboard's goals board imports directly.
export default function Goals() {
  redirect("/dashboard#goals");
}
