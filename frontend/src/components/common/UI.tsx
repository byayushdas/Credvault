/* eslint-disable react/only-export-components -- Form feedback hook is colocated with its presentation helpers. */
import { useState, useRef, useEffect, useId, cloneElement } from "react";
import type { ReactNode, ReactElement, FormEvent } from "react";
import { label } from "../../services/api";
import { useSession } from "../../services/session";

export function Status({ value }: { value: string }) {
  return (
    <span className={"badge status-" + value.toLowerCase()}>
      {label(value === "PARTIAL" ? "Partially approved" : value)}
    </span>
  );
}
export function DateText({ value }: { value?: string | null }) {
  const { user } = useSession();
  return (
    <time dateTime={value || undefined}>
      {value
        ? new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: user?.timezone || "Asia/Kolkata",
          }).format(new Date(value))
        : "—"}
    </time>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return message ? (
    <div className="error" role="alert">
      {message}
      {retry && (
        <button onClick={retry} className="secondary">
          Retry
        </button>
      )}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <p role="status" className="muted">
      Loading workspace…
    </p>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function PageHead({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{caption}</label>
      {cloneElement(
        children as ReactElement<{ id?: string; "aria-describedby"?: string }>,
        { id, "aria-describedby": hint ? id + "-hint" : undefined },
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="secondary"
          onClick={onClose}
          aria-label="Close dialog"
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function useAction() {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const guard = useRef(false);
  async function run(fn: () => Promise<unknown>, success = "Changes saved.") {
    if (guard.current) return false;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      refresh();
      return false;
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    run,
    feedback: (
      <>
        <ErrorBox message={error} />
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
      </>
    ),
  };
}
export function Form({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
export function pageRows<T>(rows: T[], page: number, size = 10) {
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  return rows.slice((current - 1) * size, current * size);
}
export function Pager({
  page,
  total,
  setPage,
  size = 10,
}: {
  page: number;
  total: number;
  setPage: (n: number) => void;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  return (
    <div className="pagination">
      <span>
        {total} records · Page {current} of {pages}
      </span>
      <div className="actions">
        <button
          className="secondary"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </button>
        <button
          className="secondary"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
