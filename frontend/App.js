import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { buildBiltyHtml } from "./bilty";
import { BiltyView } from "./BiltyView";
import { API_BASE_URL } from "./config";
import { printBilty } from "./printBilty";
import { useRecorder } from "./recorder";

const PAYMENT_STYLES = {
  ToPay: { bg: "#FEE2E2", fg: "#DC2626" },
  Paid: { bg: "#DCFCE7", fg: "#16A34A" },
  FOC: { bg: "#EDE9FE", fg: "#7C3AED" },
  ToBeBilled: { bg: "#FFEDD5", fg: "#EA580C" },
};

const PAYMENT_TYPES = ["ToPay", "Paid", "FOC", "ToBeBilled"];

const EMPTY_DRAFT = {
  consignor_name: "",
  consignee_name: "",
  from_station: "",
  to_station: "",
  pkg_no: "",
  pkg_type: "",
  weight: "",
  payment_type: "ToPay",
};

// --------------------------------------------------------------------------- //
// Reusable field
// --------------------------------------------------------------------------- //

function Field({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "words"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

// --------------------------------------------------------------------------- //
// Draft review form (appears after a voice entry is parsed)
// --------------------------------------------------------------------------- //

function DraftForm({ draft, setDraft, onSave, onDiscard }) {
  const set = (key) => (val) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Review Entry</Text>
        <Text style={styles.formHint}>Check the details, then save</Text>
      </View>

      <Field
        label="Consignor"
        value={draft.consignor_name}
        onChangeText={set("consignor_name")}
        placeholder="Sender company"
      />
      <Field
        label="Consignee"
        value={draft.consignee_name}
        onChangeText={set("consignee_name")}
        placeholder="Receiver company"
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Field
            label="From"
            value={draft.from_station}
            onChangeText={set("from_station")}
            placeholder="Origin"
          />
        </View>
        <View style={styles.rowItem}>
          <Field
            label="To"
            value={draft.to_station}
            onChangeText={set("to_station")}
            placeholder="Destination"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Field
            label="Packages"
            value={String(draft.pkg_no ?? "")}
            onChangeText={set("pkg_no")}
            placeholder="0"
            keyboardType="number-pad"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.rowItem}>
          <Field
            label="Type"
            value={draft.pkg_type}
            onChangeText={set("pkg_type")}
            placeholder="Carton / Bag"
          />
        </View>
      </View>

      <Field
        label="Weight (kg)"
        value={String(draft.weight ?? "")}
        onChangeText={set("weight")}
        placeholder="0.0"
        keyboardType="decimal-pad"
        autoCapitalize="none"
      />

      <Text style={styles.fieldLabel}>Payment</Text>
      <View style={styles.segment}>
        {PAYMENT_TYPES.map((pt) => {
          const active = draft.payment_type === pt;
          const c = PAYMENT_STYLES[pt];
          return (
            <Pressable
              key={pt}
              onPress={() => set("payment_type")(pt)}
              style={[
                styles.segmentItem,
                active && { backgroundColor: c.bg, borderColor: c.fg },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  active && { color: c.fg, fontWeight: "800" },
                ]}
              >
                {pt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.formActions}>
        <Pressable style={styles.discardBtn} onPress={onDiscard}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>Save Entry</Text>
        </Pressable>
      </View>
    </View>
  );
}

// --------------------------------------------------------------------------- //
// Bilty preview (renders the actual bilty HTML, then offers Share)
// --------------------------------------------------------------------------- //

function BiltyPreview({ entry, visible, onClose }) {
  const [sharing, setSharing] = useState(false);
  const html = entry ? buildBiltyHtml(entry) : "";

  const share = async () => {
    if (!entry) return;
    setSharing(true);
    try {
      await printBilty(entry);
    } catch (err) {
      console.error("Print failed", err);
      Alert.alert("Print failed", "Could not generate the bilty PDF.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.previewSafe}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewTitle}>Bilty Preview</Text>
            <Text style={styles.previewSub}>
              {entry ? `${entry.from_station || "—"} → ${entry.to_station || "—"}` : ""}
            </Text>
          </View>
          <Pressable style={styles.previewClose} onPress={onClose} hitSlop={10}>
            <Text style={styles.previewCloseText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.previewBody}>{entry ? <BiltyView html={html} /> : null}</View>

        <View style={styles.previewActions}>
          <Pressable
            style={[styles.shareBtn, sharing && styles.shareBtnBusy]}
            onPress={share}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.shareText}>Share / Print PDF</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// --------------------------------------------------------------------------- //
// Database modal — view and add consignors / consignees / places
// --------------------------------------------------------------------------- //

const DB_TABS = [
  { key: "consignors", label: "Consignors" },
  { key: "consignees", label: "Consignees" },
  { key: "places", label: "Places" },
];

function DatabaseModal({ visible, onClose }) {
  const [tab, setTab] = useState("consignors");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (kind) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/db/${kind}`);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("DB load failed", err);
      Alert.alert("Load failed", "Could not reach the database.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load whenever the modal opens or the tab changes.
  useEffect(() => {
    if (visible) load(tab);
  }, [visible, tab, load]);

  const add = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/db/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Server ${res.status}: ${detail}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setNewName("");
      if (!data.created) {
        Alert.alert("Already exists", `"${data.name}" is already in the list.`);
      }
    } catch (err) {
      console.error("DB add failed", err);
      Alert.alert("Add failed", String(err.message || err));
    } finally {
      setAdding(false);
    }
  }, [newName, tab]);

  const remove = useCallback(
    (name) => {
      Alert.alert("Delete entry", `Remove "${name}" from the list?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/db/${tab}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ name }),
              });
              if (!res.ok) {
                const detail = await res.text();
                throw new Error(`Server ${res.status}: ${detail}`);
              }
              const data = await res.json();
              setItems(data.items || []);
            } catch (err) {
              console.error("DB delete failed", err);
              Alert.alert("Delete failed", String(err.message || err));
            }
          },
        },
      ]);
    },
    [tab]
  );

  const activeLabel = DB_TABS.find((t) => t.key === tab)?.label || "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.previewSafe}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewTitle}>Database</Text>
            <Text style={styles.previewSub}>Manage reference lists</Text>
          </View>
          <Pressable style={styles.previewClose} onPress={onClose} hitSlop={10}>
            <Text style={styles.previewCloseText}>✕</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {DB_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tabItem, active && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Add row */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={setNewName}
            placeholder={`Add a ${activeLabel.replace(/s$/, "").toLowerCase()}…`}
            placeholderTextColor="#94A3B8"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <Pressable
            style={[styles.addBtn, (adding || !newName.trim()) && styles.addBtnDisabled]}
            onPress={add}
            disabled={adding || !newName.trim()}
          >
            {adding ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addBtnText}>Add</Text>
            )}
          </Pressable>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.dbLoading}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, i) => `${item}-${i}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.dbList}
            ListHeaderComponent={
              <Text style={styles.dbCount}>
                {items.length} {items.length === 1 ? "entry" : "entries"}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.dbRow}>
                <Text style={styles.dbName} numberOfLines={1}>
                  {item}
                </Text>
                <Pressable
                  style={styles.dbDelete}
                  onPress={() => remove(item)}
                  hitSlop={8}
                >
                  <Text style={styles.dbDeleteText}>✕</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.dbEmpty}>No entries yet. Add one above.</Text>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// --------------------------------------------------------------------------- //
// App
// --------------------------------------------------------------------------- //

export default function App() {
  const [entries, setEntries] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draft, setDraft] = useState(null); // null = no form shown
  const [preview, setPreview] = useState(null); // entry being previewed, or null
  const [dbOpen, setDbOpen] = useState(false);
  const recorder = useRecorder();

  const startRecording = useCallback(async () => {
    if (isProcessing) return;
    try {
      await recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Recording error", err.message || "Could not start recording.");
    }
  }, [isProcessing, recorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      const audio = await recorder.stop();
      if (audio) await uploadRecording(audio);
    } catch (err) {
      console.error("Failed to stop recording", err);
      Alert.alert("Recording error", "Could not process the recording.");
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, recorder]);

  // `audio` is a platform descriptor: {uri,name,type} on native, {file,name,type} on web.
  const uploadRecording = useCallback(async (audio) => {
    const form = new FormData();
    if (audio.file) {
      form.append("audio", audio.file, audio.name);
    } else {
      form.append("audio", { uri: audio.uri, name: audio.name, type: audio.type });
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/voice-entry`, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Server ${res.status}: ${detail}`);
      }
      const data = await res.json();
      // Populate the draft form with the extracted values (stringified for inputs).
      setDraft({
        ...EMPTY_DRAFT,
        ...data,
        pkg_no: data.pkg_no != null ? String(data.pkg_no) : "",
        weight: data.weight != null ? String(data.weight) : "",
        payment_type: PAYMENT_TYPES.includes(data.payment_type)
          ? data.payment_type
          : "ToPay",
      });
    } catch (err) {
      console.error("Upload failed", err);
      Alert.alert("Upload failed", String(err.message || err));
    }
  }, []);

  const saveDraft = useCallback(() => {
    setDraft((d) => {
      if (!d) return null;
      const entry = {
        ...d,
        id: `${Date.now()}`,
        pkg_no: parseInt(d.pkg_no, 10) || 0,
        weight: parseFloat(d.weight) || 0,
      };
      setEntries((prev) => [entry, ...prev]);
      return null; // close the form
    });
  }, []);

  const discardDraft = useCallback(() => setDraft(null), []);

  const openPreview = useCallback((entry) => setPreview(entry), []);
  const closePreview = useCallback(() => setPreview(null), []);

  const renderItem = useCallback(
    ({ item }) => {
      const badge = PAYMENT_STYLES[item.payment_type] || { bg: "#E2E8F0", fg: "#334155" };
      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => openPreview(item)}
        >
          <View style={styles.cardTop}>
            <Text style={styles.route} numberOfLines={1}>
              {item.from_station || "—"} → {item.to_station || "—"}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>
                {item.payment_type}
              </Text>
            </View>
          </View>
          <Text style={styles.party} numberOfLines={1}>
            {item.consignor_name || "—"} → {item.consignee_name || "—"}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {item.pkg_no} {item.pkg_type || "pkg"}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.meta}>{item.weight} kg</Text>
            <Text style={styles.tapHint}>Tap to preview bilty</Text>
          </View>
        </Pressable>
      );
    },
    [openPreview]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <Text style={styles.title}>TransSoft Voice</Text>
            <Text style={styles.subtitle}>Speak a consignment to log it</Text>
          </View>
          <Pressable style={styles.dbButton} onPress={() => setDbOpen(true)} hitSlop={8}>
            <Text style={styles.dbButtonText}>🗂  Database</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.recordZone}>
                <Pressable
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  disabled={isProcessing}
                  style={[
                    styles.micButton,
                    isRecording && styles.micButtonActive,
                    isProcessing && styles.micButtonDisabled,
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <Text style={styles.micIcon}>{isRecording ? "●" : "🎙"}</Text>
                  )}
                </Pressable>
                <Text style={styles.recordLabel}>
                  {isProcessing
                    ? "Processing…"
                    : isRecording
                    ? "Listening… release to submit"
                    : "Hold to Record"}
                </Text>
              </View>

              {draft && (
                <DraftForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={saveDraft}
                  onDiscard={discardDraft}
                />
              )}

              {entries.length ? (
                <Text style={styles.listHeader}>Recent Entries</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !draft ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No entries yet.</Text>
                <Text style={styles.emptySub}>
                  Hold the mic and dictate a consignment.
                </Text>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>

      <BiltyPreview entry={preview} visible={!!preview} onClose={closePreview} />
      <DatabaseModal visible={dbOpen} onClose={() => setDbOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#0F172A",
  },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: "#94A3B8", fontSize: 14, marginTop: 2 },

  recordZone: { alignItems: "center", paddingVertical: 24 },
  micButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  micButtonActive: { backgroundColor: "#DC2626", transform: [{ scale: 1.06 }] },
  micButtonDisabled: { backgroundColor: "#64748B" },
  micIcon: { fontSize: 42, color: "#fff" },
  recordLabel: { marginTop: 12, fontSize: 15, fontWeight: "600", color: "#475569" },

  // Form
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  formHeader: { marginBottom: 16 },
  formTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  formHint: { fontSize: 13, color: "#94A3B8", marginTop: 2 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  inputFocused: { borderColor: "#2563EB", backgroundColor: "#fff" },

  row: { flexDirection: "row", marginHorizontal: -6 },
  rowItem: { flex: 1, marginHorizontal: 6 },

  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 8,
  },
  segmentItem: {
    flexGrow: 1,
    minWidth: "22%",
    marginHorizontal: 4,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "700", color: "#64748B" },

  formActions: { flexDirection: "row", marginTop: 8, marginHorizontal: -6 },
  discardBtn: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  discardText: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  saveBtn: {
    flex: 2,
    marginHorizontal: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  saveText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  listHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  route: { fontSize: 17, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 },
  party: { fontSize: 14, color: "#475569", marginBottom: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  metaDot: { marginHorizontal: 8, color: "#CBD5E1" },
  tapHint: { marginLeft: "auto", fontSize: 12, color: "#2563EB", fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 20 },
  emptyText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  emptySub: { fontSize: 14, color: "#94A3B8", marginTop: 4 },

  // Preview modal
  previewSafe: { flex: 1, backgroundColor: "#F1F5F9" },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#0F172A",
  },
  previewTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  previewSub: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  previewClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  previewBody: { flex: 1, padding: 12 },
  webview: { flex: 1, backgroundColor: "transparent", borderRadius: 12 },
  previewActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  shareBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shareBtnBusy: { opacity: 0.7 },
  shareText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  // Header row + Database button
  headerRow: { flexDirection: "row", alignItems: "center" },
  dbButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  dbButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Database modal
  tabBar: {
    flexDirection: "row",
    padding: 6,
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  tabItemActive: {
    backgroundColor: "#fff",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  tabTextActive: { color: "#0F172A" },

  addRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
    marginRight: 10,
  },
  addBtn: {
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: { backgroundColor: "#94A3B8" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  dbLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  dbList: { paddingHorizontal: 16, paddingBottom: 32 },
  dbCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  dbRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  dbName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0F172A", marginRight: 8 },
  dbDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dbDeleteText: { color: "#DC2626", fontSize: 14, fontWeight: "800" },
  dbEmpty: { textAlign: "center", color: "#94A3B8", marginTop: 24, fontSize: 14 },
});
