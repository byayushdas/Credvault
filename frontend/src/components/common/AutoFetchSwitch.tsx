import { useId } from "react";
import { api } from "../../services/api";
import type { Doc } from "../../services/api";
import { useAction } from "./UI";

export default function AutoFetchSwitch({
  document,
  refreshing = false,
}: {
  document: Doc;
  refreshing?: boolean;
}) {
  const action = useAction();
  const hintId = useId();
  return (
    <div className="auto-fetch-control">
      <button
        type="button"
        role="switch"
        aria-checked={document.auto_fetch}
        aria-label={"Auto fetch for " + document.title}
        aria-describedby={hintId}
        className="auto-fetch-switch"
        disabled={action.busy || refreshing}
        onClick={() =>
          void action.run(
            () =>
              api("/documents/" + document.id + "/auto-fetch", "PATCH", {
                auto_fetch: !document.auto_fetch,
              }),
            "",
          )
        }
      >
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span>
          {action.busy ? "Saving…" : document.auto_fetch ? "On" : "Off"}
        </span>
      </button>
      <small id={hintId}>
        {document.auto_fetch
          ? "No approval needed"
          : "Manual approval required"}
      </small>
      {action.feedback}
    </div>
  );
}
