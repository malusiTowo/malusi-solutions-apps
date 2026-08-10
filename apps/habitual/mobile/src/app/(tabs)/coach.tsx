import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

interface Message {
  id: string;
  from: "coach" | "user";
  text: string;
}

const SEED: Message[] = [
  {
    id: "1",
    from: "coach",
    text: "Morning Alex 👋 You're 3 days from beating your best run streak. Want to lock it in?",
  },
  { id: "2", from: "user", text: "Yes, remind me at 3pm ⚡" },
  {
    id: "3",
    from: "coach",
    text: "Done ✅ I'll nudge you at 3. Based on your week, try shifting reading to mornings — that's when you finish 40% more often.",
  },
];

export default function Coach() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    // Skeleton: echo locally. Real coach calls the @repo/ai engine via GraphQL.
    setMessages((prev) => [
      ...prev,
      { id: `${prev.length + 1}`, from: "user", text },
      {
        id: `${prev.length + 2}`,
        from: "coach",
        text: "Got it — I'll factor that into your plan.",
      },
    ]);
    setDraft("");
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>AI Coach</Text>
          <Text style={styles.subtitle}>analyzing your habits</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bubble, m.from === "user" ? styles.bubbleUser : styles.bubbleCoach]}
          >
            <Text style={m.from === "user" ? styles.textUser : styles.textCoach}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask your coach…"
          placeholderTextColor="#6B6B70"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={send}>
          <Text style={styles.sendLabel}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top + theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  back: { color: theme.colors.text, fontSize: theme.fontSize["3xl"] },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
  },
  subtitle: { color: theme.colors.accent, fontSize: theme.fontSize.xs },
  messages: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
  },
  bubbleCoach: { backgroundColor: theme.colors.surface, alignSelf: "flex-start" },
  bubbleUser: { backgroundColor: theme.colors.accent, alignSelf: "flex-end" },
  textCoach: { color: theme.colors.text, fontSize: theme.fontSize.sm, lineHeight: 20 },
  textUser: { color: theme.colors.onAccent, fontSize: theme.fontSize.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: rt.insets.bottom + theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendLabel: {
    color: theme.colors.onAccent,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
  },
}));
