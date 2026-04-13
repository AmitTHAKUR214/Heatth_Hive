export default function Spinner({ size = 28, color = "var(--color-g)" }) {
  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.spinner,
          width: size,
          height: size,
          borderTopColor: color,
        }}
      />
      {/* keyframes live here */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "24px 0",
  },
  spinner: {
    border: "3px solid #e5e7eb",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
};