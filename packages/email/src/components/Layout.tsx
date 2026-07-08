import { Body, Container, Head, Html, Preview, Section } from "@react-email/components";
import type { ReactNode } from "react";

export interface EmailLayoutProps {
  readonly preview: string;
  readonly children: ReactNode;
}

const styles = {
  body: { backgroundColor: "#0A0A0A", color: "#FFFFFF", fontFamily: "sans-serif", margin: 0 },
  container: {
    backgroundColor: "#141414",
    borderRadius: "16px",
    margin: "40px auto",
    maxWidth: "480px",
    padding: "32px",
  },
  section: { color: "#A1A1AA", fontSize: "16px", lineHeight: "24px" },
} as const;

/** Base branded email shell. Products compose their templates inside it. */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}
