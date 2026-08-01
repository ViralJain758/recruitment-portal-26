import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function FormField({ as = "input", label, options, ...props }) {
  const Field = as;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = props.type === "password";

  return (
    <div className="form-group">
      <label htmlFor={props.id}>{label}</label>
      {options ? (
        <select {...props}>
          {options.map(({ label: optionLabel, value }) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
      ) : isPassword ? (
        <div className="password-field" style={{ position: "relative" }}>
          <Field {...props} type={showPassword ? "text" : "password"} />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showPassword ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>
      ) : (
        <Field {...props} />
      )}
    </div>
  );
}
