import AuthPanel from "./AuthPanel";
import FormField from "./FormField";

const authCopy = {
  login: "Welcome back. Use your registered credentials to continue.",
  signup: "Create your recruitment portal account to begin.",
};

const authFields = {
  login: [
    ["login-email", "email", "Email", "email", "Enter your email"],
    [
      "login-password",
      "password",
      "Password",
      "password",
      "Enter your password",
    ],
  ],
  signup: [
    ["email", "email", "Email", "email", "Enter your email"],
    [
      "password",
      "password",
      "Create Password",
      "password",
      "Set your password",
    ],
    [
      "confirm-password",
      "confirmPassword",
      "Confirm Password",
      "password",
      "Re-enter your password",
    ],
  ],
};

export default function AuthForm({
  error,
  footerAction,
  footerText,
  loading,
  mode,
  onChange,
  onSubmit,
  values,
}) {
  const isSignup = mode === "signup";

  return (
    <AuthPanel
      compact
      copy={authCopy[mode]}
      id={`${mode}-title`}
      title={isSignup ? "Sign up" : "Log in"}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        {authFields[mode].map(([id, name, label, type, placeholder]) => (
          <FormField
            id={id}
            key={id}
            label={label}
            name={name}
            onChange={onChange}
            placeholder={placeholder}
            required={isSignup}
            type={type}
            value={values[name]}
          />
        ))}

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading
            ? isSignup
              ? "Registering..."
              : "Logging in..."
            : isSignup
              ? "Register"
              : "Log in"}
        </button>
      </form>

      <div className="panel-footer">
        <span>{footerText}</span>
        <button type="button" className="link-button" onClick={footerAction}>
          {isSignup ? "Log in" : "Sign up"}
        </button>
      </div>
    </AuthPanel>
  );
}
