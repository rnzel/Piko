import { Colors } from "@/constants/theme";
import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerActions: { flexDirection: "row", alignItems: "center", right: 20 },
  filterContainer: { marginBottom: 20, paddingHorizontal: 20 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  filterTabActiveOngoing: {
    backgroundColor: Colors.light.tintLight,
    borderColor: Colors.light.tint,
  },
  filterTabActiveCompleted: {
    backgroundColor: Colors.light.tintLight,
    borderColor: Colors.light.tint,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.textSecondary,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  filterTabTextActive: { color: Colors.light.tint },
  folderDropdown: {
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  folderDropdownText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
    maxWidth: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  taskList: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    paddingTop: 12,
  },
  taskListContent: { paddingBottom: 144 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textTertiary,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 12,
    textAlign: "center",
  },
  selectedCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  floatingAddButton: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
});

export default styles;
