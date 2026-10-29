import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/15 text-cyan",
      secondary: "border-border bg-secondary text-secondary-foreground",
      outline: "border-border text-muted-foreground",
      success: "border-success/30 bg-success/10 text-success",
      warning: "border-amber/30 bg-amber/10 text-amber",
      danger: "border-danger/30 bg-danger/10 text-danger",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
