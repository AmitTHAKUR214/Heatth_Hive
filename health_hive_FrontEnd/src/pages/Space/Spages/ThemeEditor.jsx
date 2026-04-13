import { ChromePicker } from "react-color";

export default function ThemeEditor({ theme, setTheme }) {
  return (
    <div className="theme-editor">
      <h3>Theme Colors</h3>

      <div className="color-row">
        <label>Primary</label>
        <ChromePicker
          color={theme.primary}
          onChange={(color) =>
            setTheme({ ...theme, primary: color.hex })
          }
        />
        <input
          value={theme.primary}
          onChange={(e) =>
            setTheme({ ...theme, primary: e.target.value })
          }
        />
      </div>

      <div className="color-row">
        <label>Accent</label>
        <ChromePicker
          color={theme.accent}
          onChange={(color) =>
            setTheme({ ...theme, accent: color.hex })
          }
        />
        <input
          value={theme.accent}
          onChange={(e) =>
            setTheme({ ...theme, accent: e.target.value })
          }
        />
      </div>
    </div>
  );
}
