export default function Button({
  children,
  onClick,
  color = "#e94560",
  disabled = false,
  style = {},
  type = "button"
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        borderRadius: "14px",
        padding: "12px 14px",
        background: color,
        color: "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        ...style
      }}
    >
      {children}
    </button>
  );
}
