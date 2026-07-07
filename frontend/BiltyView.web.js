// Web: render the bilty HTML inside an iframe using srcDoc.
export function BiltyView({ html }) {
  return (
    <iframe
      title="Bilty preview"
      srcDoc={html}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 12,
        background: "#fff",
      }}
    />
  );
}
