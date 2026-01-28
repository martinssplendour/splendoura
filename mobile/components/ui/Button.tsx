import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle;
}

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  xs: { paddingHorizontal: 6, paddingVertical: 4 },
  sm: { paddingHorizontal: 12, paddingVertical: 8 },
  md: { paddingHorizontal: 16, paddingVertical: 12 },
  lg: { paddingHorizontal: 20, paddingVertical: 14 },
};

const textSizes: Record<ButtonSize, number> = {
  xs: 11,
  sm: 15,
  md: 15,
  lg: 16,
};

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
  size = "md",
  style,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        styles[variant],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: textSizes[size] },
          variant === "primary" ? styles.textPrimary : styles.textOutline,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primary: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: "#2563eb",
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
  textPrimary: {
    color: "#ffffff",
  },
  textOutline: {
    color: "#2563eb",
  },
});
