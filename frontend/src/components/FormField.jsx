import { useRef, useState } from "react";
import { Calendar, Eye, EyeOff } from "lucide-react";

export default function FormField({
  as = "input",
  helperText,
  label,
  options,
  ...props
}) {
  const Field = as;
  const [showPassword, setShowPassword] = useState(false);
  const dateInputRef = useRef(null);

  const isPassword = props.type === "password";
  const isDate = props.type === "date";

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  };

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
      ) : isDate ? (
        <div className="date-field" style={{ position: "relative" }}>
          <Field {...props} ref={dateInputRef} />
          <button
            type="button"
            className="date-picker-toggle"
            onClick={openDatePicker}
            aria-label="Open calendar"
            tabIndex={-1}
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
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
      {helperText ? <p className="form-field-helper">{helperText}</p> : null}
    </div>
  );
}
