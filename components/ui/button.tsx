import { cn } from "@/lib/utils";
import { Link } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, Text } from "react-native";

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  children: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function ButtonLink({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} asChild>
      <Pressable
        className={cn(
          "px-6 py-3 rounded-lg",
          variant === "primary" && "bg-primary",
          variant === "secondary" && "bg-secondary",
          className,
        )}
      >
        <Text className="text-white text-center font-semibold">{children}</Text>
      </Pressable>
    </Link>
  );
}
