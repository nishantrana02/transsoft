import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

// Native: render the bilty HTML inside a WebView.
export function BiltyView({ html }) {
  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={styles.webview}
      scalesPageToFit
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "transparent", borderRadius: 12 },
});
