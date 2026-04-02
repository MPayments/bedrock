import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ErrorDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onOpenChange: (open: boolean) => void;
  variant?: "destructive" | "warning";
};

export function ErrorDialog({
  open,
  title,
  message,
  onOpenChange,
  variant = "destructive",
}: ErrorDialogProps) {
  const isWarning = variant === "warning";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          isWarning &&
            "border-amber-200 bg-amber-50/95 dark:border-amber-900/70 dark:bg-amber-950/30",
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(isWarning && "text-amber-900 dark:text-amber-100")}
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(
              isWarning &&
                "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500 dark:bg-amber-500 dark:text-black dark:hover:bg-amber-400",
            )}
          >
            Понятно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
