// src/components/IMS/ComponentCard.tsx
import { getStockStatus } from "@/hooks/useStockStatus";
import { useTheme } from "@/src/contexts/theme-context";
import { AlertTriangle, Edit2, Trash2, Warehouse } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ComponentCardProps {
  component: Component;
  onEdit: (c: Component) => void;
  onDelete: (id: string, name: string) => void;
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();
  const C = theme.colors;
  const status = getStockStatus(component.currentStock, component.minimumStock);
  const config = {
    ok: { bg: "#0f2e1e", color: C.success, label: "OK" },
    low: { bg: "#2e1f00", color: C.warning, label: "LOW" },
    out: { bg: "#200a0a", color: "#f87171", label: "OUT" },
  };
  const { bg, color, label } = config[status];

  return (
    <View
      style={[
        styles.compCard,
        { backgroundColor: C.background, borderColor: C.border },
      ]}
    >
      <Text style={[styles.compId, { color: C.accent }]}>
        {component.componentId}
      </Text>
      <Text style={[styles.compName, { color: C.text }]}>
        {component.componentName ?? "Unnamed Component"}
      </Text>
      {!!component.description && (
        <Text
          style={[styles.compDesc, { color: C.textMuted }]}
          numberOfLines={2}
        >
          {component.description}
        </Text>
      )}
      <View style={styles.compMeta}>
        <View
          style={[
            styles.stockPill,
            { backgroundColor: bg, borderColor: color + "40" },
          ]}
        >
          <Warehouse size={10} color={color} />
          <Text style={[styles.stockPillText, { color }]}>
            {component.currentStock} / {component.minimumStock} {label}
          </Text>
        </View>
        {!!component.primarySupplier && (
          <View
            style={[
              styles.supplierChip,
              { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <Text style={[styles.supplierText, { color: C.textMuted }]}>
              {component.primarySupplier}
            </Text>
          </View>
        )}
      </View>
      {!!component.notes && (
        <View style={styles.notesRow}>
          <AlertTriangle size={11} color={C.warning} />
          <Text style={[styles.notesText, { color: C.warning }]}>
            {component.notes}
          </Text>
        </View>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.btnEdit, { borderColor: C.border }]}
          onPress={() => onEdit(component)}
        >
          <Edit2 size={11} color={C.textMuted} />
          <Text style={[styles.btnEditText, { color: C.textMuted }]}>EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnDeleteSmall}
          onPress={() =>
            onDelete(
              component.id,
              component.componentName ?? component.componentId,
            )
          }
        >
          <Trash2 size={11} color="#f87171" />
          <Text style={styles.btnDeleteSmallText}>DELETE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  compCard: { borderRadius: 12, borderWidth: 1, padding: 13, marginBottom: 8 },
  compId: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  compName: { fontSize: 14, fontWeight: "700" },
  compDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  compMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stockPillText: { fontSize: 11, fontWeight: "700" },
  supplierChip: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  supplierText: { fontSize: 11 },
  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    padding: 7,
    backgroundColor: "#1a1200",
    borderRadius: 6,
  },
  notesText: { fontSize: 11, flex: 1, lineHeight: 16 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnEditText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  btnDeleteSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#3d0a0a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnDeleteSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#f87171",
    letterSpacing: 0.5,
  },
});

export default ComponentCard;
