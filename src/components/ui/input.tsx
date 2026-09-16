import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          /*
           * 44 px au doigt, resserré dès `sm`. Et `text-base` conservé sous
           * `md` : en dessous de 16 px, iOS zoome tout seul au moment du
           * focus et l'écran se décale sous les doigts.
           *
           * L'anneau de focus fait 2 px et se décolle du champ : à 1 px et
           * collé, il se confond avec la bordure et on ne sait plus où on
           * est au clavier.
           */
          "flex h-11 w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-carte transition-colors duration-normal file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:h-9 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
