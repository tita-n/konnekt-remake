"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal, VolumeX } from "lucide-react";
import { apiPost } from "@/lib/posts/client";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { BottomSheet, Dialog } from "@/components/ui/overlays";
import { REPORT_REASON_OPTIONS, type ReportReasonValue } from "@/lib/posts/report-reasons";
import { cn } from "@/lib/utils";

export function ProfileActionsMenu({
  username,
  fullName,
  latestPostId,
}: {
  username: string;
  fullName: string;
  latestPostId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonValue>("HARASSMENT");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function mute() {
    setBusy(true);
    try {
      const result = await apiPost<{ muted: boolean }>("/api/relationships", { action: "mute", username });
      setOpen(false);
      toast({ title: result.muted ? `Muted @${username}` : `Unmuted @${username}` });
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't update mute", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    try {
      await apiPost<{ blocked: boolean }>("/api/relationships", { action: "block", username });
      setBlockConfirm(false);
      toast({ title: `Blocked @${username}` });
      router.push("/pulse");
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't block user", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function submitProfileReport() {
    if (!latestPostId) {
      setReportOpen(false);
      toast({ title: "Report noted", description: "Use the menu on a specific post or comment to flag it directly for moderators." });
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/reports", {
        targetType: "POST",
        targetId: latestPostId,
        reason,
        details: details.trim() || undefined,
      });
      setReportOpen(false);
      setDetails("");
      toast({ title: "Report sent", description: "Moderators will review this account's activity." });
    } catch (err) {
      toast({ title: "Couldn't send report", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`More options for ${fullName}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label="Student actions"
            className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-[16px] border border-border bg-surface p-1.5 shadow-floating"
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void mute()}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-small font-medium text-fg hover:bg-surface-2"
            >
              <VolumeX aria-hidden="true" className="size-4 text-fg-muted" />
              Mute
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setBlockConfirm(true); }}
              className="my-0.5 flex w-full items-center gap-2.5 rounded-[10px] bg-danger-soft px-3 py-2.5 text-left text-small font-semibold text-danger hover:bg-danger-soft/80"
            >
              <Ban aria-hidden="true" className="size-4" />
              Block
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); setReportOpen(true); }}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-small font-medium text-fg hover:bg-surface-2"
            >
              <Flag aria-hidden="true" className="size-4 text-fg-muted" />
              Report
            </button>
          </div>
        </>
      ) : null}

      <Dialog
        open={blockConfirm}
        onClose={() => setBlockConfirm(false)}
        title={`Block @${username}?`}
        description="They won't be able to see your posts or interact with you, and their content won't appear in your feed."
        centered
        hideClose
        footer={
          <>
            <Button variant="destructive" fullWidth className="rounded-full" loading={busy} onClick={() => void block()}>
              Block
            </Button>
            <Button variant="secondary" fullWidth className="rounded-full" onClick={() => setBlockConfirm(false)}>
              Cancel
            </Button>
          </>
        }
      />

      <BottomSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report @${username}`}
        centeredTitle
      >
        <div className="space-y-2 pb-2">
          {REPORT_REASON_OPTIONS.map((option) => {
            const active = reason === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setReason(option.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left text-small font-medium",
                  active ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border bg-surface text-fg",
                )}
              >
                <span>{option.label}</span>
                <span className={cn("size-4 rounded-full border-2", active ? "border-accent bg-accent" : "border-border-strong")} />
              </button>
            );
          })}
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="Add extra context for moderators (optional)…"
            className="mt-2 w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
          />
          <Button fullWidth className="mt-2 rounded-full" loading={busy} onClick={() => void submitProfileReport()}>
            Submit report
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
