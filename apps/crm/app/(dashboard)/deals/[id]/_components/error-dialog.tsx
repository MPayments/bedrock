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
  variant?: "default" | "destructive";
};

export function ErrorDialog({
  open,
  title,
  message,
  onOpenChange,
  variant = "default",
}: ErrorDialogProps) {
  const isDestructive = variant === "destructive";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          isDestructive &&
            "border-destructive/50 dark:border-destructive/40",
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(isDestructive && "text-destructive")}
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(
              isDestructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
            )}
          >
            Понятно
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
