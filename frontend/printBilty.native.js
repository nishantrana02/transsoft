import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { buildBiltyHtml } from "./bilty";

// Native: render the bilty to a PDF and open the share sheet.
export async function printBilty(entry) {
  const html = buildBiltyHtml(entry);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share Bilty",
      UTI: "com.adobe.pdf",
    });
  }
  return uri;
}
