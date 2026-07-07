import { buildBiltyHtml } from "./bilty";

// Web: open the bilty in a new window and invoke the browser print dialog,
// which lets the user save as PDF or print. Falls back to a Blob download if
// popups are blocked.
export async function printBilty(entry) {
  const html = buildBiltyHtml(entry);
  const win = window.open("", "_blank");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Give the browser a tick to lay out before printing.
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (e) {
        // ignore — user can still print manually
      }
    }, 400);
    return;
  }

  // Popup blocked → download the HTML so the user can open/print it.
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bilty.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
