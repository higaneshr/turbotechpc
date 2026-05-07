import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectDialog({
  open, onOpenChange, title = "Reject", onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Explanation (shared with the customer)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={400}
            placeholder="e.g. Out of service area, technician unavailable, hardware issue not covered…" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || busy}
            onClick={async () => { setBusy(true); try { await onConfirm(reason.trim()); onOpenChange(false); setReason(""); } finally { setBusy(false); } }}>
            {busy ? "Saving…" : "Confirm reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
