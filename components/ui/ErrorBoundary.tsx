// components/ui/ErrorBoundary.tsx
//
// Catches render crashes anywhere below it so one broken screen shows a
// recoverable fallback instead of taking the whole app down. Sits OUTSIDE
// the theme/auth providers, so it uses plain colours and no context hooks.
import { captureException } from "@/src/monitoring/sentry";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    captureException(error, { componentStack: info.componentStack });
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected problem. Your saved data is safe. Try again,
          and if it keeps happening, restart the app.
        </Text>
        {__DEV__ ? (
          <Text style={styles.debug}>{this.state.error.message}</Text>
        ) : null}
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0D0D0D",
  },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  body: {
    color: "#B5B5B5",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  debug: { color: "#FF8A80", fontSize: 12, marginBottom: 16 },
  button: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: { color: "#0D0D0D", fontWeight: "600" },
});
