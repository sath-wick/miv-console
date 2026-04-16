import type { PropsWithChildren, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="glass w-full border-[rgba(255,230,210,0.08)] bg-[rgba(255,230,210,0.06)] backdrop-blur-md">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="space-y-3">{children}</div>
        {footer ? <div className="mt-4 flex gap-2">{footer}</div> : null}
      </Card>
    </div>
  );
}
