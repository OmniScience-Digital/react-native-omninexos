// app/admin.tsx  (or wherever your file-based router resolves it)
import { AdminPhotoRequests } from "@/components/admin/AdminPhotoRequests";
import { NonTabScreen } from "@/components/screens/non-tab-screen";
import { ThemedText } from "@/components/screens/screen";
import { CustomScrollView } from "@/components/ui/scrollView";
import { useAuth } from "@/src/contexts/auth-context";
import { useTheme } from "@/src/contexts/theme-context";
import { router } from "expo-router";
import { ImageIcon, Settings, ShieldAlert, Users } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

const IShieldAlert = ShieldAlert as any;
const IUsers = Users as any;
const IImageIcon = ImageIcon as any;
const ISettings = Settings as any;

/** Small accent chip shown next to section headers */
const SectionChip = ({ label, color }: { label: string; color: string }) => (
  <View
    style={[
      styles.chip,
      { borderColor: color + "40", backgroundColor: color + "15" },
    ]}
  >
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

/** Reusable admin section wrapper */
const AdminSection = ({
  title,
  chip,
  icon: Icon,
  children,
  theme,
}: {
  title: string;
  chip?: string;
  icon: any;
  children: React.ReactNode;
  theme: any;
}) => {
  const C = theme.colors;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIconWrap,
            { backgroundColor: C.glass, borderColor: C.border },
          ]}
        >
          <Icon size={16} color={C.accent} />
        </View>
        <Text style={[styles.sectionTitle, { color: C.text }]}>{title}</Text>
        {chip && <SectionChip label={chip} color={C.accent} />}
      </View>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

export default function AdminScreen() {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const C = theme.colors;

  // Guard: non-admins shouldn't reach this screen
  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <NonTabScreen
      title="Admin Panel"
      subtitle="Manage your application"
      showBack
      scrollable
    >
      <CustomScrollView>
        {/* Identity banner */}
        <View
          style={[
            styles.banner,
            { backgroundColor: C.card, borderColor: C.accent + "30" },
          ]}
        >
          <View
            style={[
              styles.bannerIcon,
              {
                backgroundColor: C.accent + "20",
                borderColor: C.accent + "40",
              },
            ]}
          >
            <IShieldAlert size={22} color={C.accent} />
          </View>
          <View style={styles.bannerText}>
            <ThemedText weight="700">Administrator Access</ThemedText>
            <ThemedText muted variant="small">
              Signed in as {user?.email}
            </ThemedText>
          </View>
        </View>

        {/* Photo Requests */}
        <AdminSection
          title="Photo Requests"
          chip="REVIEW"
          icon={IImageIcon}
          theme={theme}
        >
          <AdminPhotoRequests reviewerEmail={user?.email ?? "admin"} />
        </AdminSection>

        {/* Placeholder sections — wire up as you grow */}
        <AdminSection
          title="Users"
          chip="COMING SOON"
          icon={IUsers}
          theme={theme}
        >
          <Text style={[styles.placeholder, { color: C.textMuted }]}>
            User management will appear here.
          </Text>
        </AdminSection>

        <AdminSection title="App Settings" icon={ISettings} theme={theme}>
          <Text style={[styles.placeholder, { color: C.textMuted }]}>
            Global configuration options will appear here.
          </Text>
        </AdminSection>

        <View style={{ height: 40 }} />
      </CustomScrollView>
    </NonTabScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { flex: 1 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    flex: 1,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  placeholder: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 20,
  },
});
