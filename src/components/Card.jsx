export default function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        padding: "16px",
        boxShadow: "0 8px 24px rgba(15,23,42,.08)",
        border: "1px solid #e2e8f0",
        ...style
      }}
    >
      {children}
    </div>
  );
}
